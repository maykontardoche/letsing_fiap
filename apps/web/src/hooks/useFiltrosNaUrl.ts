import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface Filtros {
  readonly q: string;
  readonly status: string | null;
  readonly ordenar: string;
  readonly dir: 'asc' | 'desc';
  readonly pagina: number;
}

const PADRAO: Filtros = { q: '', status: null, ordenar: 'criadoEm', dir: 'desc', pagina: 1 };

/**
 * Filtro, busca, ordenação e página **na URL**.
 *
 * Quem usa a ferramenta precisa recarregar, voltar e mandar link sem perder a
 * visão — "veja estes documentos pendentes" precisa ser um link.
 *
 * ⚠️ URL é entrada do usuário: valor inválido cai no padrão, nunca derruba a
 * tela. E **mudar qualquer filtro volta para a página 1** — sem isso, filtrar
 * estando na página 7 mostraria uma tela vazia, lida como "não há nada".
 */
export function useFiltrosNaUrl(opcoes: { readonly statusValidos: readonly string[]; readonly ordenacoesValidas: readonly string[] }) {
  const [parametros, definirParametros] = useSearchParams();

  const filtros = useMemo<Filtros>(() => {
    const status = parametros.get('status');
    const ordenar = parametros.get('ordenar');
    const pagina = Number(parametros.get('pagina'));

    return {
      q: (parametros.get('q') ?? '').slice(0, 100),
      status: status !== null && opcoes.statusValidos.includes(status) ? status : null,
      ordenar: ordenar !== null && opcoes.ordenacoesValidas.includes(ordenar) ? ordenar : PADRAO.ordenar,
      dir: parametros.get('dir') === 'asc' ? 'asc' : 'desc',
      pagina: Number.isInteger(pagina) && pagina >= 1 && pagina <= 10_000 ? pagina : 1,
    };
  }, [parametros, opcoes.statusValidos, opcoes.ordenacoesValidas]);

  const mudar = useCallback(
    (mudanca: Partial<Filtros>) => {
      const proximo = { ...filtros, ...mudanca, ...(mudanca.pagina === undefined ? { pagina: 1 } : {}) };
      const busca = new URLSearchParams();

      if (proximo.q) busca.set('q', proximo.q);
      if (proximo.status) busca.set('status', proximo.status);
      if (proximo.ordenar !== PADRAO.ordenar) busca.set('ordenar', proximo.ordenar);
      if (proximo.dir !== PADRAO.dir) busca.set('dir', proximo.dir);
      if (proximo.pagina !== 1) busca.set('pagina', String(proximo.pagina));

      definirParametros(busca, { replace: mudanca.q !== undefined });
    },
    [filtros, definirParametros],
  );

  return { filtros, mudar };
}
