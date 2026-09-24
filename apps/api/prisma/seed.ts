/* eslint-disable no-console -- script de linha de comando, fora da aplicação */
import 'dotenv/config';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type NivelDeVerificacao, type Papel } from '@prisma/client';
import { ArmazenamentoService } from '../src/common/armazenamento/armazenamento.service';
import { montarPdfAssinado } from '../src/common/assinaturas/pdf-assinado';
import {
  ROTULO_DA_VERIFICACAO,
  VERIFICACOES_DO_NIVEL,
} from '../src/common/assinaturas/status-do-documento';
import { AuditoriaService } from '../src/common/auditoria/auditoria.service';
import { jsonCanonico } from '../src/common/cripto/canonico';
import { ChaveDaPlataformaService } from '../src/common/cripto/chave-da-plataforma.service';
import { chaveDeCifra, cifrar } from '../src/common/cripto/cifra';
import { gerarCodigoDeDocumento, gerarToken, sha256 } from '../src/common/cripto/hash';
import { gerarHashDeSenha } from '../src/common/cripto/senha';
import { executarNoContexto } from '../src/common/tenancy/tenant-context';
import { criarExtensaoDeOrganizacao } from '../src/common/tenancy/tenant-extension';
import { mascararCpf, mascararEmail } from '../src/common/texto/mascaras';
import { contar, resumoDaConclusao, resumoDoEnvio } from '../src/common/texto/plural';
import type { EnvService } from '../src/config/env/env.service';
import type { PrismaService } from '../src/config/database/prisma.service';
import { gerarContrato } from './seed/contrato';
import { rubricaDataUrl } from './seed/rubrica';

/**
 * Seed de DEMONSTRAÇÃO. ⚠️ Apaga tudo e recria — nunca roda em produção.
 *
 * Não insere linhas "prontas": **simula o ciclo de vida** de cada documento com
 * os mesmos serviços da aplicação (trilha encadeada, assinatura Ed25519, PDF
 * final, selo). Por isso tudo o que o seed cria passa na validação pública.
 */

const SENHA_DEMO = 'LetsSign@2026';
const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

if (process.env.NODE_ENV === 'production') {
  console.error('O seed de demonstração não roda em produção.');
  process.exit(1);
}

const diretorio = process.env.DIRETORIO_DE_ARMAZENAMENTO ?? './storage';
const appUrl = (process.env.APP_URL ?? 'http://localhost:5190').replace(/\/+$/, '');
const envFalso = {
  diretorioDeArmazenamento: diretorio,
  chavePrivadaEd25519: process.env.CHAVE_PRIVADA_ED25519,
  chaveDeCifra: process.env.ENCRYPTION_KEY ?? '',
} as unknown as EnvService;

const cru = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ?? 'postgresql://letssign:letssign@localhost:5452/letssign',
  }),
});
const db = cru.$extends(criarExtensaoDeOrganizacao());
const prismaFalso = { db } as unknown as PrismaService;
const auditoria = new AuditoriaService(prismaFalso);
const armazenamento = new ArmazenamentoService(envFalso);
const chaveDaPlataforma = new ChaveDaPlataformaService(envFalso);
const chaveDeCampo = chaveDeCifra(envFalso.chaveDeCifra);

type Desfecho = 'concluido' | 'em_andamento' | 'rascunho' | 'cancelado' | 'recusado' | 'expirado';

interface Pessoa {
  readonly nome: string;
  readonly email: string;
  readonly cpf?: string;
}

interface Cenario {
  readonly titulo: string;
  readonly partes: readonly [string, string];
  readonly criador: string;
  readonly nivel: NivelDeVerificacao;
  readonly sequencial?: boolean;
  readonly signatarios: readonly Pessoa[];
  readonly diasAtras: number;
  readonly desfecho: Desfecho;
  /** Quantos assinam antes do desfecho (em andamento, recusado, expirado). */
  readonly assinados?: number;
  readonly horasPorAssinatura?: number;
  readonly mensagem?: string;
}

const IPS = [
  '189.44.12.31',
  '177.92.201.8',
  '200.158.77.14',
  '191.33.140.207',
  '187.65.9.122',
  '179.118.54.90',
];

