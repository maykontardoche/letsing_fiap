/**
 * Máscaras de dado pessoal para exibição pública (página de validação, PDF).
 *
 * ⚠️ A página de validação é **pública**: quem tem o código do documento vê quem
 * assinou. Por isso e-mail e CPF aparecem mascarados — o suficiente para a pessoa
 * se reconhecer, não o suficiente para alguém colher dados.
 */

/** `mariana.albuquerque@empresa.com.br` → `ma•••••@empresa.com.br` */
export function mascararEmail(email: string): string {
  const [usuario, dominio] = email.split('@');

  if (usuario === undefined || dominio === undefined) return '•••';

  return `${usuario.slice(0, 2)}${'•'.repeat(Math.max(3, Math.min(usuario.length - 2, 6)))}@${dominio}`;
}

/** Só os dois últimos dígitos → `•••.•••.•••-42` */
export function mascararCpf(final: string | null): string | null {
  return final === null ? null : `•••.•••.•••-${final}`;
}

/** `Mariana Albuquerque Souza` → `Mariana A. S.` — para listas públicas de "outros signatários". */
export function abreviarNome(nome: string): string {
  const [primeiro, ...resto] = nome.trim().split(/\s+/);

  return [primeiro, ...resto.map((parte) => `${parte.charAt(0).toUpperCase()}.`)].join(' ');
}

/** Só dígitos. */
export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/**
 * Valida CPF pelos dígitos verificadores (módulo 11). Rejeita sequências
 * repetidas (`111.111.111-11`), que passam na conta mas não existem.
 */
export function cpfValido(valor: string): boolean {
  const cpf = apenasDigitos(valor);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (tamanho: number) => {
    let soma = 0;

    for (let i = 0; i < tamanho; i += 1) soma += Number(cpf[i]) * (tamanho + 1 - i);

    const resto = (soma * 10) % 11;

    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

/** Remove acentos e caixa — comparação de fala transcrita com as palavras sorteadas. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
