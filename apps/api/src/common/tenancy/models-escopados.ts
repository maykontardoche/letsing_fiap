/**
 * Os models de negócio que recebem o filtro de organização automaticamente.
 *
 * ⚠️ A lista é **explícita** e não inferida por convenção de nome: um model que
 * "parece" de negócio mas não tem a coluna quebraria a query, e um que tem a
 * coluna mas ficou de fora vazaria dados. Há teste que compara esta lista com o
 * schema — model com `organizacaoId` fora daqui quebra a suíte.
 *
 * Fora da lista, de propósito:
 * - `organizacao` — é o próprio tenant, consultado por id;
 * - `tokenDeSenha` — consultado por quem ainda não está logado (não há contexto).
 */
export const MODELS_ESCOPADOS: ReadonlySet<string> = new Set([
  'usuario',
  'sessao',
  'documento',
  'signatario',
  'desafioDeVerificacao',
  'eventoDeAuditoria',
  'notificacao',
]);

export function ehModeloEscopado(model: string | undefined): boolean {
  return model !== undefined && MODELS_ESCOPADOS.has(model);
}