async function main(): Promise<void> {
  await chaveDaPlataforma.onModuleInit();
  console.log('▸ Limpando dados anteriores…');
  await limpar();

  const aurora = await cru.organizacao.create({
    data: {
      nome: 'Aurora Tecnologia',
      slug: 'aurora-tecnologia',
      plano: 'empresarial',
      criadoEm: new Date(Date.now() - 360 * DIA),
    },
  });
  const horizonte = await cru.organizacao.create({
    data: {
      nome: 'Horizonte Advocacia',
      slug: 'horizonte-advocacia',
      plano: 'profissional',
      criadoEm: new Date(Date.now() - 120 * DIA),
    },
  });

  const senhaHash = await gerarHashDeSenha(SENHA_DEMO);
  const pessoas: Record<string, { id: number; nome: string; email: string }> = {};

  const equipe: [string, string, string, Papel][] = [
    ['ana', 'Ana Ribeiro', 'ana@aurora.dev', 'proprietario'],
    ['bruno', 'Bruno Carvalho', 'bruno@aurora.dev', 'administrador'],
    ['carla', 'Carla Menezes', 'carla@aurora.dev', 'membro'],
    ['diego', 'Diego Nakamura', 'diego@aurora.dev', 'auditor'],
  ];

  for (const [apelido, nome, email, papel] of equipe) {
    const usuario = await cru.usuario.create({
      data: {
        organizacaoId: aurora.id,
        nome,
        email,
        papel,
        senhaHash,
        ultimoAcessoEm: new Date(Date.now() - Math.random() * 3 * DIA),
        criadoEm: new Date(Date.now() - 350 * DIA),
      },
    });

    pessoas[apelido] = usuario;
  }

  // Convite pendente — para a tela de Equipe mostrar esse estado.
  const convidada = await cru.usuario.create({
    data: {
      organizacaoId: aurora.id,
      nome: 'Eduarda Pires',
      email: 'eduarda@aurora.dev',
      papel: 'membro',
    },
  });
  await cru.tokenDeSenha.create({
    data: {
      usuarioId: convidada.id,
      tokenHash: gerarToken().hash,
      finalidade: 'convite',
      expiraEm: new Date(Date.now() + 3 * DIA),
    },
  });

  const helena = await cru.usuario.create({
    data: {
      organizacaoId: horizonte.id,
      nome: 'Helena Duarte',
      email: 'helena@horizonte.dev',
      papel: 'proprietario',
      senhaHash,
    },
  });

  await executarNoContexto({ organizacaoId: aurora.id }, async () => {
    await auditoria.registrar({
      acao: 'organizacao_criada',
      resumo: 'Ana Ribeiro criou a organização Aurora Tecnologia.',
      tipoAtor: 'usuario',
      atorId: pessoas.ana?.id,
      atorNome: 'Ana Ribeiro',
      em: new Date(Date.now() - 360 * DIA),
    });
    await auditoria.registrar({
      acao: 'membro_convidado',
      resumo: 'Ana Ribeiro convidou Eduarda Pires como Membro.',
      tipoAtor: 'usuario',
      atorId: pessoas.ana?.id,
      atorNome: 'Ana Ribeiro',
      em: new Date(Date.now() - 2 * DIA),
    });

    console.log('▸ Simulando o ciclo de vida dos documentos da Aurora…');

    for (const [indice, cenario] of CENARIOS.entries()) {
      await simular(cenario, aurora.id, pessoas, indice);
      process.stdout.write('.');
    }

    process.stdout.write('\n');
  });

  await executarNoContexto({ organizacaoId: horizonte.id }, async () => {
    await simular(
      {
        titulo: 'Procuração Ad Judicia — Processo 0012345-67',
        partes: ['Horizonte Advocacia', 'Cliente'],
        criador: 'helena',
        nivel: 'biometrico',
        signatarios: [{ nome: 'Roberto Almeida', email: 'roberto.almeida@example.com' }],
        diasAtras: 12,
        desfecho: 'concluido',
      },
      horizonte.id,
      { helena },
      99,
    );
  });

  const totais = await cru.documento.groupBy({ by: ['status'], _count: true });

  console.log('\n✔ Seed concluído.');
  console.log(`  Documentos: ${totais.map((t) => `${t.status}=${t._count}`).join(', ')}`);
  console.log(`  Eventos de auditoria: ${await cru.eventoDeAuditoria.count()}`);
  console.log('\n  Contas de demonstração (senha: LetsSign@2026):');
  console.log('    ana@aurora.dev      proprietária');
  console.log('    bruno@aurora.dev    administrador');
  console.log('    carla@aurora.dev    membro');
  console.log('    diego@aurora.dev    auditor');
  console.log('    helena@horizonte.dev  outra organização (teste de isolamento)');
}

