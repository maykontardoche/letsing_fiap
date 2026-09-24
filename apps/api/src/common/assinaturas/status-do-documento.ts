import type { NivelDeVerificacao, StatusDoDocumento, TipoDeVerificacao } from '@prisma/client';

/**
 * A máquina de estados do documento.
 *
 * ```
 * rascunho ──enviar──▶ em_andamento ──última assinatura──▶ concluido
 *    │                     ├──recusa de um signatário──▶ recusado
 *    │                     ├──prazo vencido────────────▶ expirado
 *    └──excluir            └──cancelar─────────────────▶ cancelado
 * ```
 *
 * ⚠️ **É uma tabela, não uma sequência de `if`.** Transição fora dela é recusada
 * com 422, e a tabela é pura — cada par proibido é testável sem banco.
 */
export const TRANSICOES: Readonly<Record<StatusDoDocumento, readonly StatusDoDocumento[]>> = {
  rascunho: ['em_andamento'],
  em_andamento: ['concluido', 'recusado', 'expirado', 'cancelado'],
  concluido: [],
  recusado: [],
  expirado: [],
  cancelado: [],
};

export function podeTransicionar(de: StatusDoDocumento, para: StatusDoDocumento): boolean {
  return TRANSICOES[de].includes(para);
}

export function ehTerminal(status: StatusDoDocumento): boolean {
  return TRANSICOES[status].length === 0;
}

/**
 * As verificações de identidade exigidas por nível, **na ordem** em que o
 * signatário as faz.
 *
 * ⚠️ O código por e-mail está em todos os níveis e vem primeiro: ele prova a
 * posse da caixa de e-mail para onde o convite foi — sem ele, quem interceptasse
 * o link (um encaminhamento descuidado) assinaria no lugar do destinatário.
 */
export const VERIFICACOES_DO_NIVEL: Readonly<
  Record<NivelDeVerificacao, readonly TipoDeVerificacao[]>
> = {
  simples: ['codigo_email'],
  biometrico: ['codigo_email', 'facial'],
  completo: ['codigo_email', 'facial', 'voz', 'gestos'],
};

export const ROTULO_DA_VERIFICACAO: Readonly<Record<TipoDeVerificacao, string>> = {
  codigo_email: 'código por e-mail',
  facial: 'reconhecimento facial com prova de vida',
  voz: 'desafio de voz',
  gestos: 'sequência de gestos',
};

export const ROTULO_DO_STATUS: Readonly<Record<StatusDoDocumento, string>> = {
  rascunho: 'Rascunho',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  recusado: 'Recusado',
  expirado: 'Expirado',
};
