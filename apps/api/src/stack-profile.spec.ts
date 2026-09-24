import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guarda do `.claude/stack-profile.md`: as skills do harness executam os comandos
 * citados lá. Um script renomeado no `package.json` e esquecido no profile faria
 * o `executar-review` rodar um comando que não existe — e concluir que "passou".
 */
const raiz = resolve(__dirname, '../../..');
const profile = readFileSync(resolve(raiz, '.claude/stack-profile.md'), 'utf8');

function scripts(caminho: string): Set<string> {
  const pacote = JSON.parse(readFileSync(resolve(raiz, caminho, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };

  return new Set(Object.keys(pacote.scripts));
}

function comandosDaSecao(titulo: string): string[] {
  const inicio = profile.indexOf(titulo);
  const fim = profile.indexOf('\n#', inicio + titulo.length);
  const secao = profile.slice(inicio, fim === -1 ? undefined : fim);

  return [...secao.matchAll(/npm run ([\w:-]+)(?! -w)/g)].map(([, script]) => script);
}

describe('stack-profile.md', () => {
  it.each([
    ['### Raiz do repositório', '.'],
    ['### `apps/api`', 'apps/api'],
    ['### `apps/web`', 'apps/web'],
  ])('todo comando citado em "%s" existe no package.json de %s', (titulo, pasta) => {
    const citados = comandosDaSecao(titulo);
    const existentes = scripts(pasta);

    expect(citados.length).toBeGreaterThan(0);
    expect(citados.filter((script) => !existentes.has(script))).toEqual([]);
  });
});