async function limpar(): Promise<void> {
  await cru.eventoDeAuditoria.deleteMany();
  await cru.desafioDeVerificacao.deleteMany();
  await cru.signatario.deleteMany();
  await cru.notificacao.deleteMany();
  await cru.tokenDeSenha.deleteMany();
  await cru.sessao.deleteMany();
  await cru.documento.deleteMany();
  await cru.usuario.deleteMany();
  await cru.organizacao.deleteMany();

  // Só os PDFs: a pasta `chaves/` (identidade Ed25519 da plataforma) é preservada.
  const raiz = resolve(diretorio);

  for (const entrada of await import('node:fs/promises').then((fs) =>
    fs.readdir(raiz).catch(() => [] as string[]),
  )) {
    if (entrada.startsWith('org-'))
      await rm(resolve(raiz, entrada), { recursive: true, force: true });
  }
}

async function simular(
  cenario: Cenario,
  organizacaoId: number,
  pessoas: Record<string, { id: number; nome: string; email: string }>,
  indice: number,
): Promise<void> {
  const criador = pessoas[cenario.criador];

  if (criador === undefined) throw new Error(`Criador desconhecido: ${cenario.criador}`);

  const envio = new Date(Date.now() - cenario.diasAtras * DIA - (indice % 7) * 37 * MINUTO);
  const criacao = new Date(envio.getTime() - 25 * MINUTO);
  const bytes = Buffer.from(await gerarContrato(cenario.titulo, cenario.partes));
  const hashOriginal = sha256(bytes);
  const passo = (cenario.horasPorAssinatura ?? 5 + (indice % 5) * 3) * HORA;

  const documento = await db.documento.create({
    data: {
      criadoPorId: criador.id,
      titulo: cenario.titulo,
      mensagem:
        cenario.mensagem ??
        'Olá! Segue o documento para sua assinatura. Qualquer dúvida, estou à disposição.',
      codigo: gerarCodigoDeDocumento(),
      nomeArquivo: `${cenario.titulo
        .toLowerCase()
        .normalize('NFD')
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 60)}.pdf`,
      tamanhoBytes: bytes.length,
      paginas: 2,
      hashOriginal,
      arquivoOriginal: '',
      nivelVerificacao: cenario.nivel,
      ordemSequencial: cenario.sequencial ?? false,
      criadoEm: criacao,
    } as never,
  });
  const chave = ArmazenamentoService.chaveDoDocumento(organizacaoId, documento.uuid, 'original');

  await armazenamento.gravar(chave, bytes);
  await db.documento.update({ where: { id: documento.id }, data: { arquivoOriginal: chave } });

  const ref = { id: documento.id, uuid: documento.uuid };
  const ator = { tipoAtor: 'usuario' as const, atorId: criador.id, atorNome: criador.nome };

  await auditoria.registrar({
    ...ator,
    acao: 'documento_criado',
    resumo: `${criador.nome} enviou o arquivo “${documento.nomeArquivo}” (2 páginas).`,
    documento: ref,
    dados: { hashOriginal },
    em: criacao,
  });

  const signatarios = [];

  for (const [ordem, pessoa] of cenario.signatarios.entries()) {
    const cpf = pessoa.cpf?.replace(/\D/g, '');

    signatarios.push(
      await db.signatario.create({
        data: {
          documentoId: documento.id,
          nome: pessoa.nome,
          email: pessoa.email,
          ordem: ordem + 1,
          cpfCifrado: cpf ? cifrar(cpf, chaveDeCampo) : null,
          cpfFinal: cpf ? cpf.slice(-2) : null,
          tokenHash: gerarToken().hash,
          tokenExpiraEm: new Date(Date.now() + 30 * DIA),
        } as never,
      }),
    );
  }

  await auditoria.registrar({
    ...ator,
    acao: 'signatarios_definidos',
    resumo: `${criador.nome} definiu ${contar(signatarios.length, 'signatário', 'signatários')}: ${signatarios.map((s) => s.nome).join(', ')}.`,
    documento: ref,
    em: new Date(criacao.getTime() + 5 * MINUTO),
  });

  if (cenario.desfecho === 'rascunho') return;

  await db.documento.update({
    where: { id: documento.id },
    data: { status: 'em_andamento', enviadoEm: envio },
  });
  await auditoria.registrar({
    ...ator,
    acao: 'documento_enviado',
    resumo: resumoDoEnvio(criador.nome, signatarios.length, cenario.sequencial ?? false),
    documento: ref,
    em: envio,
  });

  const convidar = (nome: string, em: Date) =>
    auditoria.registrar({
      tipoAtor: 'sistema',
      atorNome: 'LetsSign',
      acao: 'convite_enviado',
      resumo: `Convite de assinatura enviado para ${nome}.`,
      documento: ref,
      em,
    });

  if (cenario.sequencial) {
    await convidar(signatarios[0]?.nome ?? '', new Date(envio.getTime() + 1000));
  } else {
    for (const s of signatarios) await convidar(s.nome, new Date(envio.getTime() + 1000));
  }

  const quantos =
    cenario.desfecho === 'concluido'
      ? signatarios.length
      : Math.min(cenario.assinados ?? 0, signatarios.length);
  const assinador = chaveDaPlataforma.assinador;
  let ultimo = envio;

  for (let i = 0; i < quantos; i += 1) {
    const s = signatarios[i];

    if (s === undefined) continue;

    const vista = new Date(envio.getTime() + passo * i + 20 * MINUTO);
    const ip = IPS[(indice + i) % IPS.length];
    const origem = {
      ip,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36',
    };

    await db.signatario.update({
      where: { id: s.id },
      data: { status: 'visualizado', visualizadoEm: vista },
    });
    await auditoria.registrar({
      tipoAtor: 'signatario',
      atorId: s.id,
      atorNome: s.nome,
      acao: 'documento_visualizado',
      resumo: `${s.nome} abriu o documento pelo link de assinatura.`,
      documento: ref,
      origem,
      em: vista,
    });

    const desafios = [];
    let momento = vista.getTime();

    for (const tipo of VERIFICACOES_DO_NIVEL[cenario.nivel]) {
      momento += 70_000 + ((indice * 13 + i * 7) % 60) * 1000;

      const pontuacao =
        tipo === 'codigo_email' ? 1 : Math.round((0.82 + ((indice + i) % 15) / 100) * 1000) / 1000;
      const concluidoEm = new Date(momento);
      const desafio = await db.desafioDeVerificacao.create({
        data: {
          signatarioId: s.id,
          tipo,
          desafio: {},
          expiraEm: new Date(momento + 5 * MINUTO),
          concluidoEm,
          aprovado: true,
          pontuacao,
          tentativas: 1,
          criadoEm: new Date(momento - 60_000),
        } as never,
      });

      desafios.push(desafio);
      await auditoria.registrar({
        tipoAtor: 'signatario',
        atorId: s.id,
        atorNome: s.nome,
        acao: 'verificacao_aprovada',
        resumo: `Aprovada: ${ROTULO_DA_VERIFICACAO[tipo]} de ${s.nome}${tipo === 'codigo_email' ? '' : ` (pontuação ${Math.round(pontuacao * 100)}%)`}.`,
        documento: ref,
        dados: { tipo, pontuacao },
        origem,
        em: concluidoEm,
      });
    }

    const assinadoEm = new Date(momento + 90_000);
    const tipoAssinatura = (indice + i) % 3 === 0 ? 'digitada' : 'desenhada';
    const { carga, assinatura } = assinador.assinar({
      versao: 1,
      tipo: 'assinatura',
      documento: { uuid: documento.uuid, codigo: documento.codigo, hashOriginal },
      signatario: {
        uuid: s.uuid,
        nome: s.nome,
        email: s.email,
        cpf: s.cpfFinal ? sha256(`seed:${s.uuid}`) : null,
      },
      assinadoEm,
      origem: { ip },
      verificacoes: desafios.map((d) => ({
        tipo: d.tipo,
        desafio: d.uuid,
        concluidoEm: d.concluidoEm,
        pontuacao: d.pontuacao,
      })),
      manifestacao: 'Li o documento e concordo com o seu conteúdo.',
      chave: assinador.idDaChave,
    });

    await db.signatario.update({
      where: { id: s.id },
      data: {
        status: 'assinado',
        assinadoEm,
        ip,
        userAgent: origem.userAgent,
        tipoAssinatura,
        imagemAssinatura: rubricaDataUrl(s.nome),
        cargaAssinada: carga,
        assinaturaDigital: assinatura,
      },
    });
    await auditoria.registrar({
      tipoAtor: 'signatario',
      atorId: s.id,
      atorNome: s.nome,
      acao: 'assinatura_registrada',
      resumo: `${s.nome} assinou o documento (${tipoAssinatura === 'desenhada' ? 'rubrica desenhada' : 'nome digitado'}).`,
      documento: ref,
      dados: { assinatura: sha256(assinatura).slice(0, 16) },
      origem,
      em: assinadoEm,
    });

    const proximo = signatarios[i + 1];

    if (cenario.sequencial && proximo)
      await convidar(proximo.nome, new Date(assinadoEm.getTime() + 1000));

    ultimo = assinadoEm;
  }

  if (cenario.desfecho === 'concluido')
    await concluir(documento.uuid, organizacaoId, new Date(ultimo.getTime() + 2000), criador.id);

  if (cenario.desfecho === 'cancelado') {
    const quando = new Date(envio.getTime() + 2 * DIA);
    const motivo = 'As condições comerciais foram renegociadas; uma nova versão será enviada.';

    await db.documento.update({
      where: { id: documento.id },
      data: { status: 'cancelado', canceladoEm: quando, motivoCancelamento: motivo },
    });
    await auditoria.registrar({
      ...ator,
      acao: 'documento_cancelado',
      resumo: `${criador.nome} cancelou o documento. Motivo: “${motivo}”.`,
      documento: ref,
      em: quando,
    });
  }

  if (cenario.desfecho === 'recusado') {
    const quem = signatarios[quantos];
    const quando = new Date(ultimo.getTime() + 6 * HORA);
    const motivo = 'A cláusula de reajuste não corresponde ao que foi combinado na reunião.';

    if (quem) {
      await db.signatario.update({
        where: { id: quem.id },
        data: {
          status: 'recusado',
          recusadoEm: quando,
          motivoRecusa: motivo,
          visualizadoEm: quando,
        },
      });
      await db.documento.update({ where: { id: documento.id }, data: { status: 'recusado' } });
      await auditoria.registrar({
        tipoAtor: 'signatario',
        atorId: quem.id,
        atorNome: quem.nome,
        acao: 'assinatura_recusada',
        resumo: `${quem.nome} recusou assinar. Motivo: “${motivo}”. O documento foi encerrado.`,
        documento: ref,
        em: quando,
      });
    }
  }

  if (cenario.desfecho === 'expirado') {
    const prazo = new Date(envio.getTime() + 7 * DIA);

    await db.documento.update({ where: { id: documento.id }, data: { status: 'expirado', prazo } });
    await auditoria.registrar({
      tipoAtor: 'sistema',
      atorNome: 'LetsSign',
      acao: 'documento_expirado',
      resumo: 'O prazo terminou antes de todas as assinaturas. O documento foi encerrado.',
      documento: ref,
      em: new Date(prazo.getTime() + 5 * MINUTO),
    });
  }

  if (cenario.desfecho === 'em_andamento') {
    await db.documento.update({
      where: { id: documento.id },
      data: { prazo: new Date(Date.now() + (5 + (indice % 10)) * DIA) },
    });
  }
}

