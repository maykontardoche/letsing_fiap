import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** SHA-256 em hexadecimal minúsculo — o formato que aparece no PDF e na validação. */
export function sha256(dados: Buffer | Uint8Array | string): string {
  return createHash('sha256').update(dados).digest('hex');
}

/** Um SHA-256 em hex válido? Usado para validar entrada pública. */
export function ehSha256(valor: string): boolean {
  return /^[a-f0-9]{64}$/.test(valor);
}

/**
 * Token opaco para URL (convite de assinatura, redefinição de senha).
 *
 * 32 bytes aleatórios = 256 bits: adivinhar é inviável. ⚠️ O token é credencial —
 * **só o hash vai para o banco**. Quem lê o banco não consegue assinar no lugar
 * de ninguém.
 */
export function gerarToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');

  return { token, hash: sha256(token) };
}

/** Código numérico de uso único (verificação por e-mail). */
export function gerarCodigoNumerico(digitos = 6): string {
  return String(randomInt(0, 10 ** digitos)).padStart(digitos, '0');
}

/**
 * Compara dois textos em tempo constante.
 *
 * ⚠️ `===` para no primeiro caractere diferente, e o tempo de resposta vaza
 * quanto do valor está certo. Para hash de código e token, isso é um oráculo.
 */
export function iguaisEmTempoConstante(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

/** Alfabeto sem caracteres ambíguos (0/O, 1/I/L) — o código é lido e digitado por gente. */
const ALFABETO_DO_CODIGO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Código público do documento, no formato `LS-XXXX-XXXX`.
 *
 * ⚠️ Não é segredo — vai impresso no PDF e no QR Code. Serve para a pessoa digitar
 * na página de validação. 31^8 ≈ 8,5 × 10¹¹ combinações: colisão é tratada no
 * banco (`@unique`), e enumerar para descobrir documentos alheios é inviável.
 */
export function gerarCodigoDeDocumento(): string {
  const bloco = () =>
    Array.from({ length: 4 }, () => ALFABETO_DO_CODIGO[randomInt(ALFABETO_DO_CODIGO.length)]).join(
      '',
    );

  return `LS-${bloco()}-${bloco()}`;
}
