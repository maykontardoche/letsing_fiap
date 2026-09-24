/**
 * Envelope de erro da API — ver `apps/api/src/common/filters/http-exception.filter.ts`.
 *
 * ⚠️ O contrato é "sempre tem estes campos", não "só tem estes": o servidor
 * preserva campos extras, e é assim que o sinal de MFA chega até aqui.
 */
interface EnvelopeDeErro {
  statusCode: number;
  message: string | string[];
  error: string;
}

/** O código que a API usa para dizer "a sessão é válida, mas falta o segundo fator". */
export const CODIGO_MFA = 'MFA_NECESSARIO';

/** Erro de domínio. A UI nunca lida com `Response` cru. */
export class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly codigo?: string,
  ) {
    super(message);
    this.name = 'ErroDaApi';
  }

  get ehSessaoExpirada(): boolean {
    return this.status === 401;
  }

  /**
   * ⚠️ 403 com este código NÃO é "sem permissão" — é "falta um passo". Tratar
   * como 401 mandaria a pessoa de volta ao login, num laço que nunca conclui.
   */
  get precisaMfa(): boolean {
    return this.codigo === CODIGO_MFA;
  }
}

function ehEnvelope(valor: unknown): valor is EnvelopeDeErro {
  return typeof valor === 'object' && valor !== null && 'message' in valor;
}

export function traduzirErro(status: number, corpo: unknown): ErroDaApi {
  if (!ehEnvelope(corpo)) {
    return new ErroDaApi(
      status,
      status >= 500
        ? 'O servidor não conseguiu completar a operação. Tente de novo em instantes.'
        : 'Não foi possível completar a operação.',
    );
  }

  const mensagem = Array.isArray(corpo.message) ? corpo.message.join('. ') : corpo.message;

  return new ErroDaApi(status, mensagem, corpo.error);
}

/** Mensagem legível de qualquer erro, para toast e alerta. */
export function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ErroDaApi) return erro.message;

  if (erro instanceof TypeError) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
  }

  return 'Algo deu errado. Tente de novo.';
}
