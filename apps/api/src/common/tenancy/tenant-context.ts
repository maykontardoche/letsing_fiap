import { AsyncLocalStorage } from 'node:async_hooks';

/** O que acompanha uma requisição durante todo o seu processamento. */
export interface ContextoDeOrganizacao {
  readonly organizacaoId: number;
}

/**
 * ⚠️ **A peça mais séria da aplicação.**
 *
 * Todo documento, signatário e evento de auditoria pertence a uma organização, e
 * nenhuma organização pode ver nada de outra. Esta camada guarda "de qual
 * organização é esta requisição" e a extensão do Prisma lê daqui para injetar o
 * filtro em toda query.
 *
 * ## Por que `AsyncLocalStorage`, e não uma variável de módulo
 *
 * Node atende muitas requisições no mesmo processo. Uma variável de módulo
 * mutável seria compartilhada por todas as requisições em voo, e duas
 * requisições concorrentes de organizações diferentes se sobrescreveriam —
 * intermitentemente, sob carga, que é o pior modo de descobrir um vazamento.
 * `AsyncLocalStorage` prende o valor à cadeia assíncrona de quem o abriu.
 *
 * ⚠️ Jobs agendados e o worker rodam fora do ciclo HTTP — não há requisição,
 * logo não há contexto. Todo job que itera organizações chama
 * `executarNoContexto` **por iteração**.
 */
const armazenamento = new AsyncLocalStorage<ContextoDeOrganizacao>();

function ehThenable(valor: unknown): valor is PromiseLike<unknown> {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    typeof (valor as PromiseLike<unknown>).then === 'function'
  );
}

/**
 * Força uma promise preguiçosa a começar **agora**, dentro do contexto vigente.
 *
 * ⚠️ O Prisma devolve `PrismaPromise` *lazy*: a query só dispara quando alguém
 * chama `.then()`. Se o callback só devolvesse a promise, o `run()` terminaria,
 * o contexto seria desempilhado, e a query executaria **fora** dele — sem filtro
 * de organização, em silêncio. `Promise.resolve(thenable)` agenda o `.then()` num
 * microtask, e microtask herda o store de onde foi agendado.
 */
function encadearNoContexto<T>(resultado: T): T {
  return (ehThenable(resultado) ? Promise.resolve(resultado) : resultado) as T;
}

/** Abre o contexto e executa. Fora deste callback, o contexto não existe. */
export function executarNoContexto<T>(contexto: ContextoDeOrganizacao, executar: () => T): T {
  return armazenamento.run(contexto, () => encadearNoContexto(executar()));
}

/** A organização atual, ou `null` fora de um contexto (boot, login, job, teste). */
export function organizacaoAtual(): number | null {
  return armazenamento.getStore()?.organizacaoId ?? null;
}

/**
 * A organização atual, falhando alto quando não há uma. Use onde a ausência é
 * **bug**: um repositório de negócio consultado fora de contexto devolveria a
 * tabela inteira, de todas as organizações.
 */
export function exigirOrganizacaoAtual(): number {
  const organizacaoId = organizacaoAtual();

  if (organizacaoId === null) {
    throw new Error(
      'Nenhuma organização no contexto. Requisição autenticada deve abrir o contexto no ' +
        'middleware; job fora do ciclo HTTP deve chamar executarNoContexto() por iteração.',
    );
  }

  return organizacaoId;
}

/**
 * Escape hatch **explícito**: executa fora de qualquer contexto de organização.
 *
 * Legítimo em poucos lugares — login (que descobre a organização), resolução do
 * token de assinatura (idem), validação pública e jobs que iteram organizações.
 * ⚠️ Sempre com um comentário dizendo **por quê**: é a única porta de saída do
 * isolamento, e ela precisa ser fácil de auditar num `grep`.
 */
export function semEscopoDeOrganizacao<T>(executar: () => T): T {
  return armazenamento.exit(() => encadearNoContexto(executar()));
}
