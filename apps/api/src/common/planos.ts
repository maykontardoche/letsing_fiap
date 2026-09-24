import type { Plano } from '@prisma/client';

/**
 * Limites de cada plano. ⚠️ É o servidor que recusa o envio além da cota — o SPA
 * só mostra o número (`apps/web/src/constants/planos.ts`, que precisa bater).
 */
export const LIMITES_DO_PLANO: Readonly<
  Record<Plano, { readonly enviosPorMes: number | null; readonly membros: number | null }>
> = {
  basico: { enviosPorMes: 10, membros: 3 },
  profissional: { enviosPorMes: 100, membros: null },
  empresarial: { enviosPorMes: null, membros: null },
};

export const ROTULO_DO_PLANO: Readonly<Record<Plano, string>> = {
  basico: 'Básico',
  profissional: 'Profissional',
  empresarial: 'Empresarial',
};

/** O primeiro instante do mês corrente, no fuso de Brasília. */
export function inicioDoMes(agora = new Date()): Date {
  const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const deslocamento = agora.getTime() - brasilia.getTime();

  return new Date(new Date(brasilia.getFullYear(), brasilia.getMonth(), 1).getTime() + deslocamento);
}
