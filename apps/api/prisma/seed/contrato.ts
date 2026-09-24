import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

/** Gera um contrato em PDF, com cara de contrato, para o seed. */
const CLAUSULAS = [
  [
    'Do objeto',
    'O presente instrumento tem por objeto a prestação dos serviços descritos no Anexo I, observadas as especificações técnicas, os prazos e os níveis de serviço ali estabelecidos, que as partes declaram conhecer e aceitar integralmente.',
  ],
  [
    'Das obrigações da contratada',
    'A CONTRATADA compromete-se a executar os serviços com zelo, diligência e observância das boas práticas de mercado, mantendo equipe qualificada e fornecendo relatórios mensais de acompanhamento sempre que solicitados pela CONTRATANTE.',
  ],
  [
    'Das obrigações da contratante',
    'A CONTRATANTE obriga-se a fornecer as informações e os acessos necessários à execução dos serviços, bem como a efetuar os pagamentos nas datas e condições pactuadas neste instrumento.',
  ],
  [
    'Do preço e da forma de pagamento',
    'Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor mensal estabelecido no Anexo II, mediante apresentação de nota fiscal, com vencimento no décimo dia útil do mês subsequente ao da prestação.',
  ],
  [
    'Da confidencialidade',
    'As partes comprometem-se a manter sigilo sobre todas as informações a que tiverem acesso em razão deste contrato, não as divulgando a terceiros sem prévia autorização por escrito, durante a vigência e por cinco anos após o seu término.',
  ],
  [
    'Da proteção de dados pessoais',
    'As partes tratarão os dados pessoais eventualmente compartilhados em estrita conformidade com a Lei nº 13.709/2018 (LGPD), adotando medidas técnicas e administrativas aptas a protegê-los de acessos não autorizados.',
  ],
  [
    'Da vigência e da rescisão',
    'Este contrato vigora por doze meses a contar da data da última assinatura, renovando-se automaticamente por iguais períodos, salvo manifestação em contrário com antecedência mínima de trinta dias.',
  ],
  [
    'Da assinatura eletrônica',
    'As partes reconhecem a validade da assinatura eletrônica deste instrumento, nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020, declarando-a apta a comprovar a autoria e a integridade do documento.',
  ],
  [
    'Do foro',
    'Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias oriundas deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.',
  ],
] as const;

function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = [];
  let atual = '';

  for (const palavra of texto.split(' ')) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;

    if (fonte.widthOfTextAtSize(tentativa, tamanho) > largura) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }

  if (atual) linhas.push(atual);

  return linhas;
}

export async function gerarContrato(
  titulo: string,
  partes: readonly string[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.TimesRoman);
  const negrito = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const largura = 595.28 - 72 * 2;
  let pagina: PDFPage = pdf.addPage([595.28, 841.89]);
  let y = 770;

  const novaLinha = (altura: number) => {
    y -= altura;

    if (y < 90) {
      pagina = pdf.addPage([595.28, 841.89]);
      y = 770;
    }
  };

  for (const linha of quebrar(titulo.toUpperCase(), negrito, 14, largura)) {
    pagina.drawText(linha, { x: 72, y, size: 14, font: negrito });
    novaLinha(20);
  }

  novaLinha(8);
  const preambulo = `Pelo presente instrumento particular, de um lado ${partes[0] ?? 'CONTRATANTE'}, doravante denominada CONTRATANTE, e de outro ${partes[1] ?? 'CONTRATADA'}, doravante denominada CONTRATADA, têm entre si justo e contratado o que segue, mediante as cláusulas e condições abaixo.`;

  for (const linha of quebrar(preambulo, normal, 11, largura)) {
    pagina.drawText(linha, { x: 72, y, size: 11, font: normal, color: rgb(0.1, 0.1, 0.12) });
    novaLinha(15);
  }

  CLAUSULAS.forEach(([nome, texto], indice) => {
    novaLinha(12);
    pagina.drawText(`CLÁUSULA ${indice + 1}ª — ${nome.toUpperCase()}`, {
      x: 72,
      y,
      size: 11,
      font: negrito,
    });
    novaLinha(16);

    for (const linha of quebrar(texto, normal, 11, largura)) {
      pagina.drawText(linha, { x: 72, y, size: 11, font: normal, color: rgb(0.1, 0.1, 0.12) });
      novaLinha(15);
    }
  });

  novaLinha(24);
  pagina.drawText(
    'E, por estarem justas e contratadas, as partes assinam eletronicamente o presente instrumento.',
    { x: 72, y, size: 11, font: normal },
  );

  pdf.setTitle(titulo);
  pdf.setProducer('LetsSign (seed de demonstração)');

  return pdf.save();
}
