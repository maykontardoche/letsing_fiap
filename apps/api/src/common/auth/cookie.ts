import type { CookieOptions, Response } from 'express';
import { NOME_DO_COOKIE, VIDA_DA_SESSAO_EM_SEGUNDOS } from './sessao.service';

/**
 * O cookie de sessão.
 *
 * - `httpOnly`: JavaScript não lê — XSS não rouba a sessão;
 * - `sameSite: 'lax'`: navegador não o manda em POST vindo de outro site (CSRF);
 * - `secure` em produção: só trafega em HTTPS.
 */
function opcoes(seguro: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: seguro,
    path: '/',
    maxAge: VIDA_DA_SESSAO_EM_SEGUNDOS * 1000,
  };
}

export function gravarCookieDeSessao(resposta: Response, id: string, seguro: boolean): void {
  resposta.cookie(NOME_DO_COOKIE, id, opcoes(seguro));
}

export function apagarCookieDeSessao(resposta: Response, seguro: boolean): void {
  resposta.clearCookie(NOME_DO_COOKIE, { ...opcoes(seguro), maxAge: undefined });
}
