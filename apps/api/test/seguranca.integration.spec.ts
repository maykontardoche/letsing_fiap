import type { INestApplication } from '@nestjs/common';
import { authenticator } from 'otplib';
import request from 'supertest';
import type { EmailService } from '../src/common/email/email.service';
import {
  emailUnico,
  navegador,
  novaOrganizacao,
  pdfDeTeste,
  SENHA_FORTE,
  subirAplicacao,
} from './aplicacao';

describe('Borda de segurança e autenticação', () => {
  let app: INestApplication;
  let email: EmailService;

  const publico = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, email } = await subirAplicacao());
  });

  afterAll(async () => {
    await app.close();
  });

  it('toda rota é fechada por padrão: sem sessão, 401 no envelope padrão', async () => {
    for (const rota of [
      '/api/documentos',
      '/api/painel',
      '/api/equipe',
      '/api/auditoria',
      '/api/me',
    ]) {
      const resposta = await publico().get(rota).expect(401);

      expect(resposta.body).toMatchObject({ statusCode: 401, error: 'Unauthorized', path: rota });
      expect(resposta.body.timestamp).toEqual(expect.any(String));
    }
  });

  it('campo não declarado no DTO é recusado — não dá para injetar papel ou organização', async () => {
    const resposta = await publico()
      .post('/api/auth/cadastro')
      .send({
        nomeOrganizacao: 'X Ltda',
        nome: 'X',
        email: emailUnico(),
        senha: SENHA_FORTE,
        papel: 'proprietario',
        organizacaoId: 1,
      })
      .expect(400);

    expect(resposta.body.message).toEqual(
      expect.arrayContaining([
        'O campo "papel" não é permitido.',
        'O campo "organizacaoId" não é permitido.',
      ]),
    );
  });

  it('senha fraca é recusada pelo servidor, com a lista do que falta', async () => {
    const resposta = await publico()
      .post('/api/auth/cadastro')
      .send({ nomeOrganizacao: 'X Ltda', nome: 'Xis', email: emailUnico(), senha: 'senhafraca1' })
      .expect(400);

    expect(resposta.body.message).toContain('letra maiúscula');
  });

  it('CSRF: mutação vinda de outra origem é recusada', async () => {
    await publico()
      .post('/api/auth/entrar')
      .set('Origin', 'https://site-malicioso.example')
      .send({ email: 'a@b.com', senha: 'x' })
      .expect(403);
  });

  it('login: mensagem ambígua, e bloqueio depois de 5 erros — mesmo com a senha certa', async () => {
    const { email: dono } = await novaOrganizacao(app);
    const agente = navegador(app);

    const inexistente = await agente
      .post('/api/auth/entrar')
      .send({ email: emailUnico('ninguem'), senha: 'Qualquer@123' })
      .expect(401);
    const errada = await agente
      .post('/api/auth/entrar')
      .send({ email: dono, senha: 'Errada@12345' })
      .expect(401);

    // A mesma resposta para "não existe" e "senha errada": nada vaza sobre quem tem conta.
    expect(inexistente.body.message).toBe(errada.body.message);

    for (let i = 0; i < 4; i += 1)
      await agente
        .post('/api/auth/entrar')
        .send({ email: dono, senha: 'Errada@12345' })
        .expect(401);

    await agente.post('/api/auth/entrar').send({ email: dono, senha: SENHA_FORTE }).expect(429);
  });

  it('sair derruba a sessão no servidor', async () => {
    const { agente } = await novaOrganizacao(app);

    await agente.get('/api/me').expect(200);
    await agente.post('/api/auth/sair').expect(204);
    await agente.get('/api/me').expect(401);
  });

  it('MFA: ativar, exigir no próximo login, aceitar TOTP e código de recuperação de uso único', async () => {
    const { agente, email: conta } = await novaOrganizacao(app);

    const { body: configuracao } = await agente.post('/api/me/mfa/iniciar').expect(201);

    await agente.post('/api/me/mfa/confirmar').send({ codigo: '000000' }).expect(400);

    const { body: ativacao } = await agente
      .post('/api/me/mfa/confirmar')
      .send({ codigo: authenticator.generate(configuracao.segredo as string) })
      .expect(201);
    const recuperacao = (ativacao.codigosDeRecuperacao as string[])[0];

    expect(ativacao.codigosDeRecuperacao).toHaveLength(8);

    // Login novo: a sessão nasce "pendente" — 403 com código próprio, não 401.
    const novo = navegador(app);
    const entrada = await novo
      .post('/api/auth/entrar')
      .send({ email: conta, senha: SENHA_FORTE })
      .expect(200);

    expect(entrada.body.precisaMfa).toBe(true);

    const pendente = await novo.get('/api/documentos').expect(403);

    expect(pendente.body.error).toBe('MFA_NECESSARIO');

    await novo.post('/api/auth/mfa').send({ codigo: recuperacao }).expect(204);
    await novo.get('/api/documentos').expect(200);

    // O mesmo código de recuperação não vale duas vezes.
    const outro = navegador(app);

    await outro.post('/api/auth/entrar').send({ email: conta, senha: SENHA_FORTE }).expect(200);
    await outro.post('/api/auth/mfa').send({ codigo: recuperacao }).expect(401);
  });

  it('papéis: membro cria mas não audita; auditor audita mas não cria', async () => {
    const { agente: dono } = await novaOrganizacao(app);
    const membro = emailUnico('membro');
    const auditor = emailUnico('auditor');

    await dono
      .post('/api/equipe')
      .send({ nome: 'Membro', email: membro, papel: 'membro' })
      .expect(201);
    await dono
      .post('/api/equipe')
      .send({ nome: 'Auditor', email: auditor, papel: 'auditor' })
      .expect(201);

    const aceitarConvite = async (para: string) => {
      const convite = email.caixaDeTeste.find((m) => m.para === para);
      const token = convite?.texto.match(/token=([A-Za-z0-9_-]+)/)?.[1] as string;

      await publico()
        .post('/api/auth/redefinir-senha')
        .send({ token, senha: SENHA_FORTE })
        .expect(204);
      // Link de convite é de uso único.
      await publico()
        .post('/api/auth/redefinir-senha')
        .send({ token, senha: SENHA_FORTE })
        .expect(422);

      const agente = navegador(app);

      await agente.post('/api/auth/entrar').send({ email: para, senha: SENHA_FORTE }).expect(200);

      return agente;
    };

    const comoMembro = await aceitarConvite(membro);
    const comoAuditor = await aceitarConvite(auditor);

    await comoMembro.get('/api/auditoria').expect(403);
    await comoMembro
      .post('/api/equipe')
      .send({ nome: 'X', email: emailUnico(), papel: 'membro' })
      .expect(403);
    await comoMembro
      .post('/api/documentos')
      .field('titulo', 'Do membro')
      .attach('arquivo', await pdfDeTeste(), 'a.pdf')
      .expect(201);

    await comoAuditor.get('/api/auditoria').expect(200);
    await comoAuditor
      .post('/api/documentos')
      .field('titulo', 'Do auditor')
      .attach('arquivo', await pdfDeTeste(), 'a.pdf')
      .expect(403);

    // Desativar derruba a sessão na próxima requisição.
    const equipe = await dono.get('/api/equipe').expect(200);
    const uuidDoMembro = (equipe.body as { uuid: string; email: string }[]).find(
      (m) => m.email === membro,
    )?.uuid;

    await dono.patch(`/api/equipe/${uuidDoMembro}`).send({ ativo: false }).expect(200);
    await comoMembro.get('/api/me').expect(401);
  });

  it('a organização nunca fica sem proprietário ativo', async () => {
    const { agente: dono } = await novaOrganizacao(app);
    const equipe = await dono.get('/api/equipe').expect(200);
    const eu = (equipe.body as { uuid: string }[])[0]?.uuid;

    // Ninguém altera o próprio papel — é o que impede se trancar para fora.
    await dono.patch(`/api/equipe/${eu}`).send({ papel: 'membro' }).expect(400);
  });

  it('health: vivo e pronto (banco e Redis respondendo)', async () => {
    await publico().get('/api/saude').expect(200);

    const pronto = await publico().get('/api/saude/pronto').expect(200);

    expect(pronto.body.detalhes).toEqual({ banco: 'up', redis: 'up' });
  });

  it('cabeçalhos de segurança do helmet estão presentes', async () => {
    const resposta = await publico().get('/api/saude');

    expect(resposta.headers['content-security-policy']).toContain("default-src 'none'");
    expect(resposta.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(resposta.headers['x-content-type-options']).toBe('nosniff');
    expect(resposta.headers['x-powered-by']).toBeUndefined();
  });
});
