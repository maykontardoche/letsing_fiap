import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

const ETAPAS = ['Arquivo', 'Signatários', 'Verificação e prazo', 'Revisar e enviar'] as const;

/** O indicador de etapas do envio. `aria-current` marca onde a pessoa está. */
export function EtapasDoEnvio({ atual }: { readonly atual: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="mb-8 grid grid-cols-4 gap-2" aria-label="Etapas do envio">
      {ETAPAS.map((rotulo, indice) => {
        const numero = indice + 1;
        const feita = numero < atual;
        const ativa = numero === atual;

        return (
          <li
            key={rotulo}
            aria-current={ativa ? 'step' : undefined}
            className="flex flex-col gap-2"
          >
            <span
              className={cn(
                'h-1.5 rounded-full transition-colors',
                feita || ativa ? 'bg-gradiente-marca' : 'bg-superficie-3',
              )}
            />
            <span
              className={cn(
                'flex items-center gap-1.5 text-xs font-medium sm:text-sm',
                ativa ? 'text-tinta' : feita ? 'text-destaque-tinta' : 'text-tinta-3',
              )}
            >
              {feita && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
              <span className="hidden sm:inline">{numero}.</span>{' '}
              <span className="truncate">{rotulo}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
