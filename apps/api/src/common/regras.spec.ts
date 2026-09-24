import { PDFDocument } from 'pdf-lib';
import { ehAVezDe } from './assinaturas/convites.service';
import { montarPdfAssinado, paraWinAnsi } from './assinaturas/pdf-assinado';
import {
  ehTerminal,
  podeTransicionar,
  TRANSICOES,
  VERIFICACOES_DO_NIVEL,
} from './assinaturas/status-do-documento';
import { PERMISSOES, pode } from './auth/permissoes';
import { normalizarIp } from './auth/requisicao';
import { LIMITES_DO_PLANO, inicioDoMes } from './planos';
import { abreviarNome, cpfValido, mascararCpf, mascararEmail, normalizar } from './texto/mascaras';
import { CENSURA, redigirProfundo } from '../config/logger/redaction';

describe('Máquina de estados do documento', () => {
  it('só rascunho é enviado, e só em andamento conclui, recusa, expira ou cancela', () => {
    expect(podeTransicionar('rascunho', 'em_andamento')).toBe(true);
    expect(podeTransicionar('rascunho', 'concluido')).toBe(false);
    expect(podeTransicionar('em_andamento', 'cancelado')).toBe(true);
    expect(podeTransicionar('concluido', 'cancelado')).toBe(false);
  });

  it('estados terminais não saem para lugar nenhum', () => {
    for (const status of ['concluido', 'cancelado', 'recusado', 'expirado'] as const) {
      expect(ehTerminal(status)).toBe(true);
      expect(TRANSICOES[status]).toEqual([]);
    }
  });

  it('o código por e-mail é exigido em todos os níveis, e vem primeiro', () => {
    for (const nivel of ['simples', 'biometrico', 'completo'] as const)
      expect(VERIFICACOES_DO_NIVEL[nivel][0]).toBe('codigo_email');
    expect(VERIFICACOES_DO_NIVEL.completo).toEqual(['codigo_email', 'facial', 'voz', 'gestos']);
  });
});

describe('De quem é a vez', () => {
  const todos = [
    { ordem: 1, status: 'assinado' as const },
    { ordem: 2, status: 'visualizado' as const },
    { ordem: 3, status: 'pendente' as const },
  ];

  it('em ordem: só depois de todos os anteriores assinarem', () => {
    expect(ehAVezDe(todos[1], todos, true)).toBe(true);
    expect(ehAVezDe(todos[2], todos, true)).toBe(false);
  });

  it('em paralelo: qualquer um que não assinou nem recusou', () => {
    expect(ehAVezDe(todos[2], todos, false)).toBe(true);
    expect(ehAVezDe(todos[0], todos, false)).toBe(false);
  });
});

describe('Permissões por papel', () => {
  it('proprietário pode tudo', () => {
    for (const permissao of PERMISSOES) expect(pode('proprietario', permissao)).toBe(true);
  });

  it('administrador não mexe na organização', () => {
    expect(pode('administrador', 'organizacao.gerenciar')).toBe(false);
    expect(pode('administrador', 'equipe.gerenciar')).toBe(true);
  });

  it('membro só cria; auditor só lê', () => {
    expect(PERMISSOES.filter((p) => pode('membro', p))).toEqual(['documentos.criar']);
    expect(pode('auditor', 'documentos.criar')).toBe(false);
    expect(pode('auditor', 'auditoria.ver')).toBe(true);
    expect(pode('auditor', 'equipe.gerenciar')).toBe(false);
  });
});

