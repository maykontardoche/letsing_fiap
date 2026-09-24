import { describe, expect, it } from 'vitest';
import { CODIGO_MFA, ErroDaApi, mensagemDoErro, traduzirErro } from './erros';
import {
  contar,
  formatarBytes,
  formatarData,
  formatarDuracao,
  formatarMes,
  formatarPorcentagem,
  formatarRelativo,
  mascararCpf,
  saudacao,
} from './formatadores';
import { destinoSeguro } from './navegacao';

describe('destino pós-login (proteção contra open redirect)', () => {
  it('aceita caminhos internos', () => {
    expect(destinoSeguro('/app/documentos?status=concluido')).toBe(
      '/app/documentos?status=concluido',
    );
  });

  it.each([
    'https://site-malicioso.com',
    '//site-malicioso.com',
    '/\\site-malicioso.com',
    'javascript:alert(1)',
    '',
  ])('recusa %s e cai no padrão', (entrada) => {
    expect(destinoSeguro(entrada)).toBe('/app');
  });

  it('sem parâmetro, cai no padrão', () => {
    expect(destinoSeguro(null)).toBe('/app');
  });
});

describe('tradução do envelope de erro da API', () => {
  it('junta mensagens de validação em lista', () => {
    const erro = traduzirErro(400, {
      statusCode: 400,
      message: ['Nome curto.', 'E-mail inválido.'],
      error: 'Bad Request',
    });

    expect(erro.message).toBe('Nome curto.. E-mail inválido.');
    expect(erro.status).toBe(400);
  });

  it('distingue "falta o segundo fator" de "sem permissão" — os dois são 403', () => {
    expect(traduzirErro(403, { statusCode: 403, message: 'x', error: CODIGO_MFA }).precisaMfa).toBe(
      true,
    );
    expect(
      traduzirErro(403, { statusCode: 403, message: 'x', error: 'Forbidden' }).precisaMfa,
    ).toBe(false);
  });

  it('corpo que não é envelope vira mensagem genérica em português', () => {
    expect(traduzirErro(502, '<html>Bad Gateway</html>').message).toContain('servidor');
  });

  it('falha de rede vira mensagem de conexão', () => {
    expect(mensagemDoErro(new TypeError('Failed to fetch'))).toContain('conexão');
    expect(mensagemDoErro(new ErroDaApi(401, 'Sessão expirada.'))).toBe('Sessão expirada.');
  });
});

describe('formatadores pt-BR', () => {
  it('⚠️ null vira travessão, nunca zero nem data inventada', () => {
    expect(formatarData(null)).toBe('—');
    expect(formatarDuracao(null)).toBe('—');
    expect(formatarPorcentagem(null)).toBe('—');
    expect(formatarRelativo(undefined)).toBe('—');
  });

  it('datas no fuso de Brasília', () => {
    // 02h UTC do dia 2 ainda é dia 1 em Brasília.
    expect(formatarData('2026-03-02T02:00:00Z')).toBe('01 mar 2026');
    expect(formatarData('2026-12-25T15:00:00Z')).toBe('25 dez 2026');
  });

  it('tempo relativo', () => {
    const agora = new Date('2026-09-24T12:00:00Z');

    expect(formatarRelativo(new Date('2026-09-24T11:59:40Z'), agora)).toBe('agora mesmo');
    expect(formatarRelativo(new Date('2026-09-24T11:55:00Z'), agora)).toBe('há 5 minutos');
    expect(formatarRelativo(new Date('2026-09-23T12:00:00Z'), agora)).toBe('ontem');
  });

  it('bytes, duração, porcentagem e mês', () => {
    expect(formatarBytes(512)).toBe('512 B');
    expect(formatarBytes(15_888)).toBe('16 KB');
    expect(formatarBytes(2.5 * 1024 * 1024)).toBe('2,5 MB');
    expect(formatarDuracao(0.5)).toBe('30 min');
    expect(formatarDuracao(4.28)).toBe('4,3 h');
    expect(formatarDuracao(72)).toBe('3 dias');
    expect(formatarPorcentagem(0.7083)).toBe('71%');
    expect(formatarMes('2026-03')).toBe('mar');
  });

  it('máscara de CPF enquanto se digita', () => {
    expect(mascararCpf('529')).toBe('529');
    expect(mascararCpf('5299822')).toBe('529.982.2');
    expect(mascararCpf('52998224725999')).toBe('529.982.247-25');
  });

  it('saudação pelo horário de Brasília', () => {
    expect(saudacao(new Date('2026-09-24T12:00:00Z'))).toBe('Bom dia');
    expect(saudacao(new Date('2026-09-24T18:00:00Z'))).toBe('Boa tarde');
    expect(saudacao(new Date('2026-09-24T23:30:00Z'))).toBe('Boa noite');
  });
});

describe('contar', () => {
  it('concorda o substantivo com a quantidade', () => {
    expect(contar(1, 'pessoa ativa', 'pessoas ativas')).toBe('1 pessoa ativa');
    expect(contar(0, 'pessoa ativa', 'pessoas ativas')).toBe('0 pessoas ativas');
    expect(contar(4, 'cadeia', 'cadeias')).toBe('4 cadeias');
  });
});
