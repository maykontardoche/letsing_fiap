import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Iniciais sobre um degradê derivado do nome — a mesma pessoa tem sempre a mesma cor. */
const DEGRADES = [
  'from-brand-500 to-violeta-600',
  'from-ciano-500 to-brand-500',
  'from-violeta-500 to-fuchsia-500',
  'from-emerald-500 to-ciano-500',
  'from-amber-500 to-rose-500',
  'from-sky-500 to-indigo-500',
];

export function Avatar({
  nome,
  tamanho = 'md',
  className,
}: {
  readonly nome: string;
  readonly tamanho?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}) {
  const partes = nome.trim().split(/\s+/);
  const iniciais =
    `${partes[0]?.[0] ?? ''}${partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : ''}`.toUpperCase();
  const indice = [...nome].reduce((soma, c) => soma + c.charCodeAt(0), 0) % DEGRADES.length;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white',
        DEGRADES[indice],
        { sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-12 text-sm' }[tamanho],
        className,
      )}
    >
      {iniciais || '?'}
    </span>
  );
}

interface PropsDaPaginacao {
  readonly pagina: number;
  readonly porPagina: number;
  readonly total: number;
  readonly aoMudar: (pagina: number) => void;
}

export function Paginacao({ pagina, porPagina, total, aoMudar }: PropsDaPaginacao) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));

  if (total === 0) return null;

  const inicio = (pagina - 1) * porPagina + 1;
  const fim = Math.min(total, pagina * porPagina);

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-4 pt-4">
      <p className="text-tinta-3 text-sm numeros">
        {inicio}–{fim} de {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={pagina <= 1}
          onClick={() => aoMudar(pagina - 1)}
          aria-label="Página anterior"
          className="text-tinta-2 hover:bg-superficie-2 rounded-lg p-2 transition disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-tinta-2 px-2 text-sm numeros">
          {pagina} / {paginas}
        </span>
        <button
          type="button"
          disabled={pagina >= paginas}
          onClick={() => aoMudar(pagina + 1)}
          aria-label="Próxima página"
          className="text-tinta-2 hover:bg-superficie-2 rounded-lg p-2 transition disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}

interface Aba<T extends string> {
  readonly id: T;
  readonly rotulo: string;
  readonly contagem?: number;
  readonly icone?: ReactNode;
}

/** Abas como controle segmentado. Navegáveis por teclado (são botões num tablist). */
export function Abas<T extends string>({
  abas,
  ativa,
  aoMudar,
  rotulo,
}: {
  readonly abas: readonly Aba<T>[];
  readonly ativa: T;
  readonly aoMudar: (id: T) => void;
  readonly rotulo: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={rotulo}
      className="bg-superficie-2 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl p-1"
    >
      {abas.map((aba) => (
        <button
          key={aba.id}
          type="button"
          role="tab"
          aria-selected={aba.id === ativa}
          onClick={() => aoMudar(aba.id)}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition [&_svg]:size-4',
            aba.id === ativa
              ? 'bg-superficie text-tinta shadow-cartao'
              : 'text-tinta-2 hover:text-tinta',
          )}
        >
          {aba.icone}
          {aba.rotulo}
          {aba.contagem !== undefined && (
            <span
              className={cn(
                'rounded-full px-1.5 text-xs numeros',
                aba.id === ativa
                  ? 'bg-destaque-suave text-destaque-tinta'
                  : 'bg-superficie-3 text-tinta-3',
              )}
            >
              {aba.contagem}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function BarraDeProgresso({
  valor,
  rotulo,
  className,
}: {
  readonly valor: number;
  readonly rotulo: string;
  readonly className?: string;
}) {
  const porcentagem = Math.round(Math.max(0, Math.min(1, valor)) * 100);

  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuenow={porcentagem}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('bg-superficie-3 h-1.5 overflow-hidden rounded-full', className)}
    >
      <div
        className="bg-gradiente-marca h-full rounded-full transition-all duration-700"
        style={{ width: `${porcentagem}%` }}
      />
    </div>
  );
}

/** Texto de hash/código monoespaçado, que quebra em qualquer ponto. */
export function Hash({
  valor,
  className,
}: {
  readonly valor: string;
  readonly className?: string;
}) {
  return (
    <code className={cn('text-destaque-tinta font-mono text-xs break-all', className)}>
      {valor}
    </code>
  );
}
