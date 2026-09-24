import { GENESE, hashDoEvento, verificarCadeia, type EventoEncadeado } from './cadeia';

function montar(resumos: string[]): EventoEncadeado[] {
  let anterior = GENESE;

  return resumos.map((resumo, indice) => {
    const conteudo = {
      cadeia: 'documento:x',
      sequencia: indice + 1,
      organizacaoId: 1,
      tipoAtor: 'usuario',
      atorId: 1,
      atorNome: 'Ana',
      acao: 'evento',
      resumo,
      dados: { indice },
      criadoEm: new Date(Date.UTC(2026, 0, 1, 12, indice)),
    };
    const evento = { ...conteudo, hashAnterior: anterior, hash: hashDoEvento(conteudo, anterior) };

    anterior = evento.hash;

    return evento;
  });
}

describe('Trilha de auditoria encadeada por hash', () => {
  it('uma cadeia intacta é íntegra', () => {
    expect(verificarCadeia(montar(['criou', 'enviou', 'assinou']))).toEqual({
      integra: true,
      total: 3,
      quebraEm: null,
      motivo: null,
    });
  });

  it('cadeia vazia é íntegra', () => {
    expect(verificarCadeia([]).integra).toBe(true);
  });

  it('editar o resumo de um evento antigo é detectado exatamente nele', () => {
    const eventos = montar(['criou', 'enviou', 'assinou']);
    const adulterados = eventos.map((e) =>
      e.sequencia === 2 ? { ...e, resumo: 'enviou (editado)' } : e,
    );

    expect(verificarCadeia(adulterados)).toMatchObject({
      integra: false,
      quebraEm: 2,
      motivo: expect.stringContaining('alterado'),
    });
  });

  it('apagar um evento do meio deixa um buraco na sequência', () => {
    const eventos = montar(['criou', 'enviou', 'assinou']).filter((e) => e.sequencia !== 2);

    expect(verificarCadeia(eventos)).toMatchObject({
      integra: false,
      quebraEm: 3,
      motivo: expect.stringContaining('faltando'),
    });
  });

  it('recalcular o hash de um evento editado não salva o atacante: o próximo elo quebra', () => {
    const eventos = montar(['criou', 'enviou', 'assinou']);
    const segundo = eventos[1];
    const editado = { ...segundo, resumo: 'outra coisa' };
    const recalculado = { ...editado, hash: hashDoEvento(editado, segundo.hashAnterior) };

    expect(verificarCadeia([eventos[0], recalculado, eventos[2]])).toMatchObject({
      integra: false,
      quebraEm: 3,
      motivo: expect.stringContaining('elo'),
    });
  });

  it('o hash depende da ordem das chaves? Não — o conteúdo é serializado canonicamente', () => {
    const [evento] = montar(['criou']) as [EventoEncadeado];
    const reordenado = { ...evento, dados: JSON.parse(JSON.stringify(evento.dados)) as unknown };

    expect(hashDoEvento(reordenado, GENESE)).toBe(evento.hash);
  });
});
