import { http, urlDaApi } from '@/lib/http';
import type { IdDoPlano } from '@/constants/planos';
import type { Papel } from './sessao';
import type { StatusDoDocumento, TipoDeVerificacao } from './documentos';

// ---- Painel ---------------------------------------------------------------

export interface Painel {
  readonly indicadores: {
    readonly total: number;
    readonly rascunhos: number;
    readonly emAndamento: number;
    readonly concluidos: number;
    readonly encerradosSemConclusao: number;
    readonly taxaDeConclusao: number | null;
    readonly tempoMedioDeConclusaoHoras: number | null;
  };
  readonly porStatus: Partial<Record<StatusDoDocumento, number>>;
  readonly serieMensal: readonly {
    readonly mes: string;
    readonly enviados: number;
    readonly concluidos: number;
  }[];
  readonly verificacoes: Partial<Record<TipoDeVerificacao, number>>;
  readonly cota: {
    readonly usados: number;
    readonly limite: number | null;
    readonly plano: IdDoPlano;
  };
  readonly aguardandoVoce: readonly {
    readonly documento: string;
    readonly titulo: string;
    readonly remetente: string;
    readonly prazo: string | null;
    readonly enviadoEm: string | null;
  }[];
  readonly atividade: readonly {
    readonly acao: string;
    readonly resumo: string;
    readonly em: string;
    readonly documento: { readonly uuid?: string; readonly titulo?: string } | null;
  }[];
}

export const apiDoPainel = { resumo: () => http.get<Painel>('/painel') };

// ---- Equipe ---------------------------------------------------------------

export interface Membro {
  readonly uuid: string;
  readonly nome: string;
  readonly email: string;
  readonly papel: Papel;
  readonly ativo: boolean;
  readonly mfaAtivo: boolean;
  readonly convitePendente: boolean;
  readonly ultimoAcessoEm: string | null;
  readonly criadoEm: string;
}

export const apiDaEquipe = {
  listar: () => http.get<Membro[]>('/equipe'),
  convidar: (dados: { nome: string; email: string; papel: Papel }) =>
    http.post<Membro>('/equipe', dados),
  atualizar: (uuid: string, dados: { papel?: Papel; ativo?: boolean }) =>
    http.patch<Membro>(`/equipe/${uuid}`, dados),
  reenviarConvite: (uuid: string) => http.post<void>(`/equipe/${uuid}/reenviar-convite`),
};

// ---- Auditoria ------------------------------------------------------------

export interface EventoDeAuditoria {
  readonly id: number;
  readonly cadeia: string;
  readonly sequencia: number;
  readonly acao: string;
  readonly resumo: string;
  readonly tipoAtor: 'usuario' | 'signatario' | 'sistema';
  readonly atorNome: string | null;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly criadoEm: string;
  readonly hash: string;
  readonly hashAnterior: string;
  readonly documento: { readonly uuid?: string; readonly titulo?: string } | null;
}

export interface ExameDeIntegridade {
  readonly verificadoEm: string;
  readonly cadeias: number;
  readonly eventos: number;
  readonly integra: boolean;
  readonly quebradas: readonly {
    readonly cadeia: string;
    readonly quebraEm: number | null;
    readonly motivo: string | null;
  }[];
}

export const apiDeAuditoria = {
  listar: (filtro: { acao?: string; q?: string; pagina?: number }) => {
    const busca = new URLSearchParams();

    if (filtro.acao) busca.set('acao', filtro.acao);
    if (filtro.q) busca.set('q', filtro.q);
    if (filtro.pagina && filtro.pagina > 1) busca.set('pagina', String(filtro.pagina));

    return http.get<{
      total: number;
      pagina: number;
      porPagina: number;
      acoes: { acao: string; total: number }[];
      itens: EventoDeAuditoria[];
    }>(`/auditoria${busca.size > 0 ? `?${busca.toString()}` : ''}`);
  },
  integridade: () => http.get<ExameDeIntegridade>('/auditoria/integridade'),
  urlDeExportacao: () => urlDaApi('/auditoria/exportar'),
};

// ---- Organização e "eu" ------------------------------------------------------

export interface DadosDaOrganizacao {
  readonly uuid: string;
  readonly nome: string;
  readonly plano: IdDoPlano;
  readonly criadoEm: string;
  readonly uso: {
    readonly enviadosNoMes: number;
    readonly limiteDeEnvios: number | null;
    readonly membros: number;
    readonly limiteDeMembros: number | null;
  };
}

export interface SessaoAtiva {
  readonly uuid: string;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly criadaEm: string;
  readonly ultimaAtividadeEm: string;
  readonly atual: boolean;
}

export interface Notificacoes {
  readonly naoLidas: number;
  readonly itens: readonly {
    readonly id: number;
    readonly titulo: string;
    readonly mensagem: string;
    readonly link: string | null;
    readonly lida: boolean;
    readonly criadaEm: string;
  }[];
}

export const apiDaConta = {
  organizacao: () => http.get<DadosDaOrganizacao>('/organizacao'),
  atualizarOrganizacao: (dados: { nome?: string; plano?: IdDoPlano }) =>
    http.patch<DadosDaOrganizacao>('/organizacao', dados),
  atualizarPerfil: (nome: string) => http.patch<void>('/me', { nome }),
  trocarSenha: (dados: { senhaAtual: string; novaSenha: string }) =>
    http.post<void>('/me/senha', dados),
  iniciarMfa: () => http.post<{ qrCode: string; segredo: string }>('/me/mfa/iniciar'),
  confirmarMfa: (codigo: string) =>
    http.post<{ codigosDeRecuperacao: string[] }>('/me/mfa/confirmar', { codigo }),
  desativarMfa: (senha: string) => http.post<void>('/me/mfa/desativar', { senha }),
  sessoes: () => http.get<SessaoAtiva[]>('/me/sessoes'),
  revogarSessao: (uuid: string) => http.delete<void>(`/me/sessoes/${uuid}`),
  notificacoes: () => http.get<Notificacoes>('/me/notificacoes'),
  marcarLidas: () => http.post<void>('/me/notificacoes/lidas'),
};
