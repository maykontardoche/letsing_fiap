import { useEffect, type RefObject } from 'react';

const FOCAVEIS =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Opcoes {
  readonly ativo: boolean;
  readonly aoFechar: () => void;
  readonly container: RefObject<HTMLElement | null>;
}

/**
 * Foco preso num diálogo — WCAG 2.2, critérios 2.1.2 e 2.4.3.
 *
 * 1. Ao abrir, o foco vai para o primeiro controle do diálogo.
 * 2. `Tab` e `Shift+Tab` circulam **dentro** dele — sem isto, quem usa teclado
 *    sai do modal e passa a operar a página escondida atrás.
 * 3. `Esc` fecha.
 * 4. Ao fechar, o foco **volta para quem abriu**. Sem isto, ele cai no `<body>`
 *    e a pessoa perde o lugar na página.
 */
export function useFocoPreso({ ativo, aoFechar, container }: Opcoes): void {
  useEffect(() => {
    if (!ativo) return undefined;

    const gatilho = document.activeElement as HTMLElement | null;
    const elemento = container.current;
    const focaveis = () => [...(elemento?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? [])];

    (focaveis()[0] ?? elemento)?.focus();

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.stopPropagation();
        aoFechar();
        return;
      }

      if (evento.key !== 'Tab') return;

      const lista = focaveis();
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];

      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo?.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro?.focus();
      }
    };

    document.addEventListener('keydown', aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAnterior;
      gatilho?.focus();
    };
  }, [ativo, aoFechar, container]);
}
