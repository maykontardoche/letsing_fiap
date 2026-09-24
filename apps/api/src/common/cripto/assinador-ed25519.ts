import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from 'node:crypto';
import { jsonCanonico } from './canonico';
import { sha256 } from './hash';

/**
 * Assinatura digital **Ed25519** da plataforma.
 *
 * ## O que é assinado
 *
 * Duas coisas, com a mesma chave:
 *
 * 1. **cada assinatura de signatário** — a carga canônica com o hash do PDF
 *    original, quem assinou, quando, de onde e quais verificações de identidade
 *    passaram. Prova que *aquela* pessoa concordou com *aquele* conteúdo;
 * 2. **o selo de conclusão** — hash do original, hash do PDF final e a lista de
 *    assinaturas. Prova que o arquivo baixado é o que a plataforma emitiu.
 *
 * ## Por que Ed25519
 *
 * Curva moderna (RFC 8032), determinística — não depende de um bom gerador
 * aleatório no momento de assinar, que foi a falha clássica do ECDSA —, chave de
 * 32 bytes e verificação rápida. Está no `node:crypto` e em qualquer biblioteca
 * de criptografia séria, então um terceiro verifica sem o LetsSign.
 *
 * A chave pública é publicada em `GET /api/publico/chave`.
 */
export class AssinadorEd25519 {
  readonly chavePublicaPem: string;
  /** Identificador curto da chave: os 16 primeiros hex do SHA-256 da pública (DER). */
  readonly idDaChave: string;

  private constructor(
    private readonly privada: KeyObject,
    private readonly publica: KeyObject,
  ) {
    this.chavePublicaPem = publica.export({ type: 'spki', format: 'pem' }).toString();
    this.idDaChave = sha256(publica.export({ type: 'spki', format: 'der' })).slice(0, 16);
  }

  /** A partir de uma chave privada PEM (PKCS#8). */
  static deChavePrivada(pem: string): AssinadorEd25519 {
    const privada = createPrivateKey(pem);

    if (privada.asymmetricKeyType !== 'ed25519') {
      throw new Error('A chave da plataforma precisa ser Ed25519.');
    }

    return new AssinadorEd25519(privada, createPublicKey(privada));
  }

  /** Gera um par novo. Devolve também o PEM da privada, para persistir. */
  static gerar(): { assinador: AssinadorEd25519; privadaPem: string } {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const privadaPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    return { assinador: new AssinadorEd25519(privateKey, publicKey), privadaPem };
  }

  /** Serializa canonicamente e assina. Devolve a carga exata e a assinatura em base64. */
  assinar(dados: unknown): { carga: string; assinatura: string } {
    const carga = jsonCanonico(dados);

    // Ed25519 não usa digest separado: o algoritmo é `null` por especificação.
    return {
      carga,
      assinatura: sign(null, Buffer.from(carga, 'utf8'), this.privada).toString('base64'),
    };
  }

  /** Verifica uma assinatura sobre a carga **exata** que foi assinada. */
  verificar(carga: string, assinatura: string): boolean {
    try {
      return verify(
        null,
        Buffer.from(carga, 'utf8'),
        this.publica,
        Buffer.from(assinatura, 'base64'),
      );
    } catch {
      // Assinatura malformada (base64 truncado, tamanho errado) é "inválida", não 500.
      return false;
    }
  }
}
