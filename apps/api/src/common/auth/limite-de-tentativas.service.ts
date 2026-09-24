import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '../../config/redis/redis.service';

interface Regra {
  /** Tentativas permitidas dentro da janela. */
  readonly maximo: number;
  /** Janela e bloqueio, em segundos. */
  readonly janela: number;
}

/**
 * Limite de tentativas por **chave** (ex.: e-mail + IP no login, token no código
 * de verificação), além do rate limit global por IP.
 *
 * ## Por que por e-mail + IP, e não só por IP
 *
 * Só por IP, um atacante com muitos IPs (botnet) testa senhas à vontade contra
 * uma conta. Só por e-mail, qualquer um tranca a conta de outra pessoa errando
 * de propósito. O par limita o ataque sem entregar a conta alheia a um DoS.
 *
 * Contador no Redis com TTL: a janela recomeça sozinha, sem job de limpeza.
 */
@Injectable()
export class LimiteDeTentativasService {
  constructor(private readonly redis: RedisService) {}

  /** Lança 429 se a chave já estourou o limite. Não conta a tentativa. */
  async verificar(chave: string, regra: Regra): Promise<void> {
    const atual = Number((await this.redis.cliente.get(this.chave(chave))) ?? 0);

    if (atual >= regra.maximo) {
      const restante = await this.redis.cliente.ttl(this.chave(chave));
      const minutos = Math.max(1, Math.ceil(restante / 60));

      throw new HttpException(
        `Muitas tentativas. Aguarde ${minutos} minuto${minutos > 1 ? 's' : ''} e tente de novo.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Registra uma falha. A primeira falha abre a janela. */
  async registrarFalha(chave: string, regra: Regra): Promise<void> {
    const total = await this.redis.cliente.incr(this.chave(chave));

    if (total === 1) await this.redis.cliente.expire(this.chave(chave), regra.janela);
  }

  async limpar(chave: string): Promise<void> {
    await this.redis.cliente.del(this.chave(chave));
  }

  private chave(chave: string): string {
    return `tentativas:${chave}`;
  }
}

/** 5 tentativas de login por e-mail+IP; bloqueio de 15 minutos. */
export const REGRA_DE_LOGIN: Regra = { maximo: 5, janela: 15 * 60 };
/** 5 códigos errados de MFA por sessão; bloqueio de 15 minutos. */
export const REGRA_DE_MFA: Regra = { maximo: 5, janela: 15 * 60 };
