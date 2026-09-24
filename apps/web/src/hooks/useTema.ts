import { useCallback, useSyncExternalStore } from 'react';

export type Tema = 'claro' | 'escuro';

const CHAVE = 'letssign:tema';

function lerTema(): Tema {
  return document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro';
}

/**
 * O `data-tema` do `<html>` é a fonte da verdade — ele é aplicado por um script
 * inline no `index.html` antes do primeiro paint, para a página não piscar.
 * Este hook só observa e altera esse atributo.
 */
function assinar(aoMudar: () => void): () => void {
  const observador = new MutationObserver(aoMudar);

  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });

  return () => observador.disconnect();
}

export function useTema() {
  const tema = useSyncExternalStore(assinar, lerTema, () => 'claro' as Tema);

  const definirTema = useCallback((novo: Tema) => {
    document.documentElement.dataset.tema = novo;

    try {
      // Preferência de exibição — não é dado sensível, pode ir para o storage.
      localStorage.setItem(CHAVE, novo);
    } catch {
      // Navegação privada pode bloquear o storage; o tema só não persiste.
    }
  }, []);

  const alternar = useCallback(
    () => definirTema(lerTema() === 'escuro' ? 'claro' : 'escuro'),
    [definirTema],
  );

  return { tema, definirTema, alternar };
}
