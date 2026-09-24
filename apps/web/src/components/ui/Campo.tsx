import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

const ESTILO_DO_CONTROLE = cn(
  'border-linha bg-superficie text-tinta placeholder:text-tinta-3 w-full rounded-[var(--radius-controle)] border px-3.5 text-sm',
  'shadow-[inset_0_1px_1px_rgb(15_22_41/0.03)] transition',
  'hover:border-linha-forte focus:border-destaque focus:ring-destaque/15 focus:ring-4 focus:outline-none',
  'disabled:bg-superficie-2 disabled:cursor-not-allowed disabled:opacity-60',
  'aria-[invalid=true]:border-perigo aria-[invalid=true]:focus:ring-perigo/15',
);

interface PropsDoCampo {
  readonly rotulo: string;
  readonly erro?: string;
  readonly dica?: ReactNode;
  readonly opcional?: boolean;
  readonly className?: string;
  /** Um único controle (`<Entrada>`, `<Seletor>`…). Recebe `id` e os `aria-*` daqui. */
  readonly children: ReactElement<Record<string, unknown>>;
}

/**
 * Rótulo + controle + dica + erro, ligados por `id` e `aria-*`.
 *
 * ⚠️ O erro é anunciado por `aria-describedby` e marcado com `aria-invalid`: quem
 * usa leitor de tela ouve o motivo ao focar o campo, não só vê uma borda vermelha.
 */
export function Campo({ rotulo, erro, dica, opcional = false, className, children }: PropsDoCampo) {
  const id = useId();
  const idDaDica = `${id}-dica`;
  const idDoErro = `${id}-erro`;
  const descritores =
    [dica ? idDaDica : null, erro ? idDoErro : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={id}
        className="text-tinta flex items-center justify-between text-sm font-medium"
      >
        {rotulo}
        {opcional && <span className="text-tinta-3 text-xs font-normal">opcional</span>}
      </label>
      {isValidElement(children)
        ? cloneElement(children, {
            id,
            'aria-invalid': erro ? true : undefined,
            'aria-describedby': descritores,
          })
        : children}
      {dica && !erro && (
        <p id={idDaDica} className="text-tinta-3 text-xs">
          {dica}
        </p>
      )}
      {erro && (
        <p
          id={idDoErro}
          role="alert"
          className="text-perigo-tinta flex items-center gap-1.5 text-xs font-medium"
        >
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {erro}
        </p>
      )}
    </div>
  );
}

interface PropsDaEntrada extends InputHTMLAttributes<HTMLInputElement> {
  readonly icone?: ReactNode;
  readonly acessorio?: ReactNode;
}

export const Entrada = forwardRef<HTMLInputElement, PropsDaEntrada>(function Entrada(
  { className, icone, acessorio, ...resto },
  ref,
) {
  if (icone === undefined && acessorio === undefined) {
    return <input ref={ref} className={cn(ESTILO_DO_CONTROLE, 'h-11', className)} {...resto} />;
  }

  return (
    <div className="relative">
      {icone && (
        <span
          className="text-tinta-3 pointer-events-none absolute inset-y-0 left-3.5 flex items-center [&_svg]:size-4"
          aria-hidden="true"
        >
          {icone}
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          ESTILO_DO_CONTROLE,
          'h-11',
          icone && 'pl-10',
          acessorio && 'pr-11',
          className,
        )}
        {...resto}
      />
      {acessorio && (
        <span className="absolute inset-y-0 right-1.5 flex items-center">{acessorio}</span>
      )}
    </div>
  );
});

export const AreaDeTexto = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function AreaDeTexto({ className, rows = 4, ...resto }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(ESTILO_DO_CONTROLE, 'resize-y py-2.5 leading-relaxed', className)}
      {...resto}
    />
  );
});

export const Seletor = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Seletor({ className, children, ...resto }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          ESTILO_DO_CONTROLE,
          'h-11 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.85rem_center] bg-no-repeat pr-10',
          "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7390' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")]",
          className,
        )}
        {...resto}
      >
        {children}
      </select>
    );
  },
);
