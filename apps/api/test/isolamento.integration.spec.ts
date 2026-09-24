import type { INestApplication } from '@nestjs/common';
import type { EmailService } from '../src/common/email/email.service';
import type { PrismaService } from '../src/config/database/prisma.service';
import {
  documentoEnviado,
  emailUnico,
  novaOrganizacao,
  subirAplicacao,
  type Agente,
} from './aplicacao';

/**
 * ⚠️ **GATE BLOQUEANTE: isolamento entre organizações.**
 *
 * A organização B não lê, não altera e não descobre a existência de nada da
 * organização A — em nenhuma rota. Resposta para recurso alheio é **404**, não
 * 403: 403 confirmaria que o documento existe.
 */
describe('Isolamento entre organizações', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: EmailService;
  let a: Agente;
  let b: Agente;
  let documentoDeA: { uuid: string; codigo: string };

  beforeAll(async () => {
    ({ app, prisma, email } = await subirAplicacao());
    a = (await novaOrganizacao(app, 'Organização A')).agente;
    b = (await novaOrganizacao(app, 'Organização B')).agente;
    documentoDeA = await documentoEnviado(a, email, {
      signatarios: [{ nome: 'Cliente de A', email: emailUnico('cliente') }],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('a listagem de B não contém o documento de A', async () => {
    const resposta = await b.get('/api/documentos?por=100').expect(200);

    expect(resposta.body.itens.map((d: { uuid: string }) => d.uuid)).not.toContain(
      documentoDeA.uuid,
    );
    expect(resposta.body.total).toBe(0);
  });

  it.each([
    ['GET', ''],
    ['GET', '/arquivo'],
    ['GET', '/trilha'],
    ['PATCH', ''],
    ['DELETE', ''],
    ['POST', '/cancelar'],
    ['POST', '/assinar-agora'],
  ])('%s /documentos/:uuid%s de A, vindo de B, responde 404', async (metodo, sufixo) => {
    const caminho = `/api/documentos/${documentoDeA.uuid}${sufixo}`;
    const requisicao =
      metodo === 'GET'
        ? b.get(caminho)
        : metodo === 'PATCH'
          ? b.patch(caminho).send({ titulo: 'invadido' })
          : metodo === 'DELETE'
            ? b.delete(caminho)
            : b.post(caminho).send({ motivo: 'tentativa de B' });

    await requisicao.expect(404);
  });

  it('o documento de A continua intacto depois das tentativas de B', async () => {
    const resposta = await a.get(`/api/documentos/${documentoDeA.uuid}`).expect(200);

    expect(resposta.body.titulo).toBe('Contrato de teste');
    expect(resposta.body.status).toBe('em_andamento');
  });

  it('a equipe e a auditoria de B não mostram ninguém nem nada de A', async () => {
    const equipe = await b.get('/api/equipe').expect(200);
    const auditoria = await b.get('/api/auditoria?por=100').expect(200);

    expect(equipe.body).toHaveLength(1);
    expect(
      auditoria.body.itens.every((e: { resumo: string }) => !e.resumo.includes('Cliente de A')),
    ).toBe(true);
  });

  it('o painel de B conta só os documentos de B', async () => {
    const painel = await b.get('/api/painel').expect(200);

    expect(painel.body.indicadores.total).toBe(0);
  });

  it('criar sem informar a organização grava a do contexto de quem criou', async () => {
    const registro = await prisma.db.documento.findUniqueOrThrow({
      where: { uuid: documentoDeA.uuid },
      include: { criadoPor: true, signatarios: true },
    });
    const eventos = await prisma.db.eventoDeAuditoria.findMany({
      where: { documentoId: registro.id },
    });

    expect(registro.organizacaoId).toBe(registro.criadoPor.organizacaoId);
    expect(registro.signatarios.every((s) => s.organizacaoId === registro.organizacaoId)).toBe(
      true,
    );
    expect(eventos.length).toBeGreaterThan(0);
    expect(eventos.every((e) => e.organizacaoId === registro.organizacaoId)).toBe(true);
  });

  it('a validação pública é a única porta entre organizações — e só mostra o que é público', async () => {
    const resposta = await b.get(`/api/publico/validar/${documentoDeA.codigo}`).expect(200);

    expect(resposta.body.documento.titulo).toBe('Contrato de teste');
    expect(JSON.stringify(resposta.body)).not.toMatch(
      /"(id|tokenHash|cpfCifrado|arquivoOriginal|email)"/,
    );
  });
});
