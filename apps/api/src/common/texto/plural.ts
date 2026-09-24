/**
 * `contar(1, 'signatário', 'signatários')` → `1 signatário`; `contar(3, …)` → `3 signatários`.
 *
 * ⚠️ Os resumos entram na trilha de auditoria (e no hash dela): texto como
 * "1 signatário(s)" fica gravado para sempre. Plural explícito, nunca "(s)".
 */
export function contar(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

/** Resumo da conclusão, gravado na trilha pelo finalizador e pelo seed. */
export function resumoDaConclusao(assinaturas: number): string {
  const coleta =
    assinaturas === 1
      ? 'A assinatura foi coletada'
      : `Todas as ${assinaturas} assinaturas foram coletadas`;

  return `${coleta}. PDF final gerado e selado pela plataforma.`;
}

/** Resumo do envio. Com um signatário só, "em ordem"/"em paralelo" não quer dizer nada — fica de fora. */
export function resumoDoEnvio(remetente: string, signatarios: number, sequencial: boolean): string {
  const modo = signatarios > 1 ? `, ${sequencial ? 'em ordem' : 'em paralelo'}` : '';

  return `${remetente} enviou o documento para assinatura (${contar(signatarios, 'signatário', 'signatários')}${modo}).`;
}
