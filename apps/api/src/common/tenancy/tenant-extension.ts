import { Prisma } from '@prisma/client';
import { ehModeloEscopado } from './models-escopados';
import { organizacaoAtual } from './tenant-context';

/** Operações de leitura e de escrita direcionada: recebem o filtro no `where`. */
const OPERACOES_COM_WHERE = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
]);

/** Operações de criação: recebem o `organizacaoId` no `data`. */
const OPERACOES_DE_CRIACAO = new Set(['create', 'createMany', 'createManyAndReturn']);

type Argumentos = Record<string, unknown>;

/**
 * Injeta `WHERE organizacao_id = ?` em toda query de model de negócio e preenche
 * `organizacao_id` na criação.
 *
 * ## Por que injetar, em vez de exigir o filtro em cada repositório
 *
 * Porque a alternativa depende de ninguém errar, nunca. E o erro é
 * **silencioso**: a query devolve dados a mais, e ninguém percebe até ser tarde.
 *
 * ## Sem contexto, não filtra
 *
 * ⚠️ Quando não há organização no contexto, a query passa sem filtro. É
 * necessário — o login precisa achar o usuário **antes** de saber a organização
 * dele. O que torna isso seguro é o **middleware de sessão**, que abre o contexto
 * em toda requisição autenticada antes de qualquer controller rodar, e o teste de
 * integração de isolamento, que é gate da suíte.
 *
 * ## `findUnique` com filtro extra
 *
 * Funciona porque o Prisma aceita campos não-únicos no `where` de `findUnique`,
 * `update` e `delete` desde que haja um identificador único junto.
 */
export function criarExtensaoDeOrganizacao(lerOrganizacao: () => number | null = organizacaoAtual) {
  return Prisma.defineExtension({
    name: 'escopo-de-organizacao',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          const organizacaoId = lerOrganizacao();

          if (organizacaoId === null || !ehModeloEscopado(nomeDoModelo(model))) {
            return query(args);
          }

          return query(aplicarEscopo(operation, args, organizacaoId));
        },
      },
    },
  });
}

/** O Prisma entrega `PascalCase` (`EventoDeAuditoria`); a lista usa o nome do client. */
function nomeDoModelo(model: string | undefined): string | undefined {
  if (model === undefined || model.length === 0) return undefined;

  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * A transformação pura dos argumentos — exportada para ser testável sem banco:
 * é aqui que mora a decisão de isolamento.
 */
export function aplicarEscopo(
  operation: string,
  args: Argumentos,
  organizacaoId: number,
): Argumentos {
  if (OPERACOES_COM_WHERE.has(operation)) {
    return { ...args, where: { ...(args.where as Argumentos | undefined), organizacaoId } };
  }

  if (OPERACOES_DE_CRIACAO.has(operation)) {
    return { ...args, data: preencherOrganizacao(args.data, organizacaoId) };
  }

  if (operation === 'upsert') {
    return {
      ...args,
      where: { ...(args.where as Argumentos | undefined), organizacaoId },
      create: preencherOrganizacao(args.create, organizacaoId),
    };
  }

  return args;
}

/**
 * Preenche `organizacaoId` **só se estiver em branco** — nunca sobrescreve valor
 * explícito. Os poucos lugares legítimos que gravam com a organização informada
 * (sessão no login, seed) fazem isso de propósito.
 */
function preencherOrganizacao(data: unknown, organizacaoId: number): unknown {
  if (Array.isArray(data)) {
    return data.map((registro) => preencherOrganizacao(registro, organizacaoId));
  }

  if (typeof data !== 'object' || data === null) return data;

  const registro = data as Argumentos;

  return registro.organizacaoId === undefined ? { ...registro, organizacaoId } : registro;
}
