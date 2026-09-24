import { http, urlDaApi } from '@/lib/http';
import type { NivelDeVerificacao, StatusDoDocumento, StatusDoSignatario, TipoDeVerificacao } from './documentos';

export interface ResultadoDaValidacao {
  readonly documento: {
    readonly titulo: string;
    readonly codigo: string;
    readonly status: StatusDoDocumento;
    readonly organizacao: string;
    readonly remetente: string;
    readonly paginas: number;
    readonly nivelVerificacao: NivelDeVerificacao;
    readonly hashOriginal: string;
    readonly hashAssinado: string | null;
    readonly enviadoEm: string | null;
    readonly concluidoEm: string | null;
    readonly canceladoEm: string | null;
  };
  readonly selo: { readonly presente: boolean; readonly valido: boolean; readonly algoritmo: string; readonly idDaChave: string };
  readonly trilha: { readonly integra: boolean; readonly total: number; readonly quebraEm: number | null; readonly motivo: string | null };
  readonly signatarios: readonly {
    readonly nome: string;
    readonly emailMascarado: string;
    readonly cpfMascarado: string | null;
    readonly ordem: number;
    readonly status: StatusDoSignatario;
    readonly assinadoEm: string | null;
    readonly recusadoEm: string | null;
    readonly tipoAssinatura: 'desenhada' | 'digitada' | null;
    readonly verificacoes: readonly { readonly tipo: TipoDeVerificacao; readonly rotulo: string; readonly pontuacao: number | null; readonly em: string | null }[];
    readonly assinaturaDigital: { readonly valida: boolean; readonly id: string } | null;
  }[];
  readonly linhaDoTempo: readonly { readonly acao: string; readonly resumo: string; readonly em: string; readonly tipoAtor: string; readonly hash: string }[];
}

export const apiDeValidacao = {
  porCodigo: (codigo: string) => http.get<ResultadoDaValidacao>(`/publico/validar/${encodeURIComponent(codigo)}`),
  porHash: (hash: string) => http.get<{ codigo: string; versao: 'original' | 'assinado' }>(`/publico/validar/hash/${hash}`),
  urlDaChave: () => urlDaApi('/publico/chave'),
};

/** SHA-256 de um arquivo, no navegador. O arquivo nunca sai da máquina. */
export async function sha256DoArquivo(arquivo: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await arquivo.arrayBuffer());

  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
