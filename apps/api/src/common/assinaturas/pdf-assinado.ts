import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { toBuffer } from 'qrcode';

export interface SignatarioDoManifesto {
  readonly nome: string;
  readonly emailMascarado: string;
  readonly cpfMascarado: string | null;
  readonly assinadoEm: Date;
  readonly ip: string | null;
  readonly verificacoes: readonly string[];
  readonly imagemPng: Buffer | null;
  /** Identificador curto da assinatura Ed25519 (prefixo do SHA-256 dela). */
  readonly idDaAssinatura: string;
}

export interface DadosDoManifesto {
  readonly titulo: string;
  readonly codigo: string;
  readonly urlDeValidacao: string;
  readonly hashOriginal: string;
  readonly paginas: number;
  readonly organizacao: string;
  readonly remetente: string;
  readonly enviadoEm: Date;
  readonly concluidoEm: Date;
  readonly idDaChave: string;
  readonly signatarios: readonly SignatarioDoManifesto[];
  /** JSON com cargas e assinaturas, anexado DENTRO do PDF. */
  readonly evidencias: string;
}

const COR_MARCA = rgb(0.263, 0.22, 0.792); // #4338ca
const COR_TINTA = rgb(0.059, 0.086, 0.161); // #0f1629
const COR_SECUNDARIA = rgb(0.29, 0.33, 0.44); // #4a5470
const COR_SUAVE = rgb(0.42, 0.45, 0.56);
const COR_LINHA = rgb(0.894, 0.906, 0.941);
const COR_FUNDO = rgb(0.965, 0.969, 0.984);
const COR_SUCESSO = rgb(0.016, 0.47, 0.34);

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 48;

/**
 * As fontes padrão do PDF (Helvetica) só codificam **WinAnsi**. Um caractere fora
 * dele — emoji num título, um ideograma num nome — faria o pdf-lib lançar e a
 * conclusão do documento falhar. Aqui ele vira `?`: o documento conclui, e o
 * texto original continua íntegro no banco e nas evidências anexadas.
 */
const EXTRAS_WINANSI = new Set([...'•–—“”‘’…€™']);

export function paraWinAnsi(texto: string): string {
  return [...texto.normalize('NFC')]
    .map((caractere) => {
      const codigo = caractere.codePointAt(0) ?? 0;
      const latin1Imprimivel =
        (codigo >= 0x20 && codigo <= 0x7e) || (codigo >= 0xa0 && codigo <= 0xff);

      return latin1Imprimivel || EXTRAS_WINANSI.has(caractere) ? caractere : '?';
    })
    .join('');
}

export function formatarDataHora(data: Date): string {
  return `${data.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' })} (Brasília)`;
}

interface Fontes {
  readonly normal: PDFFont;
  readonly negrito: PDFFont;
  readonly mono: PDFFont;
}

/**
 * Monta o PDF final a partir do original.
 *
 * 1. **Rodapé em todas as páginas originais** — código e endereço de validação.
 *    Quem recebe uma página solta ainda sabe onde conferir.
 * 2. **Manifesto de assinaturas** — uma ou mais páginas ao final, com QR Code,
 *    hash do original, e um cartão por signatário (rubrica, data, IP,
 *    verificações de identidade e id da assinatura digital).
 * 3. **Evidências anexadas** — `letssign-evidencias.json` vai DENTRO do PDF
 *    (anexo PDF/A-3 style): as cargas canônicas, as assinaturas Ed25519 e a chave
 *    pública. O arquivo se auto-verifica, mesmo que o LetsSign deixe de existir.
 */
export async function montarPdfAssinado(
  original: Uint8Array,
  dados: DadosDoManifesto,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(original);
  const fontes: Fontes = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrito: await pdf.embedFont(StandardFonts.HelveticaBold),
    mono: await pdf.embedFont(StandardFonts.Courier),
  };

  for (const pagina of pdf.getPages()) carimbarRodape(pagina, fontes, dados);

  const qr = await pdf.embedPng(
    await toBuffer(dados.urlDeValidacao, { margin: 1, width: 360, errorCorrectionLevel: 'M' }),
  );

  await desenharManifesto(pdf, fontes, dados, qr);

  await pdf.attach(Buffer.from(dados.evidencias, 'utf8'), 'letssign-evidencias.json', {
    mimeType: 'application/json',
    description: 'Evidências criptográficas das assinaturas (LetsSign)',
    creationDate: dados.concluidoEm,
    modificationDate: dados.concluidoEm,
  });

  pdf.setTitle(paraWinAnsi(dados.titulo));
  pdf.setSubject(`Documento assinado eletronicamente — ${dados.codigo}`);
  pdf.setProducer('LetsSign');
  pdf.setCreator('LetsSign — assinatura eletrônica avançada');
  pdf.setKeywords(['LetsSign', dados.codigo, dados.hashOriginal]);
  pdf.setModificationDate(dados.concluidoEm);

  // `useObjectStreams: false` gera um PDF mais compatível com leitores antigos.
  return pdf.save({ useObjectStreams: false });
}

