import { createContext, useContext } from 'react';
import type { Perfil, Permissao } from '@/lib/api/sessao';

/**
 * ⚠️ Quatro estados, não dois. "Autenticado com o segundo fator pendente" é um
 * estado real: a API o sinaliza com 403 `MFA_NECESSARIO`, e confundi-lo com 401
 * mandaria a pessoa de volta ao login num laço.
 */
export type EstadoDaSessao =
  | { readonly situacao: 'carregando' }
  | { readonly situacao: 'anonimo' }
  | { readonly situacao: 'precisa-mfa' }
  | { readonly situacao: 'autenticado'; readonly perfil: Perfil };

export interface ValorDaSessao {
  readonly estado: EstadoDaSessao;
  readonly recarregar: () => Promise<void>;
  readonly sair: () => Promise<void>;
}

export const ContextoDaSessao = createContext<ValorDaSessao | null>(null);

export function useSessao(): ValorDaSessao {
  const valor = useContext(ContextoDaSessao);

  if (valor === null) throw new Error('useSessao() fora do SessaoProvider.');

  return valor;
}

/** O perfil de quem está logado. Só use dentro de rota protegida. */
export function usePerfil(): Perfil {
  const { estado } = useSessao();

  if (estado.situacao !== 'autenticado') {
    throw new Error('usePerfil() exige sessão autenticada — use dentro de <RotaProtegida>.');
  }

  return estado.perfil;
}

/**
 * Se a pessoa tem a permissão — **só para decidir o que mostrar**. Esconder um
 * botão não é autorização: a API verifica de novo em toda requisição.
 */
export function usePode(permissao: Permissao): boolean {
  const { estado } = useSessao();

  return estado.situacao === 'autenticado' && estado.perfil.permissoes.includes(permissao);
}
