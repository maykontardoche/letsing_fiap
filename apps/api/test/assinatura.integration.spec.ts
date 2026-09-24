import type { INestApplication } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import type { EmailService } from '../src/common/email/email.service';
import type { PrismaService } from '../src/config/database/prisma.service';
import { sha256 } from '../src/common/cripto/hash';
import {
  codigoDoEmail,
  documentoEnviado,
  emailUnico,
  novaOrganizacao,
  RUBRICA,
  subirAplicacao,
  tokenDoConvite,
  type Agente,
} from './aplicacao';

describe('Fluxo de assinatura, de ponta a ponta', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: EmailService;
  let dono: Agente;

  const publico = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma, email } = await subirAplicacao());
    dono = (await novaOrganizacao(app)).agente;
  });

  afterAll(async () => {
    await app.close();
  });

  /** Conclui a verificação por código para o signatário do token. */
  async function confirmarEmail(token: string, para: string) {
    const { body } = await publico()
      .post(`/api/assinatura/${token}/verificacoes/codigo_email/iniciar`)
      .expect(201);

    await publico()
      .post(`/api/assinatura/${token}/verificacoes/codigo_email/concluir`)
      .send({ desafio: body.desafio, codigo: codigoDoEmail(email, para) })
      .expect(200);
  }

  it('nível completo: e-mail → rosto → voz → gestos → assinatura → PDF selado → validação pública', async () => {
    const signatario = emailUnico('completo');
    const { uuid, codigo, token } = await documentoEnviado(dono, email, {
      signatarios: [{ nome: 'Mariana Teste', email: signatario }],
      nivel: 'completo',
    });

    const sessao = await publico().get(`/api/assinatura/${token}`).expect(200);

    expect(sessao.body.ehSuaVez).toBe(true);
    expect(sessao.body.verificacoes.map((v: { tipo: string }) => v.tipo)).toEqual([
      'codigo_email',
      'facial',
      'voz',
      'gestos',
    ]);

    // Pular etapa é recusado: a biometria exige o e-mail confirmado antes.
    await publico().post(`/api/assinatura/${token}/verificacoes/facial/iniciar`).expect(422);
    // Assinar sem verificação também.
    await publico()
      .post(`/api/assinatura/${token}/assinar`)
      .send({ tipo: 'desenhada', imagem: RUBRICA, aceite: true })
      .expect(422);

    // Código errado conta tentativa e é recusado; o certo aprova.
    const desafioDoCodigo = await publico()
      .post(`/api/assinatura/${token}/verificacoes/codigo_email/iniciar`)
      .expect(201);

    expect(desafioDoCodigo.body.enviadoPara).toMatch(/•••/);
    await publico()
      .post(`/api/assinatura/${token}/verificacoes/codigo_email/concluir`)
      .send({ desafio: desafioDoCodigo.body.desafio, codigo: '000000' })
      .expect(422);
    await publico()
      .post(`/api/assinatura/${token}/verificacoes/codigo_email/concluir`)
      .send({ desafio: desafioDoCodigo.body.desafio, codigo: codigoDoEmail(email, signatario) })
      .expect(200);

    // Rosto: as ações sorteadas pelo servidor, na ordem.
    const facial = await publico()
      .post(`/api/assinatura/${token}/verificacoes/facial/iniciar`)
      .expect(201);

    await publico()
      .post(`/api/assinatura/${token}/verificacoes/facial/concluir`)
      .send({
        desafio: facial.body.desafio,
        medicao: {
          acoes: facial.body.acoes,
          quadrosAnalisados: 40,
          quadrosComRosto: 38,
          confiancaMedia: 0.91,
          rostosMultiplos: false,
        },
      })
      .expect(200);

    // Voz: uma transcrição que não bate é recusada; a certa aprova.
    const voz = await publico()
      .post(`/api/assinatura/${token}/verificacoes/voz/iniciar`)
      .expect(201);

    await publico()
      .post(`/api/assinatura/${token}/verificacoes/voz/concluir`)
      .send({ desafio: voz.body.desafio, transcricao: 'banana' })
      .expect(422);
    await publico()
      .post(`/api/assinatura/${token}/verificacoes/voz/concluir`)
      .send({ desafio: voz.body.desafio, transcricao: (voz.body.palavras as string[]).join(' ') })
      .expect(200);

    // Gestos.
    const gestos = await publico()
      .post(`/api/assinatura/${token}/verificacoes/gestos/iniciar`)
      .expect(201);

    await publico()
      .post(`/api/assinatura/${token}/verificacoes/gestos/concluir`)
      .send({
        desafio: gestos.body.desafio,
        gestos: gestos.body.sequencia,
        confiancas: [0.9, 0.88, 0.93],
      })
      .expect(200);

    // Assinar exige a concordância explícita.
    await publico()
      .post(`/api/assinatura/${token}/assinar`)
      .send({ tipo: 'desenhada', imagem: RUBRICA, aceite: false })
      .expect(400);

    const assinatura = await publico()
      .post(`/api/assinatura/${token}/assinar`)
      .send({ tipo: 'desenhada', imagem: RUBRICA, aceite: true, cpf: '529.982.247-25' })
      .expect(200);

    expect(assinatura.body.concluido).toBe(true);

    // Assinar de novo não gera segunda assinatura.
    await publico()
      .post(`/api/assinatura/${token}/assinar`)
      .send({ tipo: 'desenhada', imagem: RUBRICA, aceite: true })
      .expect(422);

    // O PDF final existe, tem o manifesto e o hash registrado confere.
    const pdf = await dono
      .get(`/api/documentos/${uuid}/arquivo?versao=assinado`)
      .buffer(true)
      .parse((res, callback) => {
        const partes: Buffer[] = [];

        res.on('data', (parte: Buffer) => partes.push(parte));
        res.on('end', () => callback(null, Buffer.concat(partes)));
      })
      .expect(200);
    const bytes = pdf.body as Buffer;
    const documento = await dono.get(`/api/documentos/${uuid}`).expect(200);

    expect(documento.body.status).toBe('concluido');
    expect(sha256(bytes)).toBe(documento.body.hashAssinado);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);

    // A validação pública confere tudo de novo, agora.
    const validacao = await publico().get(`/api/publico/validar/${codigo}`).expect(200);

    expect(validacao.body.selo.valido).toBe(true);
    expect(validacao.body.trilha.integra).toBe(true);
    expect(validacao.body.signatarios[0].assinaturaDigital.valida).toBe(true);
    expect(validacao.body.signatarios[0].cpfMascarado).toBe('•••.•••.•••-25');
    expect(validacao.body.signatarios[0].verificacoes).toHaveLength(4);

    // Pelo hash do arquivo — que é o que o navegador manda ao arrastar o PDF.
    const porHash = await publico()
      .get(`/api/publico/validar/hash/${sha256(bytes)}`)
      .expect(200);

    expect(porHash.body).toEqual({ codigo, versao: 'assinado' });

    // E o PDF assinado foi para o e-mail de quem assinou, anexado.
    expect(
      email.caixaDeTeste.some(
        (m) => m.para === signatario && m.assunto.startsWith('Concluído') && m.anexos?.length === 1,
      ),
    ).toBe(true);
  });

  it('adulterar a trilha direto no banco é detectado pela validação pública', async () => {
    const signatario = emailUnico('adulteracao');
    const { uuid, codigo, token } = await documentoEnviado(dono, email, {
      signatarios: [{ nome: 'Pedro Teste', email: signatario }],
    });

    await confirmarEmail(token, signatario);
    await publico()
      .post(`/api/assinatura/${token}/assinar`)
      .send({ tipo: 'digitada', imagem: RUBRICA, aceite: true })
      .expect(200);

    const documento = await prisma.db.documento.findUniqueOrThrow({ where: { uuid } });

    // Alguém com acesso ao banco "corrige" o que foi registrado.
    await prisma.db
      .$executeRaw`UPDATE eventos_de_auditoria SET resumo = 'Pedro Teste NÃO assinou' WHERE documento_id = ${documento.id} AND acao = 'assinatura_registrada'`;

    const validacao = await publico().get(`/api/publico/validar/${codigo}`).expect(200);

    expect(validacao.body.trilha.integra).toBe(false);
    expect(validacao.body.trilha.motivo).toContain('alterado');
  });

  it('um arquivo alterado (um byte) não corresponde a nenhum documento', async () => {
    await publico()
      .get(`/api/publico/validar/hash/${sha256('pdf adulterado')}`)
      .expect(404);
    await publico().get('/api/publico/validar/hash/nao-e-hash').expect(400);
    await publico().get('/api/publico/validar/LS-ZZZZ-ZZZZ').expect(404);
  });

  it('em ordem: o segundo só recebe convite depois que o primeiro assina', async () => {
    const primeiro = emailUnico('primeiro');
    const segundo = emailUnico('segundo');
    const { uuid, token } = await documentoEnviado(dono, email, {
      signatarios: [
        { nome: 'Primeiro', email: primeiro },
        { nome: 'Segundo', email: segundo },
      ],
      sequencial: true,
    });

    expect(() => tokenDoConvite(email, segundo)).toThrow();

    await confirmarEmail(token, primeiro);
    await publico()
      .post(`/api/assinatura/${token}/assinar`)
      .send({ tipo: 'digitada', imagem: RUBRICA, aceite: true })
      .expect(200);

    const tokenDoSegundo = tokenDoConvite(email, segundo);
    const sessao = await publico().get(`/api/assinatura/${tokenDoSegundo}`).expect(200);

    expect(sessao.body.ehSuaVez).toBe(true);
    expect((await dono.get(`/api/documentos/${uuid}`)).body.progresso).toEqual({
      assinados: 1,
      total: 2,
    });
  });

  it('a recusa encerra o documento para todos e derruba os outros links', async () => {
    const a = emailUnico('recusa-a');
    const b = emailUnico('recusa-b');
    const { uuid, token } = await documentoEnviado(dono, email, {
      signatarios: [
        { nome: 'Signatária A', email: a },
        { nome: 'Signatário B', email: b },
      ],
    });
    const tokenDeB = tokenDoConvite(email, b);

    await publico()
      .post(`/api/assinatura/${token}/recusar`)
      .send({ motivo: 'Discordo da cláusula 4.' })
      .expect(204);

    expect((await dono.get(`/api/documentos/${uuid}`)).body.status).toBe('recusado');
    await publico().get(`/api/assinatura/${tokenDeB}`).expect(404);
  });

  it('reenviar o convite rotaciona o link: o antigo deixa de valer', async () => {
    const para = emailUnico('reenvio');
    const { uuid, token } = await documentoEnviado(dono, email, {
      signatarios: [{ nome: 'Reenvio', email: para }],
    });
    const detalhe = await dono.get(`/api/documentos/${uuid}`).expect(200);
    const signatario = detalhe.body.signatarios[0].uuid as string;

    const { body } = await dono
      .post(`/api/documentos/${uuid}/signatarios/${signatario}/reenviar`)
      .expect(200);

    await publico().get(`/api/assinatura/${token}`).expect(404);
    await publico()
      .get(new URL(body.link as string).pathname.replace('/assinar/', '/api/assinatura/'))
      .expect(200);
  });

  it('cancelar invalida os links na hora', async () => {
    const para = emailUnico('cancelado');
    const { uuid, token } = await documentoEnviado(dono, email, {
      signatarios: [{ nome: 'Cancelado', email: para }],
    });

    await dono.post(`/api/documentos/${uuid}/cancelar`).send({ motivo: 'x' }).expect(400);
    await dono
      .post(`/api/documentos/${uuid}/cancelar`)
      .send({ motivo: 'Proposta substituída.' })
      .expect(200);
    await publico().get(`/api/assinatura/${token}`).expect(404);
    // E um documento enviado não pode mais ser editado.
    await dono.patch(`/api/documentos/${uuid}`).send({ titulo: 'novo título' }).expect(422);
  });

  it('upload: recusa o que não é PDF, mesmo com a extensão certa', async () => {
    await dono
      .post('/api/documentos')
      .field('titulo', 'Falso PDF')
      .attach('arquivo', Buffer.from('<html>não sou pdf</html>'), {
        filename: 'contrato.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
  });
});
