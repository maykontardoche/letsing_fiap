import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocoPreso } from '@/hooks/useFocoPreso';
import { cn } from '@/lib/cn';

interface Props {
  readonly aberto: boolean;
  readonly aoFechar: () => void;
  readonly titulo: string;
  readonly descricao?: string;
  readonly children?: ReactNode;
  readonly rodape?: ReactNode;
  readonly largura?: 'estreita' | 'media' | 'larga';
}

const LARGURAS = { estreita: 'max-w-md', media: 'max-w-lg', larga: 'max-w-3xl' } as const;

/**
 * O modal do sistema.
 *
 * ⚠️ Vai num portal no `<body>`: renderizado no lugar, herdaria `overflow` e
 * `z-index` do ancestral, e um `overflow: hidden` qualquer o cortaria ao meio.
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  rodape,
  largura = 'media',
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const idDoTitulo = useId();
  const idDaDescricao = useId();

  useFocoPreso({ ativo: aberto, aoFechar, container });

  if (!aberto) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        aria-hidden="true"
        className="animate-surgir absolute inset-0 bg-noite-950/60 backdrop-blur-sm"
        onClick={aoFechar}
      />

      <div
        ref={container}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idDoTitulo}
        aria-describedby={descricao ? idDaDescricao : undefined}
        tabIndex={-1}
        className={cn(
          'animate-surgir border-linha bg-superficie shadow-elevada relative w-full rounded-[var(--radius-cartao)] border',
          'rolagem-fina max-h-[90dvh] overflow-y-auto',
          LARGURAS[largura],
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 id={idDoTitulo} className="text-tinta text-lg font-bold">
              {titulo}
            </h2>
            {descricao && (
              <p id={idDaDescricao} className="text-tinta-2 mt-1 text-sm">
                {descricao}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="text-tinta-3 hover:bg-superficie-2 hover:text-tinta -mt-1 -mr-2 rounded-lg p-1.5 transition"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        {children !== undefined && <div className="px-6 pt-5 pb-6">{children}</div>}

        {rodape !== undefined && (
          <div className="border-linha bg-superficie-2/60 flex flex-col-reverse gap-2 rounded-b-[var(--radius-cartao)] border-t px-6 py-4 sm:flex-row sm:justify-end">
            {rodape}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
