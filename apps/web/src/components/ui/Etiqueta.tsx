import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type TomDeEtiqueta = 'sucesso' | 'alerta' | 'perigo' | 'info' | 'neutro';

const TONS: Record<TomDeEtiqueta, string> = {
  sucesso: 'bg-sucesso-suave text-sucesso-tinta ring-sucesso/20',
  alerta: 'bg-alerta-suave text-alerta-tinta ring-alerta/25',
  perigo: 'bg-perigo-suave text-perigo-tinta ring-perigo/20',
  info: 'bg-destaque-suave text-destaque-tinta ring-destaque/20',
  neutro: 'bg-neutro-suave text-neutro-tinta ring-linha-forte/40',
};

interface Props {
  readonly tom: TomDeEtiqueta;
  readonly children: ReactNode;
  /** ⚠️ Status nunca só por cor: a etiqueta de status leva ícone + rótulo. */
  readonly icone?: ReactNode;
  readonly className?: string;
}

export function Etiqueta({ tom, children, icone, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        '[&_svg]:size-3.5',
        TONS[tom],
        className,
      )}
    >
      {icone}
      {children}
    </span>
  );
}
