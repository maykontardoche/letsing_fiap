import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type VarianteDeBotao =
  | 'primario'
  | 'secundario'
  | 'fantasma'
  | 'perigo'
  | 'claro'
  | 'vidro';
export type TamanhoDeBotao = 'sm' | 'md' | 'lg';

const VARIANTES: Record<VarianteDeBotao, string> = {
  // ⚠️ `-texto`: o gradiente de marca original não sustenta texto branco na ponta ciano.
  primario:
    'bg-gradiente-marca-texto text-white shadow-brilho hover:brightness-110 active:brightness-95',
  secundario:
    'border border-linha bg-superficie text-tinta shadow-cartao hover:border-linha-forte hover:bg-superficie-2',
  fantasma: 'text-tinta-2 hover:bg-superficie-2 hover:text-tinta',
  perigo: 'bg-perigo-tinta text-white hover:brightness-110 dark:bg-red-600',
  // Para superfícies escuras (landing).
  claro: 'bg-white text-noite-900 shadow-elevada hover:bg-brand-50',
  vidro:
    'border border-white/15 bg-white/5 text-white backdrop-blur hover:border-white/30 hover:bg-white/10',
};

const TAMANHOS: Record<TamanhoDeBotao, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-10 gap-2 rounded-[var(--radius-controle)] px-4 text-sm',
  lg: 'h-12 gap-2.5 rounded-[var(--radius-controle)] px-6 text-base',
};

/**
 * As classes do botão, para aplicar em outro elemento (ex.: `<Link>`).
 * Uma fonte só: o link com cara de botão não diverge do botão.
 */
export function estilosDeBotao(
  variante: VarianteDeBotao = 'primario',
  tamanho: TamanhoDeBotao = 'md',
): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap',
    'transition-all duration-200 select-none',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTES[variante],
    TAMANHOS[tamanho],
  );
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variante?: VarianteDeBotao;
  readonly tamanho?: TamanhoDeBotao;
  /** Mostra o indicador e bloqueia o clique — impede o envio duplo. */
  readonly carregando?: boolean;
  readonly icone?: ReactNode;
  readonly children?: ReactNode;
}

/**
 * O botão do design system. Variante errada é **erro de tipo**, não divergência
 * silenciosa entre duas telas.
 */
export function Botao({
  variante = 'primario',
  tamanho = 'md',
  carregando = false,
  icone,
  className,
  children,
  disabled,
  type = 'button',
  ...resto
}: Props) {
  return (
    <button
      // `type="button"` por padrão: dentro de <form>, sem isto, todo botão envia.
      type={type}
      disabled={disabled === true || carregando}
      aria-busy={carregando || undefined}
      className={cn(estilosDeBotao(variante, tamanho), className)}
      {...resto}
    >
      {carregando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : icone}
      {children}
    </button>
  );
}
