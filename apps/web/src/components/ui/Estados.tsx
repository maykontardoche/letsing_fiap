import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, XCircle } from 'lucide-react';
import { mensagemDoErro } from '@/lib/erros';
import { cn } from '@/lib/cn';
import { Botao } from './Botao';

/**
 * Os quatro estados obrigatórios de toda tela que busca dados:
 * **carregando** (esqueleto com a forma do conteúdo), **erro** (com tentar de
 * novo), **vazio** (dizendo o que fazer) e conteúdo.
 */

export function Esqueleto({ className }: { readonly className?: string }) {
  return <div aria-hidden="true" className={cn('esqueleto rounded-lg', className)} />;
}

/** Bloco de esqueletos com rótulo acessível — leitor de tela ouve "Carregando…". */
export function Carregando({
  children,
  rotulo = 'Carregando…',
}: {
  readonly children: ReactNode;
  readonly rotulo?: string;
}) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{rotulo}</span>
      {children}
    </div>
  );
}

interface PropsDoVazio {
  readonly icone: ReactNode;
  readonly titulo: string;
  readonly descricao: string;
  readonly acao?: ReactNode;
  readonly className?: string;
}

export function EstadoVazio({ icone, titulo, descricao, acao, className }: PropsDoVazio) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <span className="bg-destaque-suave text-destaque mb-5 flex size-14 items-center justify-center rounded-2xl [&_svg]:size-7">
        {icone}
      </span>
      <h3 className="text-tinta text-base font-semibold">{titulo}</h3>
      <p className="text-tinta-2 mt-1.5 max-w-sm text-sm">{descricao}</p>
      {acao && <div className="mt-6">{acao}</div>}
    </div>
  );
}

export function EstadoDeErro({
  erro,
  aoTentarDeNovo,
  className,
}: {
  readonly erro: unknown;
  readonly aoTentarDeNovo?: () => void;
  readonly className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center px-6 py-14 text-center', className)}
    >
      <span className="bg-perigo-suave text-perigo-tinta mb-5 flex size-14 items-center justify-center rounded-2xl">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </span>
      <h3 className="text-tinta text-base font-semibold">Não foi possível carregar</h3>
      <p className="text-tinta-2 mt-1.5 max-w-sm text-sm">{mensagemDoErro(erro)}</p>
      {aoTentarDeNovo && (
        <Botao
          variante="secundario"
          className="mt-6"
          icone={<RefreshCw className="size-4" />}
          onClick={aoTentarDeNovo}
        >
          Tentar de novo
        </Botao>
      )}
    </div>
  );
}

type TomDoAlerta = 'info' | 'sucesso' | 'alerta' | 'perigo';

const ALERTAS: Record<TomDoAlerta, { classe: string; icone: ReactNode }> = {
  info: {
    classe: 'border-destaque/20 bg-destaque-suave text-destaque-tinta',
    icone: <Info aria-hidden="true" />,
  },
  sucesso: {
    classe: 'border-sucesso/25 bg-sucesso-suave text-sucesso-tinta',
    icone: <CheckCircle2 aria-hidden="true" />,
  },
  alerta: {
    classe: 'border-alerta/30 bg-alerta-suave text-alerta-tinta',
    icone: <AlertTriangle aria-hidden="true" />,
  },
  perigo: {
    classe: 'border-perigo/25 bg-perigo-suave text-perigo-tinta',
    icone: <XCircle aria-hidden="true" />,
  },
};

export function Alerta({
  tom = 'info',
  titulo,
  children,
  className,
}: {
  readonly tom?: TomDoAlerta;
  readonly titulo?: string;
  readonly children?: ReactNode;
  readonly className?: string;
}) {
  const { classe, icone } = ALERTAS[tom];

  return (
    <div
      role={tom === 'perigo' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-2xl border p-4 text-sm', classe, className)}
    >
      <span className="mt-0.5 shrink-0 [&_svg]:size-5">{icone}</span>
      <div className="min-w-0 space-y-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className="leading-relaxed opacity-95">{children}</div>}
      </div>
    </div>
  );
}
