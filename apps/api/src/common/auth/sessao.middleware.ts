import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { PrismaService } from '../../config/database/prisma.service';
import { executarNoContexto, semEscopoDeOrganizacao } from '../tenancy/tenant-context';
import type { RequisicaoAutenticada } from './requisicao';
import { NOME_DO_COOKIE, SessaoService } from './sessao.service';

/**
 * Resolve a sessão e **abre o contexto de organização** para o resto da requisição.
 *
 * ## Por que middleware, e não guard
 *
 * ⚠️ Um guard decide "passa ou não" e **retorna** — quando o handler roda, a
 * pilha do guard já saiu. O contexto precisa estar ativo *durante* todo o
 * processamento, e `AsyncLocalStorage.run()` só cobre o que acontece dentro do
 * callback. Aqui o `next()` é chamado **de dentro** do contexto: guards,
 * controller, service e repository executam com a organização na pilha.
 *
 * ## Não decide autorização
 *
 * Requisição anônima passa por aqui sem contexto, e é o guard que devolve 401 —
 * assim as rotas públicas funcionam sem exceção nenhuma aqui dentro.
 */
@Injectable()
export class SessaoMiddleware implements NestMiddleware {
  constructor(
    private readonly sessoes: SessaoService,
    private readonly prisma: PrismaService,
  ) {}

  async use(requisicao: RequisicaoAutenticada, _resposta: Response, proximo: NextFunction) {
    const cookies = requisicao.cookies as Record<string, string | undefined> | undefined;
    const id = cookies?.[NOME_DO_COOKIE];

    if (id === undefined || id.length === 0) return proximo();

    const sessao = await this.sessoes.ler(id);

    if (sessao === null) return proximo();

    // Sem escopo: o contexto ainda não existe, e é justamente o usuário que diz
    // de qual organização ele é.
    const usuario = await semEscopoDeOrganizacao(() =>
      this.prisma.db.usuario.findUnique({ where: { id: sessao.usuarioId } }),
    );

    // ⚠️ Desativado depois de logar perde o acesso NA PRÓXIMA requisição — sem
    // esta checagem, a sessão continuaria valendo até expirar.
    if (usuario === null || !usuario.ativo || usuario.organizacaoId !== sessao.organizacaoId) {
      await this.sessoes.revogar(id);
      return proximo();
    }

    requisicao.usuario = {
      id: usuario.id,
      uuid: usuario.uuid,
      organizacaoId: usuario.organizacaoId,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      mfaAtivo: usuario.mfaAtivadoEm !== null,
    };
    requisicao.sessao = sessao;
    requisicao.idDaSessao = id;

    await this.sessoes.tocar(id);

    // ⚠️ O `next()` DENTRO do contexto — é isto que faz o escopo valer para toda
    // a cadeia que vem depois.
    executarNoContexto({ organizacaoId: sessao.organizacaoId }, () => proximo());
  }
}
