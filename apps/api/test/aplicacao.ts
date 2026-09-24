import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import request from 'supertest';

export type Agente = ReturnType<typeof request.agent>;
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/common/email/email.service';
import { EnvService } from '../src/config/env/env.service';
import { PrismaService } from '../src/config/database/prisma.service';
import { RedisService } from '../src/config/redis/redis.service';
import { configurarApp } from '../src/configurar-app';

/**
 * Sobe a aplicação **inteira** — mesmos módulos, mesma borda de segurança
 * (`configurarApp`) que a produção. Um teste que sobe outra configuração prova
 * outra coisa.
 */
export async function subirAplicacao(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
  email: EmailService;
}> {
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = modulo.createNestApplication({ logger: false });

  configurarApp(app, app.get(EnvService));
  await app.init();

  // Contadores de tentativa de login e sessões de uma suíte não vazam para a outra.
  await app.get(RedisService).cliente.flushdb();

  return { app, prisma: app.get(PrismaService), email: app.get(EmailService) };
}

/** Um "navegador": guarda o cookie de sessão entre as requisições. */
export function navegador(app: INestApplication): Agente {
  return request.agent(app.getHttpServer());
}

let sequencial = 0;

/** Um e-mail único por execução — a suíte roda contra um banco que não é apagado. */
export function emailUnico(prefixo = 'pessoa'): string {
  sequencial += 1;

  return `${prefixo}.${Date.now().toString(36)}.${sequencial}@teste.letssign.dev`;
}

export const SENHA_FORTE = 'Senha@Forte2026';

/** Cria uma organização nova com o proprietário já logado no agente devolvido. */
export async function novaOrganizacao(app: INestApplication, nome = 'Organização de Teste') {
  const agente = navegador(app);
  const email = emailUnico('dono');

  await agente
    .post('/api/auth/cadastro')
    .send({
      nomeOrganizacao: nome,
      nome: 'Dono do Teste',
      email,
      senha: SENHA_FORTE,
      plano: 'empresarial',
    })
    .expect(201);

  return { agente, email };
}

/** Um PDF mínimo e válido, gerado na hora. */
export async function pdfDeTeste(texto = 'Contrato de teste'): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);

  pdf.addPage([595, 842]).drawText(texto, { x: 50, y: 780, size: 16, font: fonte });

  return Buffer.from(await pdf.save());
}

/** Rubrica PNG 1×1 transparente. */
export const RUBRICA =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Cria, configura e envia um documento; devolve o uuid e o token do convite do 1º signatário. */
export async function documentoEnviado(
  agente: Agente,
  email: EmailService,
  opcoes: { signatarios: { nome: string; email: string }[]; nivel?: string; sequencial?: boolean },
) {
  const criado = await agente
    .post('/api/documentos')
    .field('titulo', 'Contrato de teste')
    .attach('arquivo', await pdfDeTeste(), {
      filename: 'contrato.pdf',
      contentType: 'application/pdf',
    })
    .expect(201);
  const uuid = criado.body.uuid as string;

  await agente
    .put(`/api/documentos/${uuid}/signatarios`)
    .send({ signatarios: opcoes.signatarios })
    .expect(200);

  if (opcoes.nivel !== undefined || opcoes.sequencial !== undefined) {
    await agente
      .patch(`/api/documentos/${uuid}`)
      .send({
        nivelVerificacao: opcoes.nivel ?? 'simples',
        ordemSequencial: opcoes.sequencial ?? false,
      })
      .expect(200);
  }

  await agente.post(`/api/documentos/${uuid}/enviar`).expect(200);

  return {
    uuid,
    codigo: criado.body.codigo as string,
    token: tokenDoConvite(email, opcoes.signatarios[0]?.email ?? ''),
  };
}

/** O token do link de assinatura, lido do último convite enviado para o e-mail. */
export function tokenDoConvite(email: EmailService, para: string): string {
  const convite = [...email.caixaDeTeste]
    .reverse()
    .find((m) => m.para === para && m.assunto.startsWith('Assinatura solicitada'));
  const token = convite?.texto.match(/\/assinar\/([A-Za-z0-9_-]+)/)?.[1];

  if (token === undefined) throw new Error(`Nenhum convite para ${para}.`);

  return token;
}

/** O último código de verificação enviado para o e-mail. */
export function codigoDoEmail(email: EmailService, para: string): string {
  const mensagem = [...email.caixaDeTeste]
    .reverse()
    .find((m) => m.para === para && m.assunto.includes('código de verificação'));
  const codigo = mensagem?.assunto.match(/^\d{6}/)?.[0];

  if (codigo === undefined) throw new Error(`Nenhum código para ${para}.`);

  return codigo;
}
