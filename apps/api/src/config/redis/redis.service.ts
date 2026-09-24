import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { EnvService } from '../env/env.service';

/**
 * Conexão Redis compartilhada: sessão server-side e throttle de login.
 *
 * A fila BullMQ abre conexões próprias (ela exige `maxRetriesPerRequest: null`),
 * a partir da mesma URL — ver `common/email/fila-de-email.ts`.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly cliente: Redis;

  constructor(private readonly env: EnvService) {
    this.cliente = new Redis(env.redisUrl, { lazyConnect: false, maxRetriesPerRequest: 3 });
  }

  /** Opções de conexão para quem precisa de uma conexão dedicada (BullMQ). */
  opcoesDeConexao(): { url: string } {
    return { url: this.env.redisUrl };
  }

  async onModuleDestroy(): Promise<void> {
    await this.cliente.quit();
  }
}
