/**
 * JSON **canônico**: chaves ordenadas em qualquer profundidade, sem espaços.
 *
 * ## Por que isto existe
 *
 * Uma assinatura digital cobre **bytes**, não objetos. `JSON.stringify` preserva
 * a ordem de inserção das chaves — o mesmo objeto montado em outra ordem (outra
 * versão do código, outra linguagem num verificador independente) produziria
 * outros bytes, e uma assinatura válida pareceria adulterada.
 *
 * Com a forma canônica, qualquer pessoa reconstrói exatamente os bytes que
 * foram assinados a partir dos mesmos dados, e a verificação independe de quem
 * serializou.
 *
 * ⚠️ `undefined` é omitido (como no JSON), e `Date` vira ISO-8601 — datas são o
 * dado mais comum numa carga de assinatura.
 */
export function jsonCanonico(valor: unknown): string {
  return JSON.stringify(ordenar(valor));
}

function ordenar(valor: unknown): unknown {
  if (valor instanceof Date) return valor.toISOString();

  if (Array.isArray(valor)) return valor.map(ordenar);

  if (valor === null || typeof valor !== 'object') return valor;

  const origem = valor as Record<string, unknown>;
  const destino: Record<string, unknown> = {};

  for (const chave of Object.keys(origem).sort()) {
    if (origem[chave] !== undefined) destino[chave] = ordenar(origem[chave]);
  }

  return destino;
}
