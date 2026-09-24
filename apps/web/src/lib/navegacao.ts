/**
 * Destino de retorno depois do login (`?voltar=`).
 *
 * ⚠️ Só caminhos internos: aceitar `?voltar=https://site-malicioso.com` faria do
 * login um *open redirect* — a pessoa digita a senha no LetsSign e é jogada num
 * clone que pede "confirme sua senha de novo". `//evil.com` também é externo.
 */
export function destinoSeguro(bruto: string | null, padrao = '/app'): string {
  return bruto !== null && bruto.startsWith('/') && !bruto.startsWith('//') && !bruto.startsWith('/\\') ? bruto : padrao;
}
