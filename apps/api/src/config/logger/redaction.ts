/**
 * Campos que nunca podem aparecer em log: credenciais, tokens de assinatura,
 * segredos de MFA e identificadores pessoais.
 *
 * A comparação é por **nome de campo, em qualquer profundidade** — ver
 * `redigirProfundo`. O `redact.paths` do pino só casa caminhos declarados, e o
 * mesmo campo aninhado num caminho não previsto passaria direto.
 */
export const CAMPOS_SENSIVEIS: ReadonlySet<string> = new Set([
  'authorization',
  'cookie',
  'setcookie',
  'senha',
  'senhaatual',
  'novasenha',
  'password',
  'token',
  'sessionid',
  'codigo',
  'otp',
  'totp',
  'mfasegredo',
  'mfacodigos',
  'segredo',
  'codigosrecuperacao',
  'cpf',
  'cpfcifrado',
  'imagemassinatura',
  'chaveprivada',
]);

export const CENSURA = '[REDIGIDO]';

const PROFUNDIDADE_MAXIMA = 8;

function ehSensivel(chave: string): boolean {
  return CAMPOS_SENSIVEIS.has(chave.toLowerCase().replace(/[_-]/g, ''));
}

/**
 * Redige campos sensíveis em **qualquer profundidade**. Referências circulares
 * são cortadas: objeto de log com ciclo derrubaria o serializador antes de
 * qualquer redação acontecer.
 */
export function redigirProfundo(
  valor: unknown,
  profundidade = 0,
  vistos = new WeakSet<object>(),
): unknown {
  if (profundidade > PROFUNDIDADE_MAXIMA || valor === null || typeof valor !== 'object') {
    return valor;
  }

  if (vistos.has(valor)) return '[Circular]';

  vistos.add(valor);

  if (Array.isArray(valor)) {
    return valor.map((item) => redigirProfundo(item, profundidade + 1, vistos));
  }

  const origem = valor as Record<string, unknown>;
  const destino: Record<string, unknown> = {};

  for (const chave of Object.keys(origem)) {
    destino[chave] = ehSensivel(chave)
      ? CENSURA
      : redigirProfundo(origem[chave], profundidade + 1, vistos);
  }

  return destino;
}