/** A mesma conclusão do `FinalizadorDeDocumentoService`, com o instante informado. */
async function concluir(
  uuid: string,
  organizacaoId: number,
  agora: Date,
  criadorId: number,
): Promise<void> {
  const documento = await db.documento.findUniqueOrThrow({
    where: { uuid },
    include: {
      signatarios: {
        orderBy: { ordem: 'asc' },
        include: { desafios: { where: { aprovado: true } } },
      },
      criadoPor: true,
      organizacao: true,
    },
  });
  const assinador = chaveDaPlataforma.assinador;
  const urlDeValidacao = `${appUrl}/validar/${documento.codigo}`;
  const original = await armazenamento.ler(documento.arquivoOriginal);
  const evidencias = jsonCanonico({
    versao: 1,
    documento: {
      uuid: documento.uuid,
      codigo: documento.codigo,
      titulo: documento.titulo,
      hashOriginal: documento.hashOriginal,
    },
    chavePublica: { algoritmo: 'Ed25519', id: assinador.idDaChave, pem: assinador.chavePublicaPem },
    assinaturas: documento.signatarios.map((s) => ({
      signatario: s.uuid,
      carga: s.cargaAssinada,
      assinatura: s.assinaturaDigital,
    })),
  });
  const bytes = await montarPdfAssinado(original, {
    titulo: documento.titulo,
    codigo: documento.codigo,
    urlDeValidacao,
    hashOriginal: documento.hashOriginal,
    paginas: documento.paginas,
    organizacao: documento.organizacao.nome,
    remetente: documento.criadoPor.nome,
    enviadoEm: documento.enviadoEm ?? documento.criadoEm,
    concluidoEm: agora,
    idDaChave: assinador.idDaChave,
    evidencias,
    signatarios: documento.signatarios.map((s) => ({
      nome: s.nome,
      emailMascarado: mascararEmail(s.email),
      cpfMascarado: mascararCpf(s.cpfFinal),
      assinadoEm: s.assinadoEm ?? agora,
      ip: s.ip,
      verificacoes: s.desafios.map((d) => ROTULO_DA_VERIFICACAO[d.tipo]),
      imagemPng: s.imagemAssinatura
        ? Buffer.from(s.imagemAssinatura.split(',')[1] ?? '', 'base64')
        : null,
      idDaAssinatura: sha256(s.assinaturaDigital ?? '').slice(0, 16),
    })),
  });
  const hashAssinado = sha256(bytes);
  const chave = `org-${organizacaoId}/documentos/${documento.uuid}/assinado-${agora.getTime()}.pdf`;

  await armazenamento.gravar(chave, bytes);

  const selo = assinador.assinar({
    versao: 1,
    tipo: 'selo_de_conclusao',
    documento: documento.uuid,
    codigo: documento.codigo,
    hashOriginal: documento.hashOriginal,
    hashAssinado,
    concluidoEm: agora,
    assinaturas: documento.signatarios.map((s) => sha256(s.assinaturaDigital ?? '')),
    chave: assinador.idDaChave,
  });

  await db.documento.update({
    where: { id: documento.id },
    data: {
      status: 'concluido',
      concluidoEm: agora,
      arquivoAssinado: chave,
      hashAssinado,
      cargaDoSelo: selo.carga,
      selo: selo.assinatura,
    },
  });
  await auditoria.registrar({
    tipoAtor: 'sistema',
    atorNome: 'LetsSign',
    acao: 'documento_concluido',
    resumo: resumoDaConclusao(documento.signatarios.length),
    documento: { id: documento.id, uuid: documento.uuid },
    dados: { hashAssinado, idDaChave: assinador.idDaChave },
    em: agora,
  });

  if (Date.now() - agora.getTime() < 20 * DIA) {
    await db.notificacao.create({
      data: {
        usuarioId: criadorId,
        titulo: 'Documento concluído',
        mensagem: `“${documento.titulo}” foi assinado por todos.`,
        link: `/app/documentos/${documento.uuid}`,
        criadaEm: agora,
      } as never,
    });
  }
}

