import { traduzirErro } from './erros';

const BASE_URL: string = import.meta.env.VITE_API_URL ?? '/api';

type Metodo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface Opcoes {
  readonly metodo?: Metodo;
  readonly corpo?: unknown;
  readonly sinal?: AbortSignal;
}

/**
 * **Única porta de saída para a API.** Nenhum `fetch` fora daqui.
 *
 * ## ⚠️ Sessão em cookie httpOnly, não em token
 *
 * A sessão vive no servidor (Redis) e viaja num cookie `httpOnly`. Não há token
 * no JavaScript — logo, **XSS não alcança a sessão**. O navegador manda o cookie
 * sozinho, desde que se peça `credentials: 'include'`.
 *
 * `FormData` vai cru (o navegador monta o `multipart` com o boundary certo);
 * qualquer outro corpo vira JSON.
 */
async function requisitar<T>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const ehFormulario = opcoes.corpo instanceof FormData;
  const temCorpo = opcoes.corpo !== undefined;

  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    method: opcoes.metodo ?? 'GET',
    headers: temCorpo && !ehFormulario ? { 'Content-Type': 'application/json' } : undefined,
    body: temCorpo ? (ehFormulario ? opcoes.corpo : JSON.stringify(opcoes.corpo)) : undefined,
    signal: opcoes.sinal,
    credentials: 'include',
  });

  const texto = await resposta.text();
  let corpo: unknown = null;

  if (texto.length > 0) {
    try {
      corpo = JSON.parse(texto) as unknown;
    } catch {
      corpo = texto;
    }
  }

  if (!resposta.ok) throw traduzirErro(resposta.status, corpo);

  return corpo as T;
}

export const http = {
  get: <T>(caminho: string, sinal?: AbortSignal) => requisitar<T>(caminho, { sinal }),
  post: <T>(caminho: string, corpo?: unknown) => requisitar<T>(caminho, { metodo: 'POST', corpo }),
  put: <T>(caminho: string, corpo?: unknown) => requisitar<T>(caminho, { metodo: 'PUT', corpo }),
  patch: <T>(caminho: string, corpo?: unknown) =>
    requisitar<T>(caminho, { metodo: 'PATCH', corpo }),
  delete: <T>(caminho: string) => requisitar<T>(caminho, { metodo: 'DELETE' }),
};

/** URL absoluta de um recurso da API (download de PDF, `<iframe>`, `react-pdf`). */
export function urlDaApi(caminho: string): string {
  return `${BASE_URL}${caminho}`;
}
