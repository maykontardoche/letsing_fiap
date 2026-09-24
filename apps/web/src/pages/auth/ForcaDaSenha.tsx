import { Check, X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Os requisitos da senha — **os mesmos** que o servidor exige
 * (`apps/api/src/common/cripto/senha.ts`). O cliente mostra ao vivo; quem recusa
 * de verdade é o servidor.
 */
export const REQUISITOS_DA_SENHA = [
  { rotulo: 'Pelo menos 10 caracteres', teste: (s: string) => s.length >= 10 },
  { rotulo: 'Uma letra minúscula', teste: (s: string) => /[a-z]/.test(s) },
  { rotulo: 'Uma letra maiúscula', teste: (s: string) => /[A-Z]/.test(s) },
  { rotulo: 'Um número', teste: (s: string) => /\d/.test(s) },
  { rotulo: 'Um símbolo (!@#$…)', teste: (s: string) => /[^A-Za-z0-9]/.test(s) },
] as const;

export function senhaAtendeRequisitos(senha: string): boolean {
  return REQUISITOS_DA_SENHA.every((r) => r.teste(senha));
}

const NIVEIS = [
  { rotulo: 'Muito fraca', cor: 'bg-perigo' },
  { rotulo: 'Fraca', cor: 'bg-perigo' },
  { rotulo: 'Razoável', cor: 'bg-alerta' },
  { rotulo: 'Boa', cor: 'bg-alerta' },
  { rotulo: 'Forte', cor: 'bg-sucesso' },
  { rotulo: 'Excelente', cor: 'bg-sucesso' },
] as const;

export function ForcaDaSenha({ senha }: { readonly senha: string }) {
  const atendidos = REQUISITOS_DA_SENHA.filter((r) => r.teste(senha)).length;
  const bonus = senha.length >= 14 && atendidos === REQUISITOS_DA_SENHA.length ? 1 : 0;
  const nivel = NIVEIS[Math.min(NIVEIS.length - 1, atendidos + bonus)] ?? NIVEIS[0];

  if (senha.length === 0) return null;

  return (
    <div className="space-y-3" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i < atendidos ? nivel.cor : 'bg-superficie-3',
              )}
            />
          ))}
        </div>
        <span className="text-tinta-2 w-20 text-right text-xs font-medium">{nivel.rotulo}</span>
      </div>
      <ul className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
        {REQUISITOS_DA_SENHA.map((r) => {
          const ok = r.teste(senha);

          return (
            <li
              key={r.rotulo}
              className={cn(
                'flex items-center gap-1.5',
                ok ? 'text-sucesso-tinta' : 'text-tinta-3',
              )}
            >
              {ok ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <X className="size-3.5" aria-hidden="true" />
              )}
              <span>
                {r.rotulo}
                <span className="sr-only">{ok ? ' — atendido' : ' — pendente'}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
