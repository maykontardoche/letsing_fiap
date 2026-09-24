import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Permissao } from './permissoes';
import { origemDa, type Origem, type RequisicaoAutenticada, type UsuarioAutenticado } from './requisicao';

export const CHAVE_PUBLICO = 'rota-publica';
export const CHAVE_PERMISSOES = 'permissoes-exigidas';
export const CHAVE_SEM_MFA = 'dispensa-mfa';

/**
 * Rota sem sessão. ⚠️ O padrão é **fechado**: toda rota exige sessão, exceto as
 * marcadas aqui. Esquecer de proteger produz 401, não uma rota aberta.
 */
export const Publico = () => SetMetadata(CHAVE_PUBLICO, true);

/** Exige **alguma** das permissões listadas. */
export const ExigePermissao = (...permissoes: Permissao[]) =>
  SetMetadata(CHAVE_PERMISSOES, permissoes);

/**
 * Rota autenticada que **não** cobra o segundo fator — só as do próprio fluxo
 * de MFA e o logout. Sem isso, quem está no meio do desafio nunca conseguiria
 * respondê-lo.
 */
export const DispensaMfa = () => SetMetadata(CHAVE_SEM_MFA, true);

/** O usuário da sessão. Só em rota protegida — o guard garante que existe. */
export const UsuarioAtual = createParamDecorator(
  (_dado: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    const requisicao = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();

    if (requisicao.usuario === undefined) {
      throw new Error('@UsuarioAtual() usado em rota sem sessão.');
    }

    return requisicao.usuario;
  },
);

/** IP e user agent, para a trilha de auditoria. */
export const OrigemDaRequisicao = createParamDecorator(
  (_dado: unknown, contexto: ExecutionContext): Origem =>
    origemDa(contexto.switchToHttp().getRequest<RequisicaoAutenticada>()),
);
