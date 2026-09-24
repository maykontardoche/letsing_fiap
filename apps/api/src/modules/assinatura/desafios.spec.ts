import {
  ACOES_DE_VIVACIDADE,
  avaliarFacial,
  avaliarGestos,
  avaliarVoz,
  GESTOS,
  PALAVRAS,
  sortear,
} from './desafios';

describe('Desafio de voz', () => {
  it('aprova com todas as palavras, em qualquer ordem, ignorando acento, caixa e pontuação', () => {
    expect(avaliarVoz(['trovão', 'Cometa', 'aurora'], 'Aurora, cometa... e TROVAO!')).toEqual({
      aprovado: true,
      pontuacao: 1,
    });
  });

  it('reprova quando falta uma palavra e diz quantas foram reconhecidas', () => {
    const resultado = avaliarVoz(['girassol', 'cometa', 'aurora'], 'girassol cometa');

    expect(resultado.aprovado).toBe(false);
    expect(resultado.pontuacao).toBeCloseTo(2 / 3);
    expect(resultado.motivo).toContain('2 de 3');
  });

  it('palavra dentro de outra não conta ("mar" em "margarida")', () => {
    expect(avaliarVoz(['cometa'], 'cometas').aprovado).toBe(false);
  });

  it('palavra composta aceita as duas transcrições comuns ("arco íris" e "arcoiris")', () => {
    expect(avaliarVoz(['arco-íris'], 'arco íris').aprovado).toBe(true);
    expect(avaliarVoz(['arco-íris'], 'arcoiris').aprovado).toBe(true);
  });
});

describe('Sequência de gestos', () => {
  const pedida = ['Open_Palm', 'Thumb_Up', 'Victory'];

  it('aprova a sequência exata com confiança suficiente', () => {
    expect(avaliarGestos(pedida, pedida, [0.9, 0.8, 0.85])).toMatchObject({ aprovado: true });
  });

  it('reprova fora de ordem', () => {
    expect(
      avaliarGestos(pedida, ['Thumb_Up', 'Open_Palm', 'Victory'], [0.9, 0.9, 0.9]).aprovado,
    ).toBe(false);
  });

  it('reprova com confiança média baixa', () => {
    expect(avaliarGestos(pedida, pedida, [0.5, 0.55, 0.6]).aprovado).toBe(false);
  });
});

describe('Rosto com prova de vida', () => {
  const pedidas = ['virar_esquerda', 'piscar'];
  const boa = {
    acoes: pedidas,
    quadrosAnalisados: 40,
    quadrosComRosto: 36,
    confiancaMedia: 0.9,
    rostosMultiplos: false,
  };

  it('aprova com as ações na ordem e rosto presente', () => {
    expect(avaliarFacial(pedidas, boa)).toMatchObject({ aprovado: true });
  });

  it('reprova com mais de um rosto', () => {
    expect(avaliarFacial(pedidas, { ...boa, rostosMultiplos: true }).aprovado).toBe(false);
  });

  it('reprova ações fora de ordem ou incompletas', () => {
    expect(avaliarFacial(pedidas, { ...boa, acoes: ['piscar', 'virar_esquerda'] }).aprovado).toBe(
      false,
    );
    expect(avaliarFacial(pedidas, { ...boa, acoes: ['virar_esquerda'] }).aprovado).toBe(false);
  });

  it('reprova rosto pouco visível e amostra curta demais', () => {
    expect(avaliarFacial(pedidas, { ...boa, quadrosComRosto: 10 }).aprovado).toBe(false);
    expect(
      avaliarFacial(pedidas, { ...boa, quadrosAnalisados: 5, quadrosComRosto: 5 }).aprovado,
    ).toBe(false);
  });
});

describe('Sorteio dos desafios', () => {
  it('sorteia itens distintos do conjunto', () => {
    for (let i = 0; i < 100; i += 1) {
      const palavras = sortear(PALAVRAS, 3);
      const gestos = sortear(GESTOS, 3);
      const acoes = sortear(ACOES_DE_VIVACIDADE, 2);

      expect(new Set(palavras).size).toBe(3);
      expect(new Set(gestos).size).toBe(3);
      expect(new Set(acoes).size).toBe(2);
    }
  });

  it('varia de um sorteio para o outro', () => {
    const vistos = new Set(Array.from({ length: 50 }, () => sortear(PALAVRAS, 3).join(',')));

    expect(vistos.size).toBeGreaterThan(40);
  });
});
