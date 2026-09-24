import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITMO = 'aes-256-gcm';
const TAMANHO_DA_CHAVE = 32;
const TAMANHO_DO_IV = 12;

/**
 * Cifra simétrica para **campo em repouso**: CPF do signatário, segredo de MFA e
 * códigos de recuperação.
 *
 * ## GCM, não CBC
 *
 * ⚠️ AES-GCM é autenticado: alterar o texto cifrado faz a decifragem **falhar**,
 * em vez de devolver lixo. Com CBC, quem tivesse escrita no banco poderia
 * adulterar o campo e a aplicação usaria o resultado sem notar.
 *
 * Formato: `<iv hex>:<tag hex>:<cifrado hex>`.
 */
export function cifrar(texto: string, chave: Buffer): string {
  const iv = randomBytes(TAMANHO_DO_IV);
  const cifrador = createCipheriv(ALGORITMO, chave, iv);
  const cifrado = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);

  return [iv.toString('hex'), cifrador.getAuthTag().toString('hex'), cifrado.toString('hex')].join(
    ':',
  );
}

/** Decifra. **Lança** se o conteúdo foi adulterado ou a chave está errada. */
export function decifrar(cifrado: string, chave: Buffer): string {
  const [ivHex, tagHex, dadosHex] = cifrado.split(':');

  if (ivHex === undefined || tagHex === undefined || dadosHex === undefined) {
    throw new Error('Texto cifrado em formato inválido.');
  }

  const decifrador = createDecipheriv(ALGORITMO, chave, Buffer.from(ivHex, 'hex'));

  decifrador.setAuthTag(Buffer.from(tagHex, 'hex'));

  return Buffer.concat([
    decifrador.update(Buffer.from(dadosHex, 'hex')),
    decifrador.final(),
  ]).toString('utf8');
}

/**
 * Converte a chave do ambiente em bytes. ⚠️ Exige **exatamente** 32 bytes:
 * completar uma chave curta com zeros transformaria configuração errada em cifra
 * fraca que ninguém percebe.
 */
export function chaveDeCifra(hex: string): Buffer {
  const chave = Buffer.from(hex, 'hex');

  if (chave.length !== TAMANHO_DA_CHAVE) {
    throw new Error('ENCRYPTION_KEY deve ter 32 bytes em hexadecimal (64 caracteres).');
  }

  return chave;
}
