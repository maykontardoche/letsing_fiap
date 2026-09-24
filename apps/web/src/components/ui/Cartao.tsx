import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  /** Remove o preenchimento interno (tabelas, listas que vão até a borda). */
  readonly semPreenchimento?: boolean;
}

export function Cartao({ className, children, semPreenchimento = false, ...resto }: Props) {
  return (
    <div
      className={cn(
        'border-linha bg-superficie shadow-cartao rounded-[var(--radius-cartao)] border',
        !semPreenchimento && 'p-5 sm:p-6',
        className,
      )}
      {...resto}
    >
      {children}
    </div>
  );
}

interface CabecalhoProps {
  readonly titulo: ReactNode;
  readonly descricao?: ReactNode;
  readonly acoes?: ReactNode;
  readonly className?: string;
}

export function CabecalhoDoCartao({ titulo, descricao, acoes, className }: CabecalhoProps) {
  return (
    <div className={cn('mb-5 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-tinta text-base font-semibold">{titulo}</h2>
        {descricao !== undefined && <p className="text-tinta-3 mt-0.5 text-sm">{descricao}</p>}
      </div>
      {acoes !== undefined && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </div>
  );
}
