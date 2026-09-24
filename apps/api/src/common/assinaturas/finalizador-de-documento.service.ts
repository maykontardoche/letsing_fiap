import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import { EnvService } from '../../config/env/env.service';
import { ArmazenamentoService } from '../armazenamento/armazenamento.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { jsonCanonico } from '../cripto/canonico';
import { ChaveDaPlataformaService } from '../cripto/chave-da-plataforma.service';
import { sha256 } from '../cripto/hash';
import { EmailService } from '../email/email.service';
import { modelos } from '../email/modelos';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { mascararCpf, mascararEmail } from '../texto/mascaras';
import { resumoDaConclusao } from '../texto/plural';
import { montarPdfAssinado } from './pdf-assinado';
import { ROTULO_DA_VERIFICACAO } from './status-do-documento';

/** Até este tamanho o PDF final vai anexado no e-mail de conclusão. */
const LIMITE_DO_ANEXO = 8 * 1024 * 1024;
/** Depois de concluído, o link de cada signatário vale mais 30 dias para baixar o PDF. */
const VALIDADE_POS_CONCLUSAO_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Conclui um documento: gera o PDF final, sela e avisa todo mundo.
 *
 * ## Idempotente, de propósito
 *
 * ⚠️ É chamado quando a última assinatura chega — e **também** por um job
 * periódico, que pega documento com todas as assinaturas e ainda sem PDF final
 * (o servidor pode ter caído entre gravar a assinatura e gerar o PDF). Chamar
 * duas vezes não gera dois PDFs nem dois eventos.
 *
 * ## Concorrência
 *
 * Em ordem paralela, dois signatários podem terminar no mesmo instante e os dois
 * chamarem a conclusão. Cada tentativa grava o PDF numa **chave própria**, e só a
 * que vence o `updateMany ... WHERE status = 'em_andamento'` fica registrada; a
 * perdedora apaga o próprio arquivo. Sem isso, o arquivo no disco poderia ser o
 * de uma tentativa e o hash no banco, o de outra.
 *
 * ⚠️ Roda **dentro** do contexto da organização do documento.
 */
@Injectable()
export class FinalizadorDeDocumentoService {
  private readonly logger = new Logger(FinalizadorDeDocumentoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly armazenamento: ArmazenamentoService,
    private readonly auditoria: AuditoriaService,
    private readonly chave: ChaveDaPlataformaService,
    private readonly email: EmailService,
    private readonly notificacoes: NotificacoesService,
    private readonly env: EnvService,
  ) {}

