import { cn } from '@/lib/cn';

interface Props {
  readonly className?: string;
  /** `claro` para superfícies escuras (landing, painel de autenticação). */
  readonly tom?: 'padrao' | 'claro';
  readonly semTexto?: boolean;
}

/** O monograma: uma rubrica sobre a linha de assinatura. */
export function Monograma({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-8', className)} aria-hidden="true">
      <defs>
        <linearGradient id="letssign-monograma" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="0.55" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#letssign-monograma)" />
      <path
        d="M14 40c6-2 9-12 12-12s1 10 5 10 5-14 9-14 2 12 6 12c2 0 3-1 4-2"
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 48h36" stroke="#fff" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, tom = 'padrao', semTexto = false }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Monograma />
      {!semTexto && (
        <span
          className={cn(
            'font-display text-lg font-extrabold tracking-tight',
            tom === 'claro' ? 'text-white' : 'text-tinta',
          )}
        >
          Lets<span className={tom === 'claro' ? 'text-brand-300' : 'text-destaque'}>Sign</span>
        </span>
      )}
    </span>
  );
}
