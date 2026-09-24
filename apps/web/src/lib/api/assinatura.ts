import { http, urlDaApi } from '@/lib/http';
import type { NivelDeVerificacao, StatusDoDocumento, StatusDoSignatario, TipoDeVerificacao } from './documentos';

export interface SessaoDeAssinatura {
  readonly documento: {
    readonly uuid: string;
    readonly titulo: string;
    readonly mensagem: string | null;
    readonly codigo: string;
    readonly paginas: number;
    readonly hashOriginal: string;
    readonly status: StatusDoDocumento;
    readonly nivelVerificacao: NivelDeVerificacao;
    readonly ordemSequencial: boolean;
    readonly prazo: string | null;
    readonly organizacao: string;
    readonly remetente: string;
    readonly temPdfAssinado: boolean;
  };
  readonly signatario: {
    readonly uuid: string;
    readonly nome: string;
    readonly email: string;
    readonly emailMascarado: string;
    readonly status: StatusDoSignatario;
    readonly assinadoEm: string | null;
    readonly cpfInformado: boolean;
  };
  readonly ehSuaVez: boolean;
  readonly verificacoes: readonly { readonly tipo: TipoDeVerificacao; readonly aprovada: boolean }[];
  readonly participantes: readonly { readonly nome: string; readonly ordem: number; readonly status: StatusDoSignatario; readonly voce: boolean }[];
}

export type Gesto = 'Open_Palm' | 'Closed_Fist' | 'Pointing_Up' | 'Thumb_Up' | 'Victory';
export type AcaoDeVivacidade = 'piscar' | 'virar_esquerda' | 'virar_direita';

export interface MedicaoFacial {
  readonly acoes: AcaoDeVivacidade[];
  readonly quadrosAnalisados: number;
  readonly quadrosComRosto: number;
  readonly confiancaMedia: number;
  readonly rostosMultiplos: boolean;
}

interface Desafio {
  readonly desafio: string;
  readonly expiraEm: string;
}

/** A API do fluxo público de assinatura. O token do link é a credencial. */
export function apiDeAssinatura(token: string) {
  const base = `/assinatura/${encodeURIComponent(token)}`;

  return {
    sessao: () => http.get<SessaoDeAssinatura>(base),
    urlDoArquivo: (versao: 'original' | 'assinado', baixar = false) =>
      urlDaApi(`${base}/arquivo?versao=${versao}${baixar ? '&baixar=1' : ''}`),

    iniciarCodigo: () => http.post<Desafio & { enviadoPara: string }>(`${base}/verificacoes/codigo_email/iniciar`),
    concluirCodigo: (desafio: string, codigo: string) =>
      http.post<{ aprovado: boolean }>(`${base}/verificacoes/codigo_email/concluir`, { desafio, codigo }),

    iniciarFacial: () => http.post<Desafio & { acoes: AcaoDeVivacidade[] }>(`${base}/verificacoes/facial/iniciar`),
    concluirFacial: (desafio: string, medicao: MedicaoFacial) =>
      http.post<{ aprovado: boolean; pontuacao: number }>(`${base}/verificacoes/facial/concluir`, { desafio, medicao }),

    iniciarVoz: () => http.post<Desafio & { palavras: string[] }>(`${base}/verificacoes/voz/iniciar`),
    concluirVoz: (desafio: string, transcricao: string) =>
      http.post<{ aprovado: boolean; pontuacao: number }>(`${base}/verificacoes/voz/concluir`, { desafio, transcricao }),

    iniciarGestos: () => http.post<Desafio & { sequencia: Gesto[] }>(`${base}/verificacoes/gestos/iniciar`),
    concluirGestos: (desafio: string, gestos: Gesto[], confiancas: number[]) =>
      http.post<{ aprovado: boolean; pontuacao: number }>(`${base}/verificacoes/gestos/concluir`, { desafio, gestos, confiancas }),

    assinar: (dados: { tipo: 'desenhada' | 'digitada'; imagem: string; aceite: true; cpf?: string }) =>
      http.post<{ concluido: boolean }>(`${base}/assinar`, dados),
    recusar: (motivo: string) => http.post<void>(`${base}/recusar`, { motivo }),
  };
}

export type ApiDeAssinatura = ReturnType<typeof apiDeAssinatura>;