describe('Máscaras e validações de dado pessoal', () => {
  it('valida CPF pelos dígitos verificadores e recusa sequências repetidas', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('529.982.247-26')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('123')).toBe(false);
  });

  it('mascara e-mail, CPF e nome para a página pública', () => {
    expect(mascararEmail('mariana.albuquerque@nimbus.com.br')).toBe('ma••••••@nimbus.com.br');
    expect(mascararCpf('25')).toBe('•••.•••.•••-25');
    expect(mascararCpf(null)).toBeNull();
    expect(abreviarNome('Mariana Albuquerque Souza')).toBe('Mariana A. S.');
  });

  it('normaliza texto para comparação de fala', () => {
    expect(normalizar('  Trovão, ÁRVORE!  ')).toBe('trovao arvore');
  });

  it('normaliza IP mapeado e o loopback IPv6', () => {
    expect(normalizarIp('::ffff:10.0.0.1')).toBe('10.0.0.1');
    expect(normalizarIp('::1')).toBe('127.0.0.1');
    expect(normalizarIp('189.44.12.31')).toBe('189.44.12.31');
  });
});

describe('Redação de log', () => {
  it('redige campo sensível em qualquer profundidade e corta ciclos', () => {
    const ciclico: Record<string, unknown> = { nome: 'Ana' };

    ciclico.eu = ciclico;

    const redigido = redigirProfundo({
      corpo: { senha: 'x', signatarios: [{ cpf: '1', email: 'a@b' }] },
      token: 't',
      ciclico,
    }) as {
      token: string;
      corpo: { senha: string; signatarios: { cpf: string; email: string }[] };
      ciclico: { eu: unknown };
    };

    expect(redigido.token).toBe(CENSURA);
    expect(redigido.corpo.senha).toBe(CENSURA);
    expect(redigido.corpo.signatarios[0].cpf).toBe(CENSURA);
    expect(redigido.corpo.signatarios[0].email).toBe('a@b');
    expect(redigido.ciclico.eu).toBe('[Circular]');
  });
});

describe('Planos', () => {
  it('básico limita envios e equipe; empresarial é ilimitado', () => {
    expect(LIMITES_DO_PLANO.basico).toEqual({ enviosPorMes: 10, membros: 3 });
    expect(LIMITES_DO_PLANO.empresarial.enviosPorMes).toBeNull();
  });

  it('o mês começa à meia-noite de Brasília, não UTC', () => {
    // 01/03 às 01h UTC ainda é 28/02 em Brasília.
    expect(inicioDoMes(new Date('2026-03-01T01:00:00Z')).toISOString()).toBe(
      '2026-02-01T03:00:00.000Z',
    );
    expect(inicioDoMes(new Date('2026-03-15T12:00:00Z')).toISOString()).toBe(
      '2026-03-01T03:00:00.000Z',
    );
  });
});

describe('PDF final', () => {
  it('troca caracteres fora do WinAnsi em vez de derrubar a conclusão', () => {
    expect(paraWinAnsi('Contrato 📄 — ação “ok”')).toBe('Contrato ? — ação “ok”');
  });

  it('carimba as páginas, acrescenta o manifesto e embute as evidências', async () => {
    const original = await PDFDocument.create();

    original.addPage();
    original.addPage();

    const bytes = await montarPdfAssinado(await original.save(), {
      titulo: 'Contrato 🚀 de teste',
      codigo: 'LS-ABCD-EFGH',
      urlDeValidacao: 'http://localhost:5190/validar/LS-ABCD-EFGH',
      hashOriginal: 'a'.repeat(64),
      paginas: 2,
      organizacao: 'Aurora',
      remetente: 'Ana',
      enviadoEm: new Date(),
      concluidoEm: new Date(),
      idDaChave: '0123456789abcdef',
      evidencias: '{"versao":1}',
      signatarios: Array.from({ length: 7 }, (_, i) => ({
        nome: `Signatário ${i}`,
        emailMascarado: 'si•••@x.com',
        cpfMascarado: null,
        assinadoEm: new Date(),
        ip: '127.0.0.1',
        verificacoes: ['código por e-mail'],
        imagemPng: null,
        idDaAssinatura: 'abc',
      })),
    });
    const final = await PDFDocument.load(bytes);

    // 2 originais + manifesto (7 cartões não cabem numa página só).
    expect(final.getPageCount()).toBeGreaterThanOrEqual(4);
    expect(final.getTitle()).toBe('Contrato ? de teste');
    expect(Buffer.from(bytes).toString('latin1')).toContain('letssign-evidencias.json');
  });
});
