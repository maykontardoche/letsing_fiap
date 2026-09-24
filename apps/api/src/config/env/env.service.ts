import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

/**
 * Acesso tipado à configuração. **Nenhum módulo lê `process.env`** — o ESLint
 * recusa o acesso direto fora de `config/env/`. Assim o contrato de ambiente
 * fica num lugar só, validado no boot.
 */
@Injectable()
export class EnvService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private ler<K extends keyof Env>(chave: K): Env[K] {
    return this.config.get(chave, { infer: true });
  }

  get ambiente(): Env['NODE_ENV'] {
    return this.ler('NODE_ENV');
  }

  get emProducao(): boolean {
    return this.ambiente === 'production';
  }

  get porta(): number {
    return this.ler('PORT');
  }

  get databaseUrl(): string {
    return this.ler('DATABASE_URL');
  }

  get redisUrl(): string {
    return this.ler('REDIS_URL');
  }

  get origensPermitidas(): string[] {
    return this.ler('CORS_ORIGINS');
  }

  get urlDoApp(): string {
    return this.ler('APP_URL').replace(/\/+$/, '');
  }

  /**
   * Cookie de sessão com `Secure` quando o SPA é servido por HTTPS.
   *
   * ⚠️ Decidido pelo esquema do `APP_URL`, não pelo `NODE_ENV`: uma instalação de
   * produção atrás de HTTP puro (rede interna, demonstração em container) com
   * `Secure` ligado nunca receberia o cookie de volta — o login "funcionaria" e
   * toda requisição seguinte voltaria 401.
   */
  get cookieSeguro(): boolean {
    return this.urlDoApp.startsWith('https://');
  }

  get smtpUrl(): string | undefined {
    return this.ler('SMTP_URL');
  }

  get remetenteDeEmail(): string {
    return this.ler('EMAIL_REMETENTE');
  }

  get diretorioDeArmazenamento(): string {
    return this.ler('DIRETORIO_DE_ARMAZENAMENTO');
  }

  get chaveDeCifra(): string {
    return this.ler('ENCRYPTION_KEY');
  }

  get chavePrivadaEd25519(): string | undefined {
    return this.ler('CHAVE_PRIVADA_ED25519');
  }

  get emissorMfa(): string {
    return this.ler('MFA_EMISSOR');
  }

  get throttleTtlSegundos(): number {
    return this.ler('THROTTLE_TTL_SEGUNDOS');
  }

  get throttleLimite(): number {
    return this.ler('THROTTLE_LIMITE');
  }

  get tamanhoMaximoPdfBytes(): number {
    return this.ler('TAMANHO_MAXIMO_PDF_MB') * 1024 * 1024;
  }

  get workerEmbutido(): boolean {
    return this.ler('WORKER_EMBUTIDO');
  }

  get nivelDeLog(): Env['LOG_LEVEL'] {
    return this.ler('LOG_LEVEL');
  }
}
