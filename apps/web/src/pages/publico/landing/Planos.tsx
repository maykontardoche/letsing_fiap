import { Link } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import { estilosDeBotao } from '@/components/ui/Botao';
import { PLANOS } from '@/constants/planos';
import { cn } from '@/lib/cn';

export function Planos() {
  return (
    <section
      id="planos"
      className="bg-superficie border-linha scroll-mt-20 border-y py-24 sm:py-32"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-destaque text-sm font-semibold tracking-wider uppercase">Planos</p>
          <h2 className="text-tinta mt-3 text-3xl font-extrabold sm:text-4xl">
            Comece grátis. Cresça sem trocar de ferramenta.
          </h2>
          <p className="text-tinta-2 mt-4 text-lg">
            Todos os planos incluem biometria, criptografia, trilha de auditoria e validação
            pública. A diferença é o volume.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-6 lg:grid-cols-3">
          {PLANOS.map((plano) => (
            <article
              key={plano.id}
              className={cn(
                'relative flex flex-col rounded-[var(--radius-cartao)] border p-8',
                plano.destaque
                  ? 'bg-noite-900 borda-gradiente border-transparent text-white shadow-elevada lg:-my-4 lg:py-12'
                  : 'border-linha bg-fundo',
              )}
            >
              {plano.destaque && (
                <span className="bg-gradiente-marca-texto absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-white">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Mais escolhido
                </span>
              )}

              <h3 className={cn('text-lg font-bold', plano.destaque ? 'text-white' : 'text-tinta')}>
                {plano.nome}
              </h3>
              <p className={cn('mt-1 text-sm', plano.destaque ? 'text-white/60' : 'text-tinta-3')}>
                {plano.publico}
              </p>

              <p className="mt-6 flex items-baseline gap-1">
                <span
                  className={cn(
                    'font-display text-4xl font-extrabold',
                    plano.destaque ? 'text-white' : 'text-tinta',
                  )}
                >
                  {plano.preco}
                </span>
                {plano.periodo && (
                  <span className={plano.destaque ? 'text-white/60' : 'text-tinta-3'}>
                    {plano.periodo}
                  </span>
                )}
              </p>

              <ul className="mt-8 flex-1 space-y-3">
                {plano.recursos.map((recurso) => (
                  <li key={recurso} className="flex items-start gap-3 text-sm">
                    <Check
                      className={cn(
                        'mt-0.5 size-4 shrink-0',
                        plano.destaque ? 'text-ciano-300' : 'text-destaque',
                      )}
                      aria-hidden="true"
                    />
                    <span className={plano.destaque ? 'text-white/85' : 'text-tinta-2'}>
                      {recurso}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                to={`/cadastro?plano=${plano.id}`}
                className={cn(
                  estilosDeBotao(plano.destaque ? 'claro' : 'secundario', 'lg'),
                  'mt-10 w-full',
                )}
              >
                {plano.chamada}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