function carimbarRodape(pagina: PDFPage, fontes: Fontes, dados: DadosDoManifesto): void {
  const { width } = pagina.getSize();
  const texto = paraWinAnsi(
    `Assinado eletronicamente via LetsSign · ${dados.codigo} · Valide em ${dados.urlDeValidacao}`,
  );
  const tamanho = 6.5;
  const largura = fontes.normal.widthOfTextAtSize(texto, tamanho);

  pagina.drawRectangle({ x: 0, y: 0, width, height: 16, color: rgb(1, 1, 1), opacity: 0.85 });
  pagina.drawText(texto, {
    x: Math.max(12, (width - largura) / 2),
    y: 5.5,
    size: tamanho,
    font: fontes.normal,
    color: COR_SUAVE,
  });
}

async function desenharManifesto(
  pdf: PDFDocument,
  fontes: Fontes,
  dados: DadosDoManifesto,
  qr: Awaited<ReturnType<PDFDocument['embedPng']>>,
): Promise<void> {
  let pagina = novaPaginaDoManifesto(pdf, fontes, dados);
  let y = A4.altura - 120;

  // ---- Bloco do documento + QR ----
  const texto = (
    conteudo: string,
    x: number,
    altura: number,
    opcoes: { fonte?: PDFFont; tamanho?: number; cor?: ReturnType<typeof rgb> } = {},
  ) =>
    pagina.drawText(paraWinAnsi(conteudo), {
      x,
      y: altura,
      size: opcoes.tamanho ?? 9.5,
      font: opcoes.fonte ?? fontes.normal,
      color: opcoes.cor ?? COR_TINTA,
    });

  pagina.drawRectangle({
    x: MARGEM,
    y: y - 150,
    width: A4.largura - MARGEM * 2,
    height: 160,
    color: COR_FUNDO,
    borderColor: COR_LINHA,
    borderWidth: 1,
  });
  texto('DOCUMENTO', MARGEM + 18, y - 14, { fonte: fontes.negrito, tamanho: 7.5, cor: COR_SUAVE });
  texto(truncarParaLargura(dados.titulo, fontes.negrito, 13, 330), MARGEM + 18, y - 32, {
    fonte: fontes.negrito,
    tamanho: 13,
  });

  const linhas: [string, string][] = [
    ['Código de validação', dados.codigo],
    ['Organização', dados.organizacao],
    ['Enviado por', dados.remetente],
    ['Enviado em', formatarDataHora(dados.enviadoEm)],
    ['Concluído em', formatarDataHora(dados.concluidoEm)],
    ['Páginas do original', String(dados.paginas)],
  ];

  linhas.forEach(([rotulo, valor], indice) => {
    const altura = y - 54 - indice * 14;

    texto(rotulo, MARGEM + 18, altura, { tamanho: 8.5, cor: COR_SUAVE });
    texto(truncarParaLargura(valor, fontes.normal, 8.5, 220), MARGEM + 120, altura, {
      tamanho: 8.5,
    });
  });

  pagina.drawImage(qr, { x: A4.largura - MARGEM - 128, y: y - 138, width: 112, height: 112 });
  texto('Escaneie para validar', A4.largura - MARGEM - 124, y - 146, {
    tamanho: 7,
    cor: COR_SUAVE,
  });

  y -= 174;
  texto('HASH SHA-256 DO ORIGINAL', MARGEM, y, {
    fonte: fontes.negrito,
    tamanho: 7.5,
    cor: COR_SUAVE,
  });
  texto(dados.hashOriginal, MARGEM, y - 13, { fonte: fontes.mono, tamanho: 8.2, cor: COR_MARCA });

  y -= 44;
  texto(`ASSINATURAS (${dados.signatarios.length})`, MARGEM, y, {
    fonte: fontes.negrito,
    tamanho: 7.5,
    cor: COR_SUAVE,
  });
  y -= 12;

  for (const signatario of dados.signatarios) {
    const alturaDoCartao = 112;

    if (y - alturaDoCartao < 90) {
      pagina = novaPaginaDoManifesto(pdf, fontes, dados);
      y = A4.altura - 120;
    }

    await desenharCartaoDeSignatario(pdf, pagina, fontes, signatario, y - alturaDoCartao);
    y -= alturaDoCartao + 12;
  }
}

