import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../config/database/prisma.service';
import { RedisService } from '../config/redis/redis.service';
import { Publico } from '../common/auth/decorators';

type Estado = 'up' | 'down';

/**
 * - `GET /api/saude` — *liveness*: o processo está vivo. Nunca consulta
 *   dependência: se consultasse, uma queda do banco faria o orquestrador matar
 *   um processo saudável, e reiniciar não conserta banco.
 * - `GET /api/saude/pronto` — *readiness*: banco e Redis respondem. 503 tira a
 *   instância do balanceamento até ela voltar.
 */
@Publico()
@SkipThrottle()
@Controller('saude')
export class SaudeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  vivo() {
    return { status: 'ok' };
  }

  @Get('pronto')
  async pronto() {
    const [banco, redis] = await Promise.all([this.checar(() => this.prisma.db.$queryRaw`SELECT 1`), this.checar(() => this.redis.cliente.ping())]);
    const corpo = { status: banco === 'up' && redis === 'up' ? 'ok' : 'erro', detalhes: { banco, redis } };

    if (corpo.status !== 'ok') throw new ServiceUnavailableException(corpo);

    return corpo;
  }

  private async checar(sonda: () => Promise<unknown>): Promise<Estado> {
    try {
      await sonda();
      return 'up';
    } catch {
      return 'down';
    }
  }
}