// ---------------------------------------------------------------------------

const EXTERNOS = {
  mariana: {
    nome: 'Mariana Albuquerque',
    email: 'mariana.albuquerque@nimbuscloud.com.br',
    cpf: '529.982.247-25',
  },
  rafael: { nome: 'Rafael Nogueira', email: 'rafael@atlasdigital.com.br', cpf: '153.509.460-56' },
  juliana: { nome: 'Juliana Castro', email: 'juliana.castro@vertexlog.com.br' },
  pedro: { nome: 'Pedro Henrique Lima', email: 'pedro.lima@example.com', cpf: '086.766.130-94' },
  lucas: { nome: 'Lucas Fernandes', email: 'lucas.fernandes@solaris.eng.br' },
  beatriz: {
    nome: 'Beatriz Sampaio',
    email: 'beatriz@sampaio-imoveis.com.br',
    cpf: '390.533.447-05',
  },
  thiago: { nome: 'Thiago Moreira', email: 'thiago.moreira@example.com' },
  camila: { nome: 'Camila Rocha', email: 'camila.rocha@orionpay.com.br' },
  gustavo: { nome: 'Gustavo Teixeira', email: 'gustavo@teixeira.adv.br' },
  isabela: { nome: 'Isabela Martins', email: 'isabela.martins@example.com', cpf: '714.602.380-01' },
} satisfies Record<string, Pessoa>;