async function desenharCartaoDeSignatario(
  pdf: PDFDocument,
  pagina: PDFPage,
  fontes: Fontes,
  signatario: SignatarioDoManifesto,
  base: number,
): Promise<void> {
  const largura = A4.largura - MARGEM * 2;
  const texto = (
    conteudo: string,
    x: number,
    y: number,
    fonte: PDFFont = fontes.normal,
    tamanho = 8.5,
    cor = COR_SECUNDARIA,
  ) => pagina.drawText(paraWinAnsi(conteudo), { x, y, size: tamanho, font: fonte, color: cor });

  pagina.drawRectangle({
    x: MARGEM,
    y: base,
    width: largura,
    height: 112,
    borderColor: COR_LINHA,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });
  pagina.drawRectangle({ x: MARGEM, y: base, width: 3, height: 112, color: COR_SUCESSO });

  const topo = base + 112;

  texto(
    truncarParaLargura(signatario.nome, fontes.negrito, 11, 280),
    MARGEM + 16,
    topo - 22,
    fontes.negrito,
    11,
    COR_TINTA,
  );
  texto('ASSINADO', MARGEM + largura - 70, topo - 21, fontes.negrito, 7.5, COR_SUCESSO);

  const detalhes = [
    `E-mail: ${signatario.emailMascarado}${signatario.cpfMascarado ? `   ·   CPF: ${signatario.cpfMascarado}` : ''}`,
    `Assinado em: ${formatarDataHora(signatario.assinadoEm)}${signatario.ip ? `   ·   IP: ${signatario.ip}` : ''}`,
    `Identidade verificada por: ${signatario.verificacoes.join(', ')}`,
  ];

  detalhes.forEach((linha, indice) =>
    texto(
      truncarParaLargura(linha, fontes.normal, 8.2, 300),
      MARGEM + 16,
      topo - 40 - indice * 13,
      fontes.normal,
      8.2,
    ),
  );
  texto(
    `Assinatura digital Ed25519 · id ${signatario.idDaAssinatura}`,
    MARGEM + 16,
    base + 12,
    fontes.mono,
    7,
    COR_MARCA,
  );

  if (signatario.imagemPng !== null) {
    try {
      const imagem = await pdf.embedPng(signatario.imagemPng);
      const escala = Math.min(170 / imagem.width, 58 / imagem.height, 1);

      pagina.drawImage(imagem, {
        x: MARGEM + largura - 16 - imagem.width * escala,
        y: base + 34,
        width: imagem.width * escala,
        height: imagem.height * escala,
      });
    } catch {
      // PNG inválido não impede a conclusão: a prova é a assinatura digital, não a imagem.
    }
  }

  pagina.drawLine({
    start: { x: MARGEM + largura - 196, y: base + 30 },
    end: { x: MARGEM + largura - 16, y: base + 30 },
    thickness: 0.6,
    color: COR_LINHA,
  });
}

function novaPaginaDoManifesto(pdf: PDFDocument, fontes: Fontes, dados: DadosDoManifesto): PDFPage {
  const pagina = pdf.addPage([A4.largura, A4.altura]);

  pagina.drawRectangle({
    x: 0,
    y: A4.altura - 86,
    width: A4.largura,
    height: 86,
    color: COR_MARCA,
  });
  pagina.drawText('LetsSign', {
    x: MARGEM,
    y: A4.altura - 40,
    size: 16,
    font: fontes.negrito,
    color: rgb(1, 1, 1),
  });
  pagina.drawText('Manifesto de assinaturas eletrônicas', {
    x: MARGEM,
    y: A4.altura - 62,
    size: 11,
    font: fontes.normal,
    color: rgb(0.85, 0.87, 1),
  });
  pagina.drawText(dados.codigo, {
    x: A4.largura - MARGEM - fontes.mono.widthOfTextAtSize(dados.codigo, 11),
    y: A4.altura - 50,
    size: 11,
    font: fontes.mono,
    color: rgb(1, 1, 1),
  });

  const legal = [
    'Documento assinado eletronicamente por meio da plataforma LetsSign, nos termos da MP 2.200-2/2001 (art. 10, § 2º)',
    'e da Lei 14.063/2020 (assinatura eletrônica avançada). A integridade pode ser conferida pelo QR Code ou em',
    `${dados.urlDeValidacao}. Chave pública da plataforma: id ${dados.idDaChave}. Evidências anexadas: letssign-evidencias.json.`,
  ];

  legal.forEach((linha, indice) =>
    pagina.drawText(paraWinAnsi(linha), {
      x: MARGEM,
      y: 58 - indice * 10,
      size: 6.8,
      font: fontes.normal,
      color: COR_SUAVE,
    }),
  );

  return pagina;
}

function truncarParaLargura(
  texto: string,
  fonte: PDFFont,
  tamanho: number,
  largura: number,
): string {
  const limpo = paraWinAnsi(texto);

  if (fonte.widthOfTextAtSize(limpo, tamanho) <= largura) return limpo;

  let corte = limpo;

  while (corte.length > 1 && fonte.widthOfTextAtSize(`${corte}…`, tamanho) > largura) {
    corte = corte.slice(0, -1);
  }

  return `${corte}…`;
}
