import { http, urlDaApi } from '@/lib/http';

export type StatusDoDocumento =
  'rascunho' | 'em_andamento' | 'concluido' | 'cancelado' | 'recusado' | 'expirado';
export type StatusDoSignatario = 'pendente' | 'visualizado' | 'assinado' | 'recusado';
export type NivelDeVerificacao = 'simples' | 'biometrico' | 'completo';
export type TipoDeVerificacao = 'codigo_email' | 'facial' | 'voz' | 'gestos';

export interface ResumoDoDocumento {
  readonly uuid: string;
  readonly titulo: string;
  readonly codigo: string;
  readonly status: StatusDoDocumento;
  readonly nivelVerificacao: NivelDeVerificacao;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
  readonly enviadoEm: string | null;
  readonly concluidoEm: string | null;
  readonly prazo: string | null;
  readonly criadoPor: { readonly nome: string };
  readonly progresso: { readonly assinados: number; readonly total: number };
  readonly signatarios: readonly { readonly nome: string; readonly status: StatusDoSignatario }[];
}

export interface SignatarioDoDetalhe {
  readonly uuid: string;
  readonly nome: string;
  readonly email: string;
  readonly cpfMascarado: string | null;
  readonly ordem: number;
  readonly status: StatusDoSignatario;
  readonly ehAVez: boolean;
  readonly visualizadoEm: string | null;
  readonly assinadoEm: string | null;
  readonly recusadoEm: string | null;
  readonly motivoRecusa: string | null;
  readonly tipoAssinatura: 'desenhada' | 'digitada' | null;
  readonly verificacoes: readonly {
    readonly tipo: TipoDeVerificacao;
    readonly aprovada: boolean;
    readonly concluidaEm: string | null;
    readonly pontuacao: number | null;
  }[];
}

export interface DetalheDoDocumento extends Omit<ResumoDoDocumento, 'signatarios' | 'criadoPor'> {
  readonly mensagem: string | null;
  readonly ordemSequencial: boolean;
  readonly nomeArquivo: string;
  readonly tamanhoBytes: number;
  readonly paginas: number;
  readonly hashOriginal: string;
  readonly hashAssinado: string | null;
  readonly canceladoEm: string | null;
  readonly motivoCancelamento: string | null;
  readonly criadoPor: { readonly nome: string; readonly email: string };
  readonly temSelo: boolean;
  readonly urlDeValidacao: string;
  readonly podeGerenciar: boolean;
  readonly meuSignatario: string | null;
  readonly signatarios: readonly SignatarioDoDetalhe[];
}

export interface Listagem {
  readonly itens: readonly ResumoDoDocumento[];
  readonly total: number;
  readonly pagina: number;
  readonly porPagina: number;
  readonly contagens: Partial<Record<StatusDoDocumento, number>>;
}

export interface EventoDaTrilha {
  readonly sequencia: number;
  readonly acao: string;
  readonly resumo: string;
  readonly tipoAtor: 'usuario' | 'signatario' | 'sistema';
  readonly atorNome: string | null;
  readonly ip: string | null;
  readonly criadoEm: string;
  readonly hash: string;
}

export interface Integridade {
  readonly integra: boolean;
  readonly total: number;
  readonly quebraEm: number | null;
  readonly motivo: string | null;
}

export interface FiltroDaListagem {
  readonly q?: string;
  readonly status?: StatusDoDocumento | null;
  readonly ordenar?: string;
  readonly dir?: 'asc' | 'desc';
  readonly pagina?: number;
  readonly por?: number;
}

function querystring(filtro: FiltroDaListagem): string {
  const busca = new URLSearchParams();

  for (const [chave, valor] of Object.entries(filtro)) {
    if (valor !== undefined && valor !== null && valor !== '') busca.set(chave, String(valor));
  }

  const texto = busca.toString();

  return texto.length > 0 ? `?${texto}` : '';
}

export const apiDeDocumentos = {
  listar: (filtro: FiltroDaListagem) => http.get<Listagem>(`/documentos${querystring(filtro)}`),
  detalhe: (uuid: string) => http.get<DetalheDoDocumento>(`/documentos/${uuid}`),
  criar: (dados: { arquivo: File; titulo: string; mensagem?: string }) => {
    const formulario = new FormData();

    formulario.set('arquivo', dados.arquivo);
    formulario.set('titulo', dados.titulo);
    if (dados.mensagem) formulario.set('mensagem', dados.mensagem);

    return http.post<DetalheDoDocumento>('/documentos', formulario);
  },
  atualizar: (
    uuid: string,
    dados: {
      titulo?: string;
      mensagem?: string | null;
      nivelVerificacao?: NivelDeVerificacao;
      ordemSequencial?: boolean;
      prazo?: string | null;
    },
  ) => http.patch<DetalheDoDocumento>(`/documentos/${uuid}`, dados),
  definirSignatarios: (
    uuid: string,
    signatarios: readonly { nome: string; email: string; cpf?: string }[],
  ) => http.put<DetalheDoDocumento>(`/documentos/${uuid}/signatarios`, { signatarios }),
  enviar: (uuid: string) => http.post<DetalheDoDocumento>(`/documentos/${uuid}/enviar`),
  cancelar: (uuid: string, motivo: string) =>
    http.post<DetalheDoDocumento>(`/documentos/${uuid}/cancelar`, { motivo }),
  excluir: (uuid: string) => http.delete<void>(`/documentos/${uuid}`),
  reenviar: (uuid: string, signatario: string) =>
    http.post<{ link: string }>(`/documentos/${uuid}/signatarios/${signatario}/reenviar`),
  assinarAgora: (uuid: string) =>
    http.post<{ caminho: string }>(`/documentos/${uuid}/assinar-agora`),
  trilha: (uuid: string) =>
    http.get<{ integridade: Integridade; eventos: readonly EventoDaTrilha[] }>(
      `/documentos/${uuid}/trilha`,
    ),
  urlDoArquivo: (uuid: string, versao: 'original' | 'assinado', baixar = false) =>
    urlDaApi(`/documentos/${uuid}/arquivo?versao=${versao}${baixar ? '&baixar=1' : ''}`),
};