const ANA: Pessoa = { nome: 'Ana Ribeiro', email: 'ana@aurora.dev' };
const BRUNO: Pessoa = { nome: 'Bruno Carvalho', email: 'bruno@aurora.dev' };

const CENARIOS: readonly Cenario[] = [
  {
    titulo: 'Contrato de Prestação de Serviços — Nimbus Cloud',
    partes: ['Aurora Tecnologia Ltda.', 'Nimbus Cloud S.A.'],
    criador: 'ana',
    nivel: 'completo',
    sequencial: true,
    signatarios: [EXTERNOS.mariana, BRUNO],
    diasAtras: 330,
    desfecho: 'concluido',
  },
  {
    titulo: 'Acordo de Confidencialidade (NDA) — Projeto Atlas',
    partes: ['Aurora Tecnologia Ltda.', 'Atlas Digital Ltda.'],
    criador: 'bruno',
    nivel: 'biometrico',
    signatarios: [EXTERNOS.rafael],
    diasAtras: 300,
    desfecho: 'concluido',
  },
  {
    titulo: 'Contrato de Locação Comercial — Sala 1204',
    partes: ['Sampaio Imóveis', 'Aurora Tecnologia Ltda.'],
    criador: 'ana',
    nivel: 'biometrico',
    signatarios: [EXTERNOS.beatriz, ANA],
    diasAtras: 285,
    desfecho: 'concluido',
  },
  {
    titulo: 'Proposta Comercial 2025-118 — VertexLog',
    partes: ['Aurora Tecnologia Ltda.', 'VertexLog Transportes'],
    criador: 'carla',
    nivel: 'simples',
    signatarios: [EXTERNOS.juliana],
    diasAtras: 262,
    desfecho: 'concluido',
  },
  {
    titulo: 'Contrato de Trabalho — Pedro Henrique Lima',
    partes: ['Aurora Tecnologia Ltda.', 'Pedro Henrique Lima'],
    criador: 'bruno',
    nivel: 'completo',
    signatarios: [EXTERNOS.pedro, ANA],
    diasAtras: 240,
    desfecho: 'concluido',
  },
  {
    titulo: 'Termo de Uso de Imagem — Campanha Institucional',
    partes: ['Aurora Tecnologia Ltda.', 'Isabela Martins'],
    criador: 'carla',
    nivel: 'simples',
    signatarios: [EXTERNOS.isabela],
    diasAtras: 221,
    desfecho: 'concluido',
  },
  {
    titulo: 'Aditivo Contratual nº 2 — Nimbus Cloud',
    partes: ['Aurora Tecnologia Ltda.', 'Nimbus Cloud S.A.'],
    criador: 'ana',
    nivel: 'biometrico',
    signatarios: [EXTERNOS.mariana],
    diasAtras: 205,
    desfecho: 'cancelado',
  },
  {
    titulo: 'Contrato de Desenvolvimento de Software — Solaris',
    partes: ['Aurora Tecnologia Ltda.', 'Solaris Engenharia'],
    criador: 'bruno',
    nivel: 'completo',
    sequencial: true,
    signatarios: [EXTERNOS.lucas, EXTERNOS.thiago, ANA],
    diasAtras: 190,
    desfecho: 'concluido',
  },
  {
    titulo: 'Acordo de Nível de Serviço (SLA) — OrionPay',
    partes: ['Aurora Tecnologia Ltda.', 'OrionPay Pagamentos'],
    criador: 'ana',
    nivel: 'biometrico',
    signatarios: [EXTERNOS.camila],
    diasAtras: 170,
    desfecho: 'concluido',
  },
  {
    titulo: 'Contrato de Parceria Comercial — Atlas Digital',
    partes: ['Aurora Tecnologia Ltda.', 'Atlas Digital Ltda.'],
    criador: 'carla',
    nivel: 'simples',
    signatarios: [EXTERNOS.rafael, BRUNO],
    diasAtras: 150,
    desfecho: 'recusado',
    assinados: 0,
  },
  {
    titulo: 'Política de Trabalho Remoto — Ciência e Aceite',
    partes: ['Aurora Tecnologia Ltda.', 'Colaborador'],
    criador: 'ana',
    nivel: 'simples',
    signatarios: [BRUNO, { nome: 'Carla Menezes', email: 'carla@aurora.dev' }],
    diasAtras: 134,
    desfecho: 'concluido',
  },
  {
    titulo: 'Contrato de Consultoria Jurídica — Teixeira Advogados',
    partes: ['Aurora Tecnologia Ltda.', 'Teixeira Advogados'],
    criador: 'bruno',
    nivel: 'biometrico',
    signatarios: [EXTERNOS.gustavo],
    diasAtras: 118,
    desfecho: 'concluido',
  },
  {
    titulo: 'Proposta Comercial 2026-007 — OrionPay',
    partes: ['Aurora Tecnologia Ltda.', 'OrionPay Pagamentos'],
    criador: 'carla',
    nivel: 'simples',
    signatarios: [EXTERNOS.camila],
    diasAtras: 96,
    desfecho: 'expirado',
  },
  {
    titulo: 'Contrato de Suporte e Manutenção — VertexLog',
    partes: ['Aurora Tecnologia Ltda.', 'VertexLog Transportes'],
    criador: 'ana',
    nivel: 'completo',
    signatarios: [EXTERNOS.juliana, ANA],
    diasAtras: 80,
    desfecho: 'concluido',
  },
  {
    titulo: 'Acordo de Confidencialidade (NDA) — Solaris',
    partes: ['Aurora Tecnologia Ltda.', 'Solaris Engenharia'],
    criador: 'bruno',
    nivel: 'simples',
    signatarios: [EXTERNOS.lucas],
    diasAtras: 64,
    desfecho: 'concluido',
  },
  {
    titulo: 'Contrato de Trabalho — Thiago Moreira',
    partes: ['Aurora Tecnologia Ltda.', 'Thiago Moreira'],
    criador: 'bruno',
    nivel: 'biometrico',
    signatarios: [EXTERNOS.thiago, ANA],
    diasAtras: 47,
    desfecho: 'concluido',
  },
  {
    titulo: 'Termo de Adesão — Plano de Saúde Corporativo',
    partes: ['Aurora Tecnologia Ltda.', 'Colaborador'],
    criador: 'ana',
    nivel: 'simples',
    signatarios: [EXTERNOS.pedro, EXTERNOS.thiago],
    diasAtras: 33,
    desfecho: 'concluido',
  },
  {
    titulo: 'Aditivo Contratual nº 3 — Nimbus Cloud',
    partes: ['Aurora Tecnologia Ltda.', 'Nimbus Cloud S.A.'],
    criador: 'ana',
    nivel: 'completo',
    signatarios: [EXTERNOS.mariana],
    diasAtras: 21,
    desfecho: 'concluido',
  },
  {
    titulo: 'Contrato de Licenciamento de Software — Atlas',
    partes: ['Aurora Tecnologia Ltda.', 'Atlas Digital Ltda.'],
    criador: 'carla',
    nivel: 'biometrico',
    signatarios: [EXTERNOS.rafael],
    diasAtras: 14,
    desfecho: 'concluido',
  },
  {
    titulo: 'Contrato de Prestação de Serviços — OrionPay',
    partes: ['Aurora Tecnologia Ltda.', 'OrionPay Pagamentos'],
    criador: 'bruno',
    nivel: 'biometrico',
    signatarios: [EXTERNOS.camila, ANA],
    diasAtras: 6,
    desfecho: 'em_andamento',
    assinados: 1,
  },
  {
    titulo: 'Acordo de Parceria Estratégica — Teixeira Advogados',
    partes: ['Aurora Tecnologia Ltda.', 'Teixeira Advogados'],
    criador: 'ana',
    nivel: 'completo',
    sequencial: true,
    signatarios: [EXTERNOS.gustavo, BRUNO],
    diasAtras: 4,
    desfecho: 'em_andamento',
    assinados: 1,
  },
  {
    titulo: 'Proposta Comercial 2026-052 — Solaris',
    partes: ['Aurora Tecnologia Ltda.', 'Solaris Engenharia'],
    criador: 'carla',
    nivel: 'simples',
    signatarios: [EXTERNOS.lucas, EXTERNOS.isabela],
    diasAtras: 3,
    desfecho: 'em_andamento',
    assinados: 1,
  },
  {
    titulo: 'Contrato de Trabalho — Isabela Martins',
    partes: ['Aurora Tecnologia Ltda.', 'Isabela Martins'],
    criador: 'bruno',
    nivel: 'biometrico',
    signatarios: [EXTERNOS.isabela],
    diasAtras: 2,
    desfecho: 'em_andamento',
    assinados: 0,
  },
  {
    titulo: 'Termo de Confidencialidade — Estagiários 2026',
    partes: ['Aurora Tecnologia Ltda.', 'Estagiário'],
    criador: 'ana',
    nivel: 'simples',
    signatarios: [EXTERNOS.thiago],
    diasAtras: 1,
    desfecho: 'concluido',
    horasPorAssinatura: 2,
  },
  {
    titulo: 'Contrato de Locação — Renovação 2027',
    partes: ['Sampaio Imóveis', 'Aurora Tecnologia Ltda.'],
    criador: 'ana',
    nivel: 'biometrico',
    signatarios: [EXTERNOS.beatriz, ANA],
    diasAtras: 0,
    desfecho: 'rascunho',
  },
  {
    titulo: 'Proposta Comercial 2026-061 — VertexLog',
    partes: ['Aurora Tecnologia Ltda.', 'VertexLog Transportes'],
    criador: 'carla',
    nivel: 'simples',
    signatarios: [EXTERNOS.juliana],
    diasAtras: 0,
    desfecho: 'rascunho',
  },
];

main()
  .catch((erro: unknown) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => void cru.$disconnect());
