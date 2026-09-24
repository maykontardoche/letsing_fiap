import { randomInt } from 'node:crypto';
import { normalizar } from '../../common/texto/mascaras';

/**
 * Os desafios de verificação de identidade — **sorteados no servidor**.
 *
 * ## Por que o servidor sorteia
 *
 * Se o navegador escolhesse as palavras, os gestos e as ações de prova de vida,
 * um script poderia "responder" um desafio que ele mesmo inventou, ou um vídeo
 * gravado de antemão passaria sempre. Sorteado aqui, com validade de minutos e
 * guardado no banco, o desafio só é respondível **agora**, **por quem está na
 * frente da câmera**.
 *
 * ## ⚠️ O limite honesto desta abordagem
 *
 * A análise biométrica roda no navegador (é o que mantém a biometria fora do
 * servidor — LGPD). Isso significa que um atacante com conhecimento técnico
 * poderia forjar a *resposta* do navegador. O que protege, em camadas:
 * o desafio aleatório e de curta duração; o código por e-mail, obrigatório em
 * todos os níveis; a trilha de auditoria com IP e horário; e a assinatura
 * digital que amarra tudo. Um produto em produção somaria um provedor de
 * *liveness* com atestação no servidor — ver `docs/decisoes/0004`.
 */

export const VALIDADE_DO_DESAFIO_MS = 5 * 60 * 1000;
export const VALIDADE_DO_CODIGO_MS = 10 * 60 * 1000;
/** Depois de aprovada, a verificação vale por 30 minutos para concluir a assinatura. */
export const VALIDADE_DA_APROVACAO_MS = 30 * 60 * 1000;
export const TENTATIVAS_POR_DESAFIO = 5;

/** Palavras curtas, sem homófonos comuns e fáceis de transcrever em pt-BR. */
export const PALAVRAS = [
  'girassol',
  'cometa',
  'aurora',
  'montanha',
  'oceano',
  'floresta',
  'janela',
  'relógio',
  'biscoito',
  'tucano',
  'abacaxi',
  'violino',
  'planeta',
  'caderno',
  'bicicleta',
  'castelo',
  'margarida',
  'pipoca',
  'trovão',
  'arco-íris',
  'baleia',
  'coruja',
  'farol',
  'jardim',
  'limonada',
  'museu',
  'navio',
  'orquídea',
  'pinguim',
  'safira',
  'tapete',
  'vulcão',
] as const;

export const GESTOS = ['Open_Palm', 'Closed_Fist', 'Pointing_Up', 'Thumb_Up', 'Victory'] as const;
export type Gesto = (typeof GESTOS)[number];

export const ACOES_DE_VIVACIDADE = ['piscar', 'virar_esquerda', 'virar_direita'] as const;
export type AcaoDeVivacidade = (typeof ACOES_DE_VIVACIDADE)[number];

/** Embaralhamento Fisher–Yates com `randomInt` (criptográfico) — `Math.random` é previsível. */
export function sortear<T>(itens: readonly T[], quantidade: number): T[] {
  const copia = [...itens];

  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);

    [copia[i], copia[j]] = [copia[j], copia[i]];
  }

  return copia.slice(0, quantidade);
}

export interface ResultadoDoDesafio {
  readonly aprovado: boolean;
  /** 0 a 1. */
  readonly pontuacao: number;
  readonly motivo?: string;
}

/**
 * Voz: todas as palavras sorteadas precisam aparecer na transcrição, em
 * qualquer ordem, como palavras inteiras. Acento, caixa e pontuação não contam
 * — o reconhecimento de fala do navegador não é consistente com eles.
 */
export function avaliarVoz(palavras: readonly string[], transcricao: string): ResultadoDoDesafio {
  const falado = new Set(normalizar(transcricao).split(' '));
  const faladoJunto = normalizar(transcricao).replace(/\s/g, '');
  const acertos = palavras.filter((palavra) => {
    const alvo = normalizar(palavra);

    // "arco-íris" chega como "arco iris" ou "arcoiris", conforme o navegador.
    return alvo.includes(' ') ? faladoJunto.includes(alvo.replace(/\s/g, '')) : falado.has(alvo);
  });
  const pontuacao = palavras.length === 0 ? 0 : acertos.length / palavras.length;

  return pontuacao === 1
    ? { aprovado: true, pontuacao }
    : {
        aprovado: false,
        pontuacao,
        motivo: `Reconhecemos ${acertos.length} de ${palavras.length} palavras. Fale devagar, perto do microfone, e tente de novo.`,
      };
}

/** Gestos: a sequência reconhecida precisa ser exatamente a sorteada, com confiança mínima. */
export function avaliarGestos(
  esperada: readonly string[],
  reconhecida: readonly string[],
  confiancas: readonly number[],
): ResultadoDoDesafio {
  const media =
    confiancas.length === 0 ? 0 : confiancas.reduce((soma, c) => soma + c, 0) / confiancas.length;
  const confere =
    esperada.length === reconhecida.length &&
    esperada.every((gesto, i) => reconhecida[i] === gesto);

  if (!confere)
    return {
      aprovado: false,
      pontuacao: 0,
      motivo: 'A sequência de gestos não confere com a pedida.',
    };

  return media >= 0.6
    ? { aprovado: true, pontuacao: arredondar(media) }
    : {
        aprovado: false,
        pontuacao: arredondar(media),
        motivo: 'Os gestos não ficaram nítidos. Aproxime a mão e procure mais luz.',
      };
}

/**
 * Rosto com prova de vida: as ações pedidas, na ordem, com rosto presente na
 * maior parte dos quadros analisados e confiança de detecção razoável.
 */
export function avaliarFacial(
  acoesPedidas: readonly string[],
  medicao: {
    acoes: readonly string[];
    quadrosAnalisados: number;
    quadrosComRosto: number;
    confiancaMedia: number;
    rostosMultiplos: boolean;
  },
): ResultadoDoDesafio {
  if (medicao.rostosMultiplos) {
    return {
      aprovado: false,
      pontuacao: 0,
      motivo: 'Detectamos mais de um rosto. Faça a verificação sozinho diante da câmera.',
    };
  }

  const presenca =
    medicao.quadrosAnalisados === 0 ? 0 : medicao.quadrosComRosto / medicao.quadrosAnalisados;
  const acoesConferem =
    acoesPedidas.length === medicao.acoes.length &&
    acoesPedidas.every((acao, i) => medicao.acoes[i] === acao);
  const pontuacao = arredondar(presenca * 0.5 + medicao.confiancaMedia * 0.5);

  if (medicao.quadrosAnalisados < 10)
    return {
      aprovado: false,
      pontuacao,
      motivo: 'A verificação foi rápida demais. Tente de novo.',
    };
  if (!acoesConferem)
    return {
      aprovado: false,
      pontuacao,
      motivo: 'As ações de prova de vida não foram concluídas na ordem pedida.',
    };
  if (presenca < 0.6 || medicao.confiancaMedia < 0.5) {
    return {
      aprovado: false,
      pontuacao,
      motivo: 'Seu rosto não ficou visível o suficiente. Procure um lugar mais iluminado.',
    };
  }

  return { aprovado: true, pontuacao };
}

function arredondar(valor: number): number {
  return Math.round(Math.max(0, Math.min(1, valor)) * 1000) / 1000;
}
