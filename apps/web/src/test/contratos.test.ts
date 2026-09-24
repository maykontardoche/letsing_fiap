/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLANOS } from '@/constants/planos';
import { REQUISITOS_DA_SENHA } from '@/pages/auth/ForcaDaSenha';

const raiz = resolve(__dirname, '../../..');

/**
 * Contratos entre o SPA e a API que não passam por tipo: o front mostra, o
 * servidor decide — e os dois precisam dizer a mesma coisa.
 */
describe('contratos com a API', () => {
  it('o limite de envios de cada plano na tela é o que o servidor aplica', () => {
    const planos = readFileSync(resolve(raiz, 'api/src/common/planos.ts'), 'utf8');

    for (const plano of PLANOS) {
      const limite = new RegExp(`${plano.id}: \\{ enviosPorMes: (\\d+|null)`).exec(planos)?.[1];

      expect(limite, `plano ${plano.id}`).toBe(
        plano.enviosPorMes === null ? 'null' : String(plano.enviosPorMes),
      );
    }
  });

  it('a política de senha na tela é a mesma do servidor', () => {
    const senha = readFileSync(resolve(raiz, 'api/src/common/cripto/senha.ts'), 'utf8');
    const casos = [
      'curta',
      'semmaiuscula1!',
      'SEMMINUSCULA1!',
      'SemNumero!!!',
      'SemSimbolo123',
      'Completa@2026',
    ];

    // A regra do servidor, extraída do próprio arquivo, aplicada aos mesmos casos.
    const servidor = (s: string) =>
      s.length >= Number(/senha\.length < (\d+)/.exec(senha)?.[1]) &&
      /[a-z]/.test(s) &&
      /[A-Z]/.test(s) &&
      /\d/.test(s) &&
      /[^A-Za-z0-9]/.test(s);

    for (const caso of casos) {
      expect(
        REQUISITOS_DA_SENHA.every((r) => r.teste(caso)),
        caso,
      ).toBe(servidor(caso));
    }
  });
});

/** Contraste WCAG 2.2 AA calculado a partir dos tokens — mudar uma cor que reprove quebra a suíte. */
describe('contraste dos tokens (WCAG AA ≥ 4.5:1)', () => {
  const css = readFileSync(resolve(__dirname, '../styles/tokens.css'), 'utf8');

  const bloco = (seletor: string) => {
    const inicio = css.indexOf(seletor);
    const corpo = css.slice(inicio, css.indexOf('}', inicio));

    return Object.fromEntries(
      [...corpo.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, nome, cor]) => [nome, cor]),
    );
  };

  const luminancia = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;

      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const contraste = (a: string, b: string) => {
    const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];

    return (l1 + 0.05) / (l2 + 0.05);
  };

  const pares = [
    ['tinta', 'fundo'],
    ['tinta', 'superficie'],
    ['tinta-2', 'superficie'],
    ['tinta-3', 'superficie'],
    ['destaque-tinta', 'destaque-suave'],
    ['sucesso-tinta', 'sucesso-suave'],
    ['alerta-tinta', 'alerta-suave'],
    ['perigo-tinta', 'perigo-suave'],
    ['neutro-tinta', 'neutro-suave'],
  ] as const;

  for (const [tema, seletor] of [
    ['claro', ':root {'],
    ['escuro', ":root[data-tema='escuro'] {"],
  ] as const) {
    it.each(pares)(`tema ${tema}: --%s sobre --%s`, (texto, fundo) => {
      const cores = bloco(seletor);

      expect(contraste(cores[texto], cores[fundo])).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('o botão primário (branco sobre o gradiente -texto) passa em todas as paradas', () => {
    const gradiente = /--gradiente-marca-texto:[^;]+/.exec(css)?.[0] ?? '';

    for (const cor of gradiente.match(/#[0-9a-f]{6}/gi) ?? [])
      expect(contraste('#ffffff', cor)).toBeGreaterThanOrEqual(4.5);
  });
});
