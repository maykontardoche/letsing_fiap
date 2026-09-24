import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { EnvService } from '../../config/env/env.service';
import { chaveDeCifra, cifrar, decifrar } from '../cripto/cifra';

const QUANTIDADE_DE_CODIGOS = 8;
/** Sem I, O, 0 e 1: são códigos anotados à mão e digitados meses depois. */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * MFA por TOTP (RFC 6238) — Google Authenticator, Microsoft Authenticator, 1Password…
 *
 * - **segredo** e **códigos de recuperação** → banco, **cifrados**: o segredo É o
 *   segundo fator, e quem o lê gera códigos válidos para sempre;
 * - **"esta sessão já passou pelo MFA"** → sessão, no Redis. Cada login pede de novo.
 */
@Injectable()
export class MfaService {
  constructor(private readonly env: EnvService) {
    // ±30s: relógio de celular raramente está exato.
    authenticator.options = { window: 1 };
  }

  async gerarSegredo(email: string): Promise<{ segredo: string; qrCode: string; uri: string }> {
    const segredo = authenticator.generateSecret();
    const uri = authenticator.keyuri(email, this.env.emissorMfa, segredo);

    return { segredo, uri, qrCode: await toDataURL(uri, { margin: 1, width: 240 }) };
  }

  /** Confere contra um segredo em claro (o pendente, na sessão). */
  conferirComSegredo(codigo: string, segredo: string): boolean {
    return authenticator.check(codigo.replace(/\D/g, ''), segredo);
  }

  /** Confere contra o segredo cifrado no banco. */
  conferir(codigo: string, segredoCifrado: string): boolean {
    return this.conferirComSegredo(codigo, decifrar(segredoCifrado, this.chave()));
  }

  gerarCodigosDeRecuperacao(): string[] {
    const bloco = () =>
      Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');

    return Array.from({ length: QUANTIDADE_DE_CODIGOS }, () => `${bloco()}-${bloco()}`);
  }

  /**
   * Confere um código de recuperação e **o consome** — uso único, sem exceção.
   * Devolve a lista restante, que o chamador precisa persistir.
   */
  consumirCodigo(codigo: string, cifrados: string): { aceito: boolean; restantes: string } {
    const lista = JSON.parse(decifrar(cifrados, this.chave())) as string[];
    const indice = lista.indexOf(codigo.trim().toUpperCase());

    if (indice === -1) return { aceito: false, restantes: cifrados };

    lista.splice(indice, 1);

    return { aceito: true, restantes: this.cifrarCodigos(lista) };
  }

  cifrarSegredo(segredo: string): string {
    return cifrar(segredo, this.chave());
  }

  cifrarCodigos(codigos: string[]): string {
    return cifrar(JSON.stringify(codigos), this.chave());
  }

  private chave(): Buffer {
    return chaveDeCifra(this.env.chaveDeCifra);
  }
}
