import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import { RedisService } from '../../config/redis/redis.service';
import { sha256 } from '../cripto/hash';
import type { Origem } from './requisicao';

/** O que a sessão guarda. Nada aqui é dado de negócio — só identidade e estado de autenticação. */
export interface DadosDaSessao {
  readonly usuarioId: number;
  readonly organizacaoId: number;
  /**
   * ⚠️ O MFA é **por sessão**: este campo vive aqui e morre com ela. Cada login
   * novo exige o segundo fator de novo — não há "lembrar este dispositivo".
   */
  readonly mfaPendente: boolean;
  /**
   * Segredo de MFA aguardando confirmação. ⚠️ Fica na sessão, não no banco, até a
   * pessoa provar que o app gera o código certo — gravar antes deixaria a conta
   * com MFA "ativo" e nenhum app capaz de gerar o código: trancada.
   */
  readonly segredoMfaPendente?: string;
}

/** 8 horas: um expediente. A cada requisição o prazo recomeça (expiração deslizante). */
export const VIDA_DA_SESSAO_EM_SEGUNDOS = 8 * 60 * 60;
export const NOME_DO_COOKIE = 'letssign_sessao';

const PREFIXO = 'sessao:';

/**
 * Sessão **server-side**, no Redis.
 *
 * ## Por que não JWT
 *
 * ⚠️ Porque a tela "Sessões ativas" permite **revogar** uma sessão — e o
 * desativar de um membro precisa derrubá-lo na hora. Com JWT puro o token
 * continua válido até expirar, e revogar exigiria uma lista de bloqueio
 * consultada a cada requisição: este mesmo Redis, com mais passos.
 *
 * ## Duas escritas, de propósito
 *
 * A sessão em si vive no Redis, com TTL. A tabela `sessoes` guarda o metadado
 * administrativo — quem, de onde, desde quando. O id da sessão **nunca** vai para
 * o banco: só o hash dele. Quem lê o banco não sequestra sessão.
 */
@Injectable()
export class SessaoService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async criar(dados: DadosDaSessao, origem: Origem): Promise<string> {
    // 32 bytes aleatórios: é a credencial que vai no cookie.
    const id = randomBytes(32).toString('base64url');

    await this.gravar(id, dados);
    await this.prisma.db.sessao.create({
      data: {
        // ⚠️ Organização EXPLÍCITA: a sessão nasce antes de o contexto existir —
        // é o login que descobre de qual organização a pessoa é.
        organizacaoId: dados.organizacaoId,
        usuarioId: dados.usuarioId,
        sessaoHash: sha256(id),
        ip: origem.ip ?? null,
        userAgent: origem.userAgent ?? null,
      },
    });

    return id;
  }

  async ler(id: string): Promise<DadosDaSessao | null> {
    const bruto = await this.redis.cliente.get(PREFIXO + id);

    return bruto === null ? null : (JSON.parse(bruto) as DadosDaSessao);
  }

  /** Troca os dados mantendo o mesmo id (MFA confirmado, segredo pendente). */
  async atualizar(id: string, dados: DadosDaSessao): Promise<void> {
    await this.gravar(id, dados);
  }

  /**
   * Marca atividade: renova o TTL e o `ultimaAtividadeEm`.
   *
   * ⚠️ `updateMany`, não `update`: linha já revogada não deve virar exceção numa
   * requisição que, de resto, está correta.
   */
  async tocar(id: string): Promise<void> {
    await this.redis.cliente.expire(PREFIXO + id, VIDA_DA_SESSAO_EM_SEGUNDOS);
    await this.prisma.db.sessao.updateMany({
      where: { sessaoHash: sha256(id), revogadaEm: null },
      data: { ultimaAtividadeEm: new Date() },
    });
  }

  /**
   * Revoga pelo id da sessão.
   *
   * ⚠️ A ordem importa: o Redis primeiro, porque é ele que decide se a próxima
   * requisição passa. Se o banco falhar depois, a sessão já está morta.
   */
  async revogar(id: string): Promise<void> {
    await this.redis.cliente.del(PREFIXO + id);
    await this.revogarPorHash(sha256(id));
  }

  /**
   * Revoga pelo hash — o caminho da tela "Sessões ativas", que só conhece o hash.
   * Guardamos no Redis um índice hash → id para isso.
   */
  async revogarPorHash(hash: string): Promise<void> {
    const id = await this.redis.cliente.get(`sessao-por-hash:${hash}`);

    if (id !== null) {
      await this.redis.cliente.del(PREFIXO + id, `sessao-por-hash:${hash}`);
    }

    await this.prisma.db.sessao.updateMany({
      where: { sessaoHash: hash, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  }

  /** Derruba todas as sessões de um usuário (desativação, troca de senha). */
  async revogarTodasDo(usuarioId: number, excetoHash?: string): Promise<void> {
    const ativas = await this.prisma.db.sessao.findMany({
      where: {
        usuarioId,
        revogadaEm: null,
        ...(excetoHash ? { NOT: { sessaoHash: excetoHash } } : {}),
      },
      select: { sessaoHash: true },
    });

    for (const sessao of ativas) {
      await this.revogarPorHash(sessao.sessaoHash);
    }
  }

  private async gravar(id: string, dados: DadosDaSessao): Promise<void> {
    const transacao = this.redis.cliente.multi();

    transacao.set(PREFIXO + id, JSON.stringify(dados), 'EX', VIDA_DA_SESSAO_EM_SEGUNDOS);
    transacao.set(`sessao-por-hash:${sha256(id)}`, id, 'EX', VIDA_DA_SESSAO_EM_SEGUNDOS);

    await transacao.exec();
  }
}
