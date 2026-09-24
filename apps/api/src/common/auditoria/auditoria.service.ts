import { Injectable } from '@nestjs/common';
import { Prisma, type TipoDeAtor } from '@prisma/client';
import { PrismaService, type TransacaoEscopada } from '../../config/database/prisma.service';
import type { Origem } from '../auth/requisicao';
import { organizacaoAtual } from '../tenancy/tenant-context';
import { GENESE, hashDoEvento, verificarCadeia, type ResultadoDaVerificacao } from './cadeia';

export interface EntradaDeAuditoria {
  /** snake_case: `documento_enviado`, `assinatura_registrada`, `login`. */
  readonly acao: string;
  /** Uma frase legível — é o que a linha do tempo mostra. */
  readonly resumo: string;
  readonly tipoAtor: TipoDeAtor;
  readonly atorId?: number;
  readonly atorNome?: string;
  /** Evento de documento entra na cadeia do documento; o resto, na da organização. */
  readonly documento?: { readonly id: number; readonly uuid: string };
  /** ⚠️ Só para fluxos sem contexto (login, cadastro). Nos demais, vem do contexto. */
  readonly organizacaoId?: number;
  readonly dados?: Record<string, unknown>;
  readonly origem?: Origem;
  /** ⚠️ Só o seed informa: é o que permite gerar histórico retroativo coerente. */
  readonly em?: Date;
}

/**
 * A trilha de auditoria. **Ponto único de escrita** em `eventos_de_auditoria`.
 *
 * ## Append-only é a superfície desta classe
 *
 * Não existe `atualizar`, `corrigir` nem `remover` aqui — a ausência é a feature.
 * A imutabilidade se sustenta em três camadas: o schema não tem `atualizadoEm`,
 * esta classe não expõe caminho de alteração, e cada evento é encadeado por hash
 * ao anterior — alterar por fora, direto no banco, **é detectável**.
 *
 * ## Falha de auditoria DERRUBA a operação
 *
 * ⚠️ Decisão deliberada, e oposta à de um sistema interno comum: aqui a trilha é
 * **evidência** de uma assinatura. Uma assinatura registrada sem o evento que a
 * prova seria uma assinatura sem prova. Por isso os eventos de negócio são
 * escritos **na mesma transação** da mudança de estado — ou os dois, ou nenhum.
 * Ver `docs/decisoes/0003-auditoria-na-mesma-transacao.md`.
 *
 * ## Concorrência
 *
 * Dois eventos simultâneos na mesma cadeia leriam o mesmo "último" e gerariam a
 * mesma sequência. Um `pg_advisory_xact_lock` por cadeia serializa as escritas
 * daquela cadeia (e só dela), e o `@@unique([cadeia, sequencia])` é a rede de
 * segurança se alguém um dia escrever por fora deste serviço.
 */
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra dentro da transação informada — ou numa própria, se não houver. */
  async registrar(entrada: EntradaDeAuditoria, tx?: TransacaoEscopada): Promise<void> {
    if (tx !== undefined) return this.escrever(entrada, tx);

    await this.prisma.db.$transaction((propria) => this.escrever(entrada, propria));
  }

  /** Verifica a integridade de uma cadeia. */
  async verificar(cadeia: string): Promise<ResultadoDaVerificacao> {
    const eventos = await this.prisma.db.eventoDeAuditoria.findMany({
      where: { cadeia },
      orderBy: { sequencia: 'asc' },
    });

    return verificarCadeia(eventos);
  }

  private async escrever(entrada: EntradaDeAuditoria, tx: TransacaoEscopada): Promise<void> {
    const organizacaoId = entrada.organizacaoId ?? organizacaoAtual();

    if (organizacaoId === null) {
      throw new Error(`Auditoria de "${entrada.acao}" sem organização no contexto nem explícita.`);
    }

    const cadeia = entrada.documento
      ? cadeiaDoDocumento(entrada.documento.uuid)
      : cadeiaDaOrganizacao(organizacaoId);

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cadeia}))`;

    const ultimo = await tx.eventoDeAuditoria.findFirst({
      where: { cadeia, organizacaoId },
      orderBy: { sequencia: 'desc' },
      select: { sequencia: true, hash: true },
    });

    const conteudo = {
      cadeia,
      sequencia: (ultimo?.sequencia ?? 0) + 1,
      organizacaoId,
      tipoAtor: entrada.tipoAtor,
      atorId: entrada.atorId ?? null,
      atorNome: entrada.atorNome ?? null,
      acao: entrada.acao,
      resumo: truncar(entrada.resumo, 500),
      // Normaliza pelo JSON: o que o hash cobre é exatamente o que o banco devolve.
      dados: entrada.dados === undefined ? null : (JSON.parse(JSON.stringify(entrada.dados)) as unknown),
      // Milissegundos: é a precisão do `timestamp(3)` do Postgres.
      criadoEm: new Date(Math.floor((entrada.em ?? new Date()).getTime())),
    };
    const hashAnterior = ultimo?.hash ?? GENESE;

    await tx.eventoDeAuditoria.create({
      data: {
        ...conteudo,
        documentoId: entrada.documento?.id ?? null,
        dados: conteudo.dados === null ? Prisma.DbNull : (conteudo.dados as Prisma.InputJsonValue),
        ip: entrada.origem?.ip ?? null,
        userAgent: entrada.origem?.userAgent ?? null,
        hashAnterior,
        hash: hashDoEvento(conteudo, hashAnterior),
      },
    });
  }
}

export function cadeiaDoDocumento(uuid: string): string {
  return `documento:${uuid}`;
}

export function cadeiaDaOrganizacao(organizacaoId: number): string {
  return `organizacao:${organizacaoId}`;
}

function truncar(texto: string, limite: number): string {
  return texto.length <= limite ? texto : `${texto.slice(0, limite - 1)}…`;
}