  async finalizarSePronto(documentoId: number, agora = new Date()): Promise<boolean> {
    const documento = await this.prisma.db.documento.findUnique({
      where: { id: documentoId },
      include: {
        signatarios: {
          orderBy: { ordem: 'asc' },
          include: { desafios: { where: { aprovado: true } } },
        },
        criadoPor: true,
        organizacao: true,
      },
    });

    if (documento === null || documento.status !== 'em_andamento') return false;
    if (
      documento.signatarios.length === 0 ||
      documento.signatarios.some((s) => s.status !== 'assinado')
    ) {
      return false;
    }

    const original = await this.armazenamento.ler(documento.arquivoOriginal);

    // ⚠️ O original no disco precisa ser o que foi assinado. Se não for, NÃO sela.
    if (sha256(original) !== documento.hashOriginal) {
      throw new Error(`Integridade do original do documento ${documento.uuid} não confere.`);
    }

    const assinador = this.chave.assinador;
    const urlDeValidacao = `${this.env.urlDoApp}/validar/${documento.codigo}`;

    const evidencias = jsonCanonico({
      versao: 1,
      documento: {
        uuid: documento.uuid,
        codigo: documento.codigo,
        titulo: documento.titulo,
        hashOriginal: documento.hashOriginal,
      },
      chavePublica: {
        algoritmo: 'Ed25519',
        id: assinador.idDaChave,
        pem: assinador.chavePublicaPem,
      },
      assinaturas: documento.signatarios.map((s) => ({
        signatario: s.uuid,
        carga: s.cargaAssinada,
        assinatura: s.assinaturaDigital,
      })),
      comoVerificar:
        'Para cada assinatura: Ed25519.verify(chavePublica, UTF-8(carga), base64(assinatura)). ' +
        'A carga contém o hashOriginal (SHA-256 do PDF enviado).',
    });

    const bytes = await montarPdfAssinado(original, {
      titulo: documento.titulo,
      codigo: documento.codigo,
      urlDeValidacao,
      hashOriginal: documento.hashOriginal,
      paginas: documento.paginas,
      organizacao: documento.organizacao.nome,
      remetente: documento.criadoPor.nome,
      enviadoEm: documento.enviadoEm ?? documento.criadoEm,
      concluidoEm: agora,
      idDaChave: assinador.idDaChave,
      evidencias,
      signatarios: documento.signatarios.map((s) => ({
        nome: s.nome,
        emailMascarado: mascararEmail(s.email),
        cpfMascarado: mascararCpf(s.cpfFinal),
        assinadoEm: s.assinadoEm ?? agora,
        ip: s.ip,
        verificacoes: s.desafios.map((d) => ROTULO_DA_VERIFICACAO[d.tipo]),
        imagemPng: imagemDaRubrica(s.imagemAssinatura),
        idDaAssinatura: sha256(s.assinaturaDigital ?? '').slice(0, 16),
      })),
    });

    const hashAssinado = sha256(bytes);
    const chaveDoArquivo = `org-${documento.organizacaoId}/documentos/${documento.uuid}/assinado-${agora.getTime()}.pdf`;

    await this.armazenamento.gravar(chaveDoArquivo, bytes);

    const selo = assinador.assinar({
      versao: 1,
      tipo: 'selo_de_conclusao',
      documento: documento.uuid,
      codigo: documento.codigo,
      hashOriginal: documento.hashOriginal,
      hashAssinado,
      concluidoEm: agora,
      assinaturas: documento.signatarios.map((s) => sha256(s.assinaturaDigital ?? '')),
      chave: assinador.idDaChave,
    });

    const venceu = await this.prisma.db.$transaction(async (tx) => {
      const { count } = await tx.documento.updateMany({
        where: { id: documento.id, status: 'em_andamento' },
        data: {
          status: 'concluido',
          concluidoEm: agora,
          arquivoAssinado: chaveDoArquivo,
          hashAssinado,
          cargaDoSelo: selo.carga,
          selo: selo.assinatura,
        },
      });

      if (count === 0) return false;

      await tx.signatario.updateMany({
        where: { documentoId: documento.id },
        data: { tokenExpiraEm: new Date(agora.getTime() + VALIDADE_POS_CONCLUSAO_MS) },
      });

      await this.auditoria.registrar(
        {
          acao: 'documento_concluido',
          resumo: resumoDaConclusao(documento.signatarios.length),
          tipoAtor: 'sistema',
          atorNome: 'LetsSign',
          documento: { id: documento.id, uuid: documento.uuid },
          dados: { hashAssinado, idDaChave: assinador.idDaChave },
          em: agora,
        },
        tx,
      );

      await this.notificacoes.criar(
        {
          usuarioId: documento.criadoPorId,
          titulo: 'Documento concluído',
          mensagem: `“${documento.titulo}” foi assinado por todos.`,
          link: `/app/documentos/${documento.uuid}`,
        },
        tx,
      );

      return true;
    });

    if (!venceu) {
      await this.armazenamento.remover(chaveDoArquivo);
      return false;
    }

    await this.avisarConclusao(documento, bytes, urlDeValidacao);
    this.logger.log(
      `Documento ${documento.codigo} concluído (sha256 ${hashAssinado.slice(0, 12)}…).`,
    );

    return true;
  }

  private async avisarConclusao(
    documento: {
      uuid: string;
      titulo: string;
      codigo: string;
      criadoPor: { nome: string; email: string };
      signatarios: { nome: string; email: string }[];
    },
    bytes: Uint8Array,
    urlDeValidacao: string,
  ): Promise<void> {
    const anexos =
      bytes.length <= LIMITE_DO_ANEXO
        ? [
            {
              nome: `${nomeDeArquivo(documento.titulo)}-assinado.pdf`,
              conteudoBase64: Buffer.from(bytes).toString('base64'),
              tipo: 'application/pdf',
            },
          ]
        : undefined;

    const destinatarios = new Map<string, { nome: string; url: string }>();

    for (const s of documento.signatarios)
      destinatarios.set(s.email, { nome: s.nome, url: urlDeValidacao });

    destinatarios.set(documento.criadoPor.email, {
      nome: documento.criadoPor.nome,
      url: `${this.env.urlDoApp}/app/documentos/${documento.uuid}`,
    });

    for (const [para, { nome, url }] of destinatarios) {
      await this.email.enfileirar({
        ...modelos.documentoConcluido({
          para,
          nome,
          titulo: documento.titulo,
          url,
          codigo: documento.codigo,
        }),
        anexos,
      });
    }
  }
}

function imagemDaRubrica(dataUrl: string | null): Buffer | null {
  if (dataUrl === null) return null;

  const [, base64] = dataUrl.split(',');

  return base64 === undefined ? null : Buffer.from(base64, 'base64');
}

function nomeDeArquivo(titulo: string): string {
  return (
    titulo
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 60) || 'documento'
  );
}
