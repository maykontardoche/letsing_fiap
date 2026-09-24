import type { DesafioDeVerificacao, Documento, Signatario, Usuario } from '@prisma/client';
import { ehAVezDe } from '../../common/assinaturas/convites.service';
import { VERIFICACOES_DO_NIVEL } from '../../common/assinaturas/status-do-documento';
import { mascararCpf } from '../../common/texto/mascaras';

type SignatarioComDesafios = Signatario & { desafios: DesafioDeVerificacao[] };

/**
 * A forma pública de um documento na API.
 *
 * ⚠️ Nunca devolve `id` interno, `tokenHash`, `cpfCifrado`, `cargaAssinada` nem
 * caminho de arquivo: a resposta é montada campo a campo, e o que não está aqui
 * não sai. Serializar o registro do Prisma direto é o jeito clássico de vazar a
 * coluna nova que alguém adicionou mês que vem.
 */
export function resumoDoDocumento(
  documento: Documento & { criadoPor: Pick<Usuario, 'nome'>; signatarios: Pick<Signatario, 'nome' | 'status' | 'ordem'>[] },
) {
  const assinados = documento.signatarios.filter((s) => s.status === 'assinado').length;

  return {
    uuid: documento.uuid,
    titulo: documento.titulo,
    codigo: documento.codigo,
    status: documento.status,
    nivelVerificacao: documento.nivelVerificacao,
    criadoEm: documento.criadoEm,
    atualizadoEm: documento.atualizadoEm,
    enviadoEm: documento.enviadoEm,
    concluidoEm: documento.concluidoEm,
    prazo: documento.prazo,
    criadoPor: { nome: documento.criadoPor.nome },
    progresso: { assinados, total: documento.signatarios.length },
    signatarios: [...documento.signatarios]
      .sort((a, b) => a.ordem - b.ordem)
      .map((s) => ({ nome: s.nome, status: s.status })),
  };
}

export function detalheDoDocumento(
  documento: Documento & { criadoPor: Pick<Usuario, 'nome' | 'email'>; signatarios: SignatarioComDesafios[] },
  extras: { podeGerenciar: boolean; urlDeValidacao: string; meuSignatario: string | null },
) {
  const exigidas = VERIFICACOES_DO_NIVEL[documento.nivelVerificacao];
  const signatarios = [...documento.signatarios].sort((a, b) => a.ordem - b.ordem);

  return {
    ...resumoDoDocumento(documento),
    mensagem: documento.mensagem,
    ordemSequencial: documento.ordemSequencial,
    nomeArquivo: documento.nomeArquivo,
    tamanhoBytes: documento.tamanhoBytes,
    paginas: documento.paginas,
    hashOriginal: documento.hashOriginal,
    hashAssinado: documento.hashAssinado,
    canceladoEm: documento.canceladoEm,
    motivoCancelamento: documento.motivoCancelamento,
    criadoPor: { nome: documento.criadoPor.nome, email: documento.criadoPor.email },
    temSelo: documento.selo !== null,
    urlDeValidacao: extras.urlDeValidacao,
    podeGerenciar: extras.podeGerenciar,
    /** O uuid do signatário que é a própria pessoa logada — habilita "Assinar agora". */
    meuSignatario: extras.meuSignatario,
    signatarios: signatarios.map((s) => ({
      uuid: s.uuid,
      nome: s.nome,
      email: s.email,
      cpfMascarado: mascararCpf(s.cpfFinal),
      ordem: s.ordem,
      status: s.status,
      ehAVez: documento.status === 'em_andamento' && ehAVezDe(s, signatarios, documento.ordemSequencial),
      visualizadoEm: s.visualizadoEm,
      assinadoEm: s.assinadoEm,
      recusadoEm: s.recusadoEm,
      motivoRecusa: s.motivoRecusa,
      tipoAssinatura: s.tipoAssinatura,
      verificacoes: exigidas.map((tipo) => {
        const aprovado = s.desafios.find((d) => d.tipo === tipo && d.aprovado === true);

        return { tipo, aprovada: aprovado !== undefined, concluidaEm: aprovado?.concluidoEm ?? null, pontuacao: aprovado?.pontuacao ?? null };
      }),
    })),
  };
}
