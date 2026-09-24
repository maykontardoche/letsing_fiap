/**
 * Dados de criação de um model escopado **sem** `organizacaoId` — a extensão do
 * Prisma o preenche a partir do contexto da requisição.
 *
 * Existe para deixar isso **explícito** no ponto de chamada: o tipo gerado pelo
 * Prisma exige o campo, e um `as` solto esconderia a intenção (e passaria calado
 * se alguém chamasse fora de contexto). O nome diz o que acontece.
 *
 * ⚠️ Só dentro de um contexto de organização. Fora dele, o banco recusa o insert
 * (`organizacao_id` é NOT NULL) — que é o comportamento certo.
 */
export function comOrganizacaoDoContexto<T extends { organizacaoId: number }>(
  dados: Omit<T, 'organizacaoId'>,
): T {
  return dados as T;
}
