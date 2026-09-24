import { http } from '@/lib/http';
import type { IdDoPlano } from '@/constants/planos';

export type Papel = 'proprietario' | 'administrador' | 'membro' | 'auditor';

export type Permissao =
  | 'documentos.criar'
  | 'documentos.ver_todos'
  | 'documentos.gerenciar_todos'
  | 'equipe.ver'
  | 'equipe.gerenciar'
  | 'auditoria.ver'
  | 'organizacao.gerenciar';

export interface Perfil {
  readonly uuid: string;
  readonly nome: string;
  readonly email: string;
  readonly papel: Papel;
  /** ⚠️ Vem do servidor, já calculada. Serve só para decidir o que MOSTRAR — quem autoriza é a API. */
  readonly permissoes: readonly Permissao[];
  readonly mfaAtivo: boolean;
  readonly organizacao: {
    readonly uuid: string;
    readonly nome: string;
    readonly plano: IdDoPlano;
  };
}

export interface RespostaDeEntrada {
  readonly precisaMfa: boolean;
}

export const apiDeSessao = {
  perfil: () => http.get<Perfil>('/me'),
  entrar: (dados: { email: string; senha: string }) =>
    http.post<RespostaDeEntrada>('/auth/entrar', dados),
  cadastrar: (dados: { nomeOrganizacao: string; nome: string; email: string; senha: string; plano?: IdDoPlano }) =>
    http.post<void>('/auth/cadastro', dados),
  desafioMfa: (codigo: string) => http.post<void>('/auth/mfa', { codigo }),
  sair: () => http.post<void>('/auth/sair'),
  esqueciSenha: (email: string) => http.post<void>('/auth/esqueci-senha', { email }),
  redefinirSenha: (dados: { token: string; senha: string }) =>
    http.post<void>('/auth/redefinir-senha', dados),
};

export const ROTULO_DO_PAPEL: Record<Papel, string> = {
  proprietario: 'Proprietário',
  administrador: 'Administrador',
  membro: 'Membro',
  auditor: 'Auditor',
};
