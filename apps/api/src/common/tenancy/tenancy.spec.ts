import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MODELS_ESCOPADOS } from './models-escopados';
import {
  executarNoContexto,
  exigirOrganizacaoAtual,
  organizacaoAtual,
  semEscopoDeOrganizacao,
} from './tenant-context';
import { aplicarEscopo } from './tenant-extension';

describe('Escopo de organização — a transformação dos argumentos', () => {
  it('injeta organizacaoId no where de leitura e escrita direcionada', () => {
    for (const operacao of [
      'findMany',
      'findFirst',
      'findUnique',
      'count',
      'update',
      'updateMany',
      'delete',
      'deleteMany',
      'groupBy',
    ]) {
      expect(aplicarEscopo(operacao, { where: { uuid: 'x' } }, 7)).toEqual({
        where: { uuid: 'x', organizacaoId: 7 },
      });
    }
  });

  it('injeta mesmo sem where nenhum — findMany() "puro" não devolve a tabela inteira', () => {
    expect(aplicarEscopo('findMany', {}, 7)).toEqual({ where: { organizacaoId: 7 } });
  });

  it('⚠️ um organizacaoId de OUTRA organização vindo do chamador é sobrescrito no where', () => {
    expect(aplicarEscopo('findMany', { where: { organizacaoId: 99 } }, 7)).toEqual({
      where: { organizacaoId: 7 },
    });
  });

  it('preenche na criação só se estiver em branco — nunca sobrescreve valor explícito', () => {
    expect(aplicarEscopo('create', { data: { titulo: 'a' } }, 7)).toEqual({
      data: { titulo: 'a', organizacaoId: 7 },
    });
    expect(aplicarEscopo('create', { data: { titulo: 'a', organizacaoId: 3 } }, 7)).toEqual({
      data: { titulo: 'a', organizacaoId: 3 },
    });
    expect(aplicarEscopo('createMany', { data: [{ a: 1 }, { a: 2 }] }, 7)).toEqual({
      data: [
        { a: 1, organizacaoId: 7 },
        { a: 2, organizacaoId: 7 },
      ],
    });
  });

  it('upsert recebe o filtro no where e o preenchimento no create', () => {
    expect(aplicarEscopo('upsert', { where: { id: 1 }, create: { a: 1 }, update: {} }, 7)).toEqual({
      where: { id: 1, organizacaoId: 7 },
      create: { a: 1, organizacaoId: 7 },
      update: {},
    });
  });
});

describe('Contexto por requisição (AsyncLocalStorage)', () => {
  it('fora de contexto não há organização', () => {
    expect(organizacaoAtual()).toBeNull();
    expect(() => exigirOrganizacaoAtual()).toThrow(/Nenhuma organização no contexto/);
  });

  it('requisições concorrentes não enxergam o contexto uma da outra', async () => {
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const vistos: number[] = [];

    await Promise.all(
      [1, 2, 3, 4].map((id) =>
        executarNoContexto({ organizacaoId: id }, async () => {
          await espera(20 - id * 4);
          vistos.push(organizacaoAtual() as number);
          await espera(id * 3);
          expect(organizacaoAtual()).toBe(id);
        }),
      ),
    );

    expect(vistos.sort()).toEqual([1, 2, 3, 4]);
  });

  it('o escape hatch sai do contexto — e só dentro do callback', async () => {
    await executarNoContexto({ organizacaoId: 5 }, async () => {
      await semEscopoDeOrganizacao(async () => expect(organizacaoAtual()).toBeNull());
      expect(organizacaoAtual()).toBe(5);
    });
  });

  it('uma promise "preguiçosa" devolvida sem await ainda executa DENTRO do contexto', async () => {
    // Imita o PrismaPromise: só executa quando alguém chama .then().
    const preguicosa = {
      then: (resolver: (v: number | null) => void) => resolver(organizacaoAtual()),
    };

    await expect(
      executarNoContexto(
        { organizacaoId: 9 },
        () => preguicosa as unknown as Promise<number | null>,
      ),
    ).resolves.toBe(9);
  });
});

describe('Lista de models escopados', () => {
  /**
   * ⚠️ Gate: todo model do schema com `organizacaoId` precisa estar na lista. Um
   * model novo de negócio esquecido aqui seria consultado sem filtro — vazamento
   * entre organizações, em silêncio.
   */
  it('cobre todo model do schema que tem organizacaoId', () => {
    const schema = readFileSync(resolve(__dirname, '../../../prisma/schema.prisma'), 'utf8');
    const comOrganizacao = [...schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)]
      .filter(([, , corpo]) => /\n\s+organizacaoId\s+Int/.test(corpo ?? ''))
      .map(([, nome]) => nome.charAt(0).toLowerCase() + nome.slice(1));

    expect(comOrganizacao.length).toBeGreaterThan(5);
    expect([...MODELS_ESCOPADOS].sort()).toEqual(comOrganizacao.sort());
  });
});
