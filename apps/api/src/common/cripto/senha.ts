import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Hash de senha com **scrypt** (RFC 7914), nativo do Node.
 *
 * ## Por que scrypt
 *
 * É *memory-hard*: cada tentativa custa 64 MiB de RAM além de CPU, o que torna
 * ataque de força bruta com GPU/ASIC caro. É recomendado pela OWASP ao lado do
 * Argon2id, e está no `node:crypto` — sem dependência nativa para compilar na
 * máquina de quem vai avaliar o projeto.
 *
 * Parâmetros: N=2^16, r=8, p=1 (≈64 MiB). O formato guarda os parâmetros junto
 * do hash, então dá para endurecê-los no futuro sem invalidar senhas antigas:
 *
 * `scrypt$N$r$p$<sal base64>$<hash base64>`
 */
const N = 2 ** 16;
const R = 8;
const P = 1;
const TAMANHO_DO_HASH = 64;
const MEMORIA_MAXIMA = 256 * 1024 * 1024;

function derivar(senha: string, sal: Buffer, parametros: { n: number; r: number; p: number }) {
  return new Promise<Buffer>((resolver, rejeitar) => {
    scrypt(
      senha.normalize('NFKC'),
      sal,
      TAMANHO_DO_HASH,
      { N: parametros.n, r: parametros.r, p: parametros.p, maxmem: MEMORIA_MAXIMA },
      (erro, chave) => (erro ? rejeitar(erro) : resolver(chave)),
    );
  });
}

export async function gerarHashDeSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await derivar(senha, sal, { n: N, r: R, p: P });

  return ['scrypt', N, R, P, sal.toString('base64'), hash.toString('base64')].join('$');
}

/** Confere em tempo constante. Hash malformado é "não confere", nunca exceção. */
export async function conferirSenha(senha: string, armazenado: string): Promise<boolean> {
  const [algoritmo, n, r, p, salB64, hashB64] = armazenado.split('$');

  if (algoritmo !== 'scrypt' || !n || !r || !p || !salB64 || !hashB64) return false;

  const esperado = Buffer.from(hashB64, 'base64');
  const obtido = await derivar(senha, Buffer.from(salB64, 'base64'), {
    n: Number(n),
    r: Number(r),
    p: Number(p),
  });

  return obtido.length === esperado.length && timingSafeEqual(obtido, esperado);
}

/**
 * Política de senha — a mesma que o SPA mostra ao vivo no cadastro.
 * Devolve a lista do que falta, vazia quando a senha serve.
 */
export function problemasDaSenha(senha: string): string[] {
  const problemas: string[] = [];

  if (senha.length < 10) problemas.push('ter pelo menos 10 caracteres');
  if (!/[a-z]/.test(senha)) problemas.push('ter uma letra minúscula');
  if (!/[A-Z]/.test(senha)) problemas.push('ter uma letra maiúscula');
  if (!/\d/.test(senha)) problemas.push('ter um número');
  if (!/[^A-Za-z0-9]/.test(senha)) problemas.push('ter um símbolo');

  return problemas;
}
