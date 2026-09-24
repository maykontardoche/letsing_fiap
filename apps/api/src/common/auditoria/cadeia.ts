import { jsonCanonico } from '../cripto/canonico';
import { sha256 } from '../cripto/hash';

/** O hash "anterior" do primeiro evento de toda cadeia. */
export const GENESE = '0'.repeat(64);

/** Os campos de um evento que o hash cobre. */
export interface ConteudoDoEvento {
  readonly cadeia: string;
  readonly sequencia: number;
  readonly organizacaoId: number;
  readonly tipoAtor: string;
  readonly atorId: number | null;
  readonly atorNome: string | null;
  readonly acao: string;
  readonly resumo: string;
  readonly dados: unknown;
  readonly criadoEm: Date;
}

/**
 * O hash de um evento: `SHA-256(hashAnterior + "\n" + JSON canônico do conteúdo)`.
 *
 * É o mesmo princípio de uma blockchain, sem a parte distribuída: cada evento
 * "amarra" o anterior. Editar o `resumo` de um evento antigo muda o hash dele,
 * que deixa de bater com o `hashAnterior` do seguinte — e a quebra aparece na
 * validação pública exatamente naquele ponto.
 *
 * ⚠️ IP e user agent ficam FORA do hash de propósito: são metadado de
 * diagnóstico, e a LGPD pode exigir anonimizá-los no futuro. Anonimizar não pode
 * quebrar a prova de integridade do que foi feito.
 */
export function hashDoEvento(conteudo: ConteudoDoEvento, hashAnterior: string): string {
  return sha256(
    `${hashAnterior}\n${jsonCanonico({
      cadeia: conteudo.cadeia,
      sequencia: conteudo.sequencia,
      organizacaoId: conteudo.organizacaoId,
      tipoAtor: conteudo.tipoAtor,
      atorId: conteudo.atorId,
      atorNome: conteudo.atorNome,
      acao: conteudo.acao,
      resumo: conteudo.resumo,
      dados: conteudo.dados ?? null,
      criadoEm: conteudo.criadoEm,
    })}`,
  );
}

export interface EventoEncadeado extends ConteudoDoEvento {
  readonly hashAnterior: string;
  readonly hash: string;
}

export interface ResultadoDaVerificacao {
  readonly integra: boolean;
  readonly total: number;
  /** Sequência do primeiro evento onde a cadeia quebra. */
  readonly quebraEm: number | null;
  readonly motivo: string | null;
}

/**
 * Recalcula a cadeia inteira. Três coisas podem quebrá-la, e todas indicam
 * adulteração: um conteúdo cujo hash não bate; um elo que não aponta para o
 * anterior; um buraco na sequência (evento apagado).
 */
export function verificarCadeia(eventos: readonly EventoEncadeado[]): ResultadoDaVerificacao {
  const ordenados = [...eventos].sort((a, b) => a.sequencia - b.sequencia);
  let anterior = GENESE;

  for (const [indice, evento] of ordenados.entries()) {
    const quebra = (motivo: string): ResultadoDaVerificacao => ({
      integra: false,
      total: ordenados.length,
      quebraEm: evento.sequencia,
      motivo,
    });

    if (evento.sequencia !== indice + 1) return quebra('Há um evento faltando na sequência.');

    if (evento.hashAnterior !== anterior) return quebra('O elo com o evento anterior não confere.');

    if (hashDoEvento(evento, anterior) !== evento.hash) {
      return quebra('O conteúdo do evento foi alterado depois de registrado.');
    }

    anterior = evento.hash;
  }

  return { integra: true, total: ordenados.length, quebraEm: null, motivo: null };
}
