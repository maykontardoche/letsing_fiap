import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type Documento, type StatusDoDocumento } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import { PrismaService } from '../../config/database/prisma.service';
import { EnvService } from '../../config/env/env.service';
import { ArmazenamentoService } from '../../common/armazenamento/armazenamento.service';
import { ConvitesService, ehAVezDe } from '../../common/assinaturas/convites.service';
import { podeTransicionar } from '../../common/assinaturas/status-do-documento';
import { AuditoriaService, cadeiaDoDocumento } from '../../common/auditoria/auditoria.service';
import { verificarCadeia } from '../../common/auditoria/cadeia';
import { pode } from '../../common/auth/permissoes';
import type { Origem, UsuarioAutenticado } from '../../common/auth/requisicao';
import { chaveDeCifra, cifrar } from '../../common/cripto/cifra';
import { gerarCodigoDeDocumento, sha256 } from '../../common/cripto/hash';
import { LIMITES_DO_PLANO, ROTULO_DO_PLANO, inicioDoMes } from '../../common/planos';
import { comOrganizacaoDoContexto } from '../../common/tenancy/dados-escopados';
import { apenasDigitos, cpfValido } from '../../common/texto/mascaras';
import { contar, resumoDoEnvio } from '../../common/texto/plural';
import { detalheDoDocumento, resumoDoDocumento } from './apresentacao';
import type { AtualizarDocumentoDto, ListarDocumentosDto, SignatarioDto } from './documentos.dto';

const PAGINAS_MAXIMAS = 300;
const INCLUIR_NA_LISTAGEM = {
  criadoPor: { select: { nome: true } },
  signatarios: { select: { nome: true, status: true, ordem: true } },
} satisfies Prisma.DocumentoInclude;

export interface ArquivoEnviado {
  readonly buffer: Buffer;
  readonly originalname: string;
  readonly size: number;
}

/**
 * Regras de negócio de documentos.
 *
 * ## Quem vê o quê
 *
 * - com `documentos.ver_todos` (proprietário, administrador, auditor): todos da organização;
 * - sem ela (membro): os que **criou** e os em que é **signatário**.
 *
 * ⚠️ O filtro de visibilidade entra em TODA consulta, somado ao de organização
 * (que a extensão do Prisma já aplica). Documento fora da visibilidade responde
 * **404, não 403**: 403 confirmaria que o documento existe.
 */
@Injectable()
export class DocumentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly armazenamento: ArmazenamentoService,
    private readonly auditoria: AuditoriaService,
    private readonly convites: ConvitesService,
    private readonly env: EnvService,
  ) {}

  async listar(usuario: UsuarioAutenticado, filtro: ListarDocumentosDto) {
    const pagina = filtro.pagina ?? 1;
    const porPagina = filtro.por ?? 12;
    const visiveis = this.visibilidade(usuario);
    const busca: Prisma.DocumentoWhereInput = filtro.q
      ? {
          OR: [
            { titulo: { contains: filtro.q, mode: 'insensitive' } },
            { codigo: { contains: filtro.q.toUpperCase() } },
            {
              signatarios: {
                some: {
                  OR: [
                    { nome: { contains: filtro.q, mode: 'insensitive' } },
                    { email: { contains: filtro.q.toLowerCase() } },
                  ],
                },
              },
            },
          ],
        }
      : {};
    const onde: Prisma.DocumentoWhereInput = {
      AND: [visiveis, busca, filtro.status ? { status: filtro.status } : {}],
    };

    const [itens, total, porStatus] = await Promise.all([
      this.prisma.db.documento.findMany({
        where: onde,
        include: INCLUIR_NA_LISTAGEM,
        orderBy: { [filtro.ordenar ?? 'criadoEm']: filtro.dir ?? 'desc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
      }),
      this.prisma.db.documento.count({ where: onde }),
      this.prisma.db.documento.groupBy({
        by: ['status'],
        where: { AND: [visiveis, busca] },
        _count: true,
      }),
    ]);

    return {
      itens: itens.map(resumoDoDocumento),
      total,
      pagina,
      porPagina,
      contagens: Object.fromEntries(
        porStatus.map((grupo) => [grupo.status, grupo._count]),
      ) as Partial<Record<StatusDoDocumento, number>>,
    };
  }

  async criar(
    usuario: UsuarioAutenticado,
    dados: { titulo: string; mensagem?: string },
    arquivo: ArquivoEnviado | undefined,
    origem: Origem,
  ) {
    if (arquivo === undefined) throw new BadRequestException('Envie o arquivo PDF do documento.');

    const paginas = await this.validarPdf(arquivo);
    const documento = await this.prisma.db.$transaction(async (tx) => {
      const criado = await tx.documento.create({
        data: comOrganizacaoDoContexto<Prisma.DocumentoUncheckedCreateInput>({
          criadoPorId: usuario.id,
          titulo: dados.titulo,
          mensagem: dados.mensagem || null,
          codigo: gerarCodigoDeDocumento(),
          nomeArquivo: arquivo.originalname.slice(0, 200),
          tamanhoBytes: arquivo.size,
          paginas,
          hashOriginal: sha256(arquivo.buffer),
          // Provisório: a chave depende do uuid, que só existe depois do insert.
          arquivoOriginal: '',
        }),
      });
      const chave = ArmazenamentoService.chaveDoDocumento(
        usuario.organizacaoId,
        criado.uuid,
        'original',
      );

      await this.armazenamento.gravar(chave, arquivo.buffer);

      await this.auditoria.registrar(
        {
          acao: 'documento_criado',
          resumo: `${usuario.nome} enviou o arquivo “${criado.nomeArquivo}” (${paginas} página${paginas > 1 ? 's' : ''}).`,
          tipoAtor: 'usuario',
          atorId: usuario.id,
          atorNome: usuario.nome,
          documento: { id: criado.id, uuid: criado.uuid },
          dados: { hashOriginal: criado.hashOriginal, tamanhoBytes: criado.tamanhoBytes },
          origem,
        },
        tx,
      );

      return tx.documento.update({ where: { id: criado.id }, data: { arquivoOriginal: chave } });
    });

    return this.detalhe(usuario, documento.uuid);
  }

  async detalhe(usuario: UsuarioAutenticado, uuid: string) {
    const documento = await this.prisma.db.documento.findFirst({
      where: { AND: [{ uuid }, this.visibilidade(usuario)] },
      include: {
        criadoPor: { select: { nome: true, email: true } },
        signatarios: { include: { desafios: { where: { aprovado: true } } } },
      },
    });

    if (documento === null) throw new NotFoundException('Documento não encontrado.');

    const meu = documento.signatarios.find((s) => s.email === usuario.email);

    return detalheDoDocumento(documento, {
      podeGerenciar: this.podeGerenciar(usuario, documento),
      urlDeValidacao: `${this.env.urlDoApp}/validar/${documento.codigo}`,
      meuSignatario:
        meu !== undefined &&
        documento.status === 'em_andamento' &&
        ehAVezDe(meu, documento.signatarios, documento.ordemSequencial)
          ? meu.uuid
          : null,
    });
  }

  async atualizar(
    usuario: UsuarioAutenticado,
    uuid: string,
    dto: AtualizarDocumentoDto,
    origem: Origem,
  ) {
    const documento = await this.rascunhoGerenciavel(usuario, uuid);

    if (dto.prazo && new Date(dto.prazo) <= new Date()) {
      throw new BadRequestException('O prazo precisa ser uma data no futuro.');
    }

    await this.prisma.db.documento.update({
      where: { id: documento.id },
      data: {
        titulo: dto.titulo,
        mensagem: dto.mensagem === undefined ? undefined : dto.mensagem || null,
        nivelVerificacao: dto.nivelVerificacao,
        ordemSequencial: dto.ordemSequencial,
        prazo:
          dto.prazo === undefined ? undefined : dto.prazo === null ? null : new Date(dto.prazo),
      },
    });

    await this.auditoria.registrar({
      acao: 'documento_configurado',
      resumo: `${usuario.nome} ajustou as configurações do rascunho.`,
      tipoAtor: 'usuario',
      atorId: usuario.id,
      atorNome: usuario.nome,
      documento: { id: documento.id, uuid: documento.uuid },
      dados: { ...dto },
      origem,
    });

    return this.detalhe(usuario, uuid);
  }

  /** Substitui a lista inteira de signatários. A ordem do array é a ordem de assinatura. */
  async definirSignatarios(
    usuario: UsuarioAutenticado,
    uuid: string,
    lista: SignatarioDto[],
    origem: Origem,
  ) {
    const documento = await this.rascunhoGerenciavel(usuario, uuid);
    const emails = new Set(lista.map((s) => s.email));

    if (emails.size !== lista.length)
      throw new BadRequestException('Há e-mails repetidos entre os signatários.');

    const chave = chaveDeCifra(this.env.chaveDeCifra);
    // ⚠️ A API só devolve o CPF mascarado, então reeditar a lista chega sem ele. Para o
    // mesmo e-mail, sem CPF novo, o já cifrado é mantido — senão salvar de novo o apagaria.
    const anteriores = new Map(
      (
        await this.prisma.db.signatario.findMany({
          where: { documentoId: documento.id },
          select: { email: true, cpfCifrado: true, cpfFinal: true },
        })
      ).map((s) => [s.email, s]),
    );
    const linhas = lista.map((s, indice) => {
      const cpf = s.cpf ? apenasDigitos(s.cpf) : null;

      if (cpf !== null && cpf.length > 0 && !cpfValido(cpf)) {
        throw new BadRequestException(`O CPF de ${s.nome} é inválido.`);
      }

      const anterior = cpf ? undefined : anteriores.get(s.email);

      return {
        organizacaoId: usuario.organizacaoId,
        documentoId: documento.id,
        nome: s.nome,
        email: s.email,
        ordem: indice + 1,
        cpfCifrado: cpf ? cifrar(cpf, chave) : (anterior?.cpfCifrado ?? null),
        cpfFinal: cpf ? cpf.slice(-2) : (anterior?.cpfFinal ?? null),
      };
    });

    await this.prisma.db.$transaction(async (tx) => {
      await tx.signatario.deleteMany({ where: { documentoId: documento.id } });
      await tx.signatario.createMany({ data: linhas });
      await this.auditoria.registrar(
        {
          acao: 'signatarios_definidos',
          resumo: `${usuario.nome} definiu ${contar(lista.length, 'signatário', 'signatários')}: ${lista.map((s) => s.nome).join(', ')}.`,
          tipoAtor: 'usuario',
          atorId: usuario.id,
          atorNome: usuario.nome,
          documento: { id: documento.id, uuid: documento.uuid },
          origem,
        },
        tx,
      );
    });

    return this.detalhe(usuario, uuid);
  }

  /** Rascunho → em andamento: confere a cota do plano, emite os links e envia os convites. */
  async enviar(usuario: UsuarioAutenticado, uuid: string, origem: Origem) {
    const documento = await this.rascunhoGerenciavel(usuario, uuid);
    const signatarios = await this.prisma.db.signatario.findMany({
      where: { documentoId: documento.id },
      orderBy: { ordem: 'asc' },
    });

    if (signatarios.length === 0)
      throw new UnprocessableEntityException('Adicione pelo menos um signatário antes de enviar.');
    if (documento.prazo !== null && documento.prazo <= new Date()) {
      throw new UnprocessableEntityException('O prazo já passou. Ajuste a data antes de enviar.');
    }

    await this.exigirCotaDoPlano(usuario.organizacaoId);

    const organizacao = await this.prisma.db.organizacao.findUniqueOrThrow({
      where: { id: usuario.organizacaoId },
    });
    const primeiros = documento.ordemSequencial ? signatarios.slice(0, 1) : signatarios;

    await this.prisma.db.$transaction(async (tx) => {
      const { count } = await tx.documento.updateMany({
        where: { id: documento.id, status: 'rascunho' },
        data: { status: 'em_andamento', enviadoEm: new Date() },
      });

      if (count === 0) throw new UnprocessableEntityException('Este documento já foi enviado.');

      await this.auditoria.registrar(
        {
          acao: 'documento_enviado',
          resumo: resumoDoEnvio(usuario.nome, signatarios.length, documento.ordemSequencial),
          tipoAtor: 'usuario',
          atorId: usuario.id,
          atorNome: usuario.nome,
          documento: { id: documento.id, uuid: documento.uuid },
          dados: {
            nivelVerificacao: documento.nivelVerificacao,
            ordemSequencial: documento.ordemSequencial,
          },
          origem,
        },
        tx,
      );
    });

    // ⚠️ Depois do commit: e-mail enfileirado dentro da transação sairia mesmo
    // se ela fosse desfeita, com um link que não existe.
    for (const signatario of primeiros) {
      await this.convites.convidar(signatario, {
        documento,
        organizacao: organizacao.nome,
        remetente: usuario.nome,
      });
    }

    return this.detalhe(usuario, uuid);
  }

  async cancelar(usuario: UsuarioAutenticado, uuid: string, motivo: string, origem: Origem) {
    const documento = await this.gerenciavel(usuario, uuid);

    if (!podeTransicionar(documento.status, 'cancelado')) {
      throw new UnprocessableEntityException('Só é possível cancelar um documento em andamento.');
    }

    await this.prisma.db.$transaction(async (tx) => {
      await tx.documento.update({
        where: { id: documento.id },
        data: { status: 'cancelado', canceladoEm: new Date(), motivoCancelamento: motivo },
      });
      // Os links deixam de valer na hora.
      await tx.signatario.updateMany({
        where: { documentoId: documento.id },
        data: { tokenHash: null },
      });
      await this.auditoria.registrar(
        {
          acao: 'documento_cancelado',
          resumo: `${usuario.nome} cancelou o documento. Motivo: “${motivo}”.`,
          tipoAtor: 'usuario',
          atorId: usuario.id,
          atorNome: usuario.nome,
          documento: { id: documento.id, uuid: documento.uuid },
          origem,
        },
        tx,
      );
    });

    return this.detalhe(usuario, uuid);
  }

  /** Remove um rascunho — nunca um documento já enviado, que tem trilha e terceiros envolvidos. */
  async excluirRascunho(usuario: UsuarioAutenticado, uuid: string, origem: Origem): Promise<void> {
    const documento = await this.rascunhoGerenciavel(usuario, uuid);

    await this.prisma.db.$transaction(async (tx) => {
      await tx.documento.delete({ where: { id: documento.id } });
      await this.auditoria.registrar(
        {
          acao: 'rascunho_excluido',
          resumo: `${usuario.nome} excluiu o rascunho “${documento.titulo}”.`,
          tipoAtor: 'usuario',
          atorId: usuario.id,
          atorNome: usuario.nome,
          dados: { documento: documento.uuid, hashOriginal: documento.hashOriginal },
          origem,
        },
        tx,
      );
    });

    await this.armazenamento.remover(documento.arquivoOriginal);
  }

  /** Reenvia o convite (rotacionando o link) a um signatário que ainda não assinou. */
  async reenviarConvite(usuario: UsuarioAutenticado, uuid: string, signatarioUuid: string) {
    const { documento, signatario, todos } = await this.signatarioEmAndamento(
      usuario,
      uuid,
      signatarioUuid,
    );

    if (!ehAVezDe(signatario, todos, documento.ordemSequencial)) {
      throw new UnprocessableEntityException(
        'Ainda não é a vez deste signatário — ele receberá o convite quando os anteriores assinarem.',
      );
    }

    const organizacao = await this.prisma.db.organizacao.findUniqueOrThrow({
      where: { id: usuario.organizacaoId },
    });
    const link = await this.convites.convidar(
      signatario,
      { documento, organizacao: organizacao.nome, remetente: usuario.nome },
      { reenvio: true },
    );

    await this.prisma.db.signatario.update({
      where: { id: signatario.id },
      data: { lembreteEm: new Date() },
    });

    return { link };
  }

  /**
   * "Assinar agora": a pessoa logada é signatária e é a vez dela. Emite um link
   * novo e o devolve — o SPA leva direto para o fluxo de assinatura.
   *
   * ⚠️ O link não pula nenhuma verificação: o código por e-mail e a biometria
   * continuam exigidos, exatamente como para quem vem pelo convite.
   */
  async assinarAgora(usuario: UsuarioAutenticado, uuid: string) {
    const documento = await this.prisma.db.documento.findFirst({
      where: { AND: [{ uuid }, this.visibilidade(usuario)] },
      include: { signatarios: true },
    });

    if (documento === null) throw new NotFoundException('Documento não encontrado.');

    const meu = documento.signatarios.find((s) => s.email === usuario.email);

    if (
      meu === undefined ||
      documento.status !== 'em_andamento' ||
      !ehAVezDe(meu, documento.signatarios, documento.ordemSequencial)
    ) {
      throw new UnprocessableEntityException(
        'Não há assinatura sua pendente neste documento agora.',
      );
    }

    const link = await this.convites.emitirLink(meu, documento);

    return { caminho: new URL(link).pathname };
  }

  async arquivo(usuario: UsuarioAutenticado, uuid: string, versao: 'original' | 'assinado') {
    const documento = await this.prisma.db.documento.findFirst({
      where: { AND: [{ uuid }, this.visibilidade(usuario)] },
    });

    if (documento === null) throw new NotFoundException('Documento não encontrado.');

    const chave = versao === 'assinado' ? documento.arquivoAssinado : documento.arquivoOriginal;

    if (chave === null)
      throw new NotFoundException('O PDF assinado só existe depois que todos assinam.');

    // ⚠️ Segunda camada contra IDOR: a chave precisa estar na pasta da organização.
    if (!this.armazenamento.pertence(chave, usuario.organizacaoId))
      throw new NotFoundException('Documento não encontrado.');

    return {
      conteudo: await this.armazenamento.ler(chave),
      nome: `${documento.codigo}-${versao}.pdf`,
    };
  }

  async trilha(usuario: UsuarioAutenticado, uuid: string) {
    const documento = await this.prisma.db.documento.findFirst({
      where: { AND: [{ uuid }, this.visibilidade(usuario)] },
      select: { uuid: true },
    });

    if (documento === null) throw new NotFoundException('Documento não encontrado.');

    const eventos = await this.prisma.db.eventoDeAuditoria.findMany({
      where: { cadeia: cadeiaDoDocumento(documento.uuid) },
      orderBy: { sequencia: 'asc' },
    });

    return {
      integridade: verificarCadeia(eventos),
      eventos: eventos.map((e) => ({
        sequencia: e.sequencia,
        acao: e.acao,
        resumo: e.resumo,
        tipoAtor: e.tipoAtor,
        atorNome: e.atorNome,
        ip: e.ip,
        criadoEm: e.criadoEm,
        hash: e.hash,
      })),
    };
  }

  // -------------------------------------------------------------------------

  private visibilidade(usuario: UsuarioAutenticado): Prisma.DocumentoWhereInput {
    if (pode(usuario.papel, 'documentos.ver_todos')) return {};

    return {
      OR: [{ criadoPorId: usuario.id }, { signatarios: { some: { email: usuario.email } } }],
    };
  }

  private podeGerenciar(
    usuario: UsuarioAutenticado,
    documento: Pick<Documento, 'criadoPorId'>,
  ): boolean {
    return (
      documento.criadoPorId === usuario.id || pode(usuario.papel, 'documentos.gerenciar_todos')
    );
  }

  private async gerenciavel(usuario: UsuarioAutenticado, uuid: string): Promise<Documento> {
    const documento = await this.prisma.db.documento.findFirst({
      where: { AND: [{ uuid }, this.visibilidade(usuario)] },
    });

    if (documento === null) throw new NotFoundException('Documento não encontrado.');
    if (!this.podeGerenciar(usuario, documento))
      throw new ForbiddenException('Só quem criou o documento pode alterá-lo.');

    return documento;
  }

  private async rascunhoGerenciavel(usuario: UsuarioAutenticado, uuid: string): Promise<Documento> {
    const documento = await this.gerenciavel(usuario, uuid);

    if (documento.status !== 'rascunho') {
      throw new UnprocessableEntityException(
        'Depois de enviado, o documento não pode mais ser alterado.',
      );
    }

    return documento;
  }

  private async signatarioEmAndamento(
    usuario: UsuarioAutenticado,
    uuid: string,
    signatarioUuid: string,
  ) {
    const documento = await this.gerenciavel(usuario, uuid);

    if (documento.status !== 'em_andamento')
      throw new UnprocessableEntityException('O documento não está em andamento.');

    const todos = await this.prisma.db.signatario.findMany({
      where: { documentoId: documento.id },
    });
    const signatario = todos.find((s) => s.uuid === signatarioUuid);

    if (signatario === undefined) throw new NotFoundException('Signatário não encontrado.');

    return { documento, signatario, todos };
  }

  private async exigirCotaDoPlano(organizacaoId: number): Promise<void> {
    const organizacao = await this.prisma.db.organizacao.findUniqueOrThrow({
      where: { id: organizacaoId },
    });
    const limite = LIMITES_DO_PLANO[organizacao.plano].enviosPorMes;

    if (limite === null) return;

    const enviados = await this.prisma.db.documento.count({
      where: { enviadoEm: { gte: inicioDoMes() } },
    });

    if (enviados >= limite) {
      throw new UnprocessableEntityException(
        `O plano ${ROTULO_DO_PLANO[organizacao.plano]} permite ${limite} envios por mês, e a cota deste mês acabou. Faça upgrade em Configurações.`,
      );
    }
  }

  /**
   * Confere que o arquivo é mesmo um PDF legível — não só pela extensão.
   *
   * ⚠️ `mimetype` vem do cliente e é mentira barata. O que vale é a assinatura
   * mágica `%PDF-` no início e o pdf-lib conseguir abrir. PDF protegido por
   * senha é recusado: não dá para carimbar o manifesto nele depois.
   */
  private async validarPdf(arquivo: ArquivoEnviado): Promise<number> {
    if (arquivo.size > this.env.tamanhoMaximoPdfBytes) {
      throw new BadRequestException(
        `O PDF pode ter até ${Math.round(this.env.tamanhoMaximoPdfBytes / 1048576)} MB.`,
      );
    }

    if (arquivo.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new BadRequestException('O arquivo enviado não é um PDF.');
    }

    let paginas: number;

    try {
      paginas = (await PDFDocument.load(arquivo.buffer)).getPageCount();
    } catch (erro) {
      const protegido = erro instanceof Error && /encrypt/i.test(erro.message);

      throw new BadRequestException(
        protegido
          ? 'Este PDF está protegido por senha. Remova a proteção e envie de novo.'
          : 'Não foi possível ler este PDF. Ele pode estar corrompido.',
      );
    }

    if (paginas < 1 || paginas > PAGINAS_MAXIMAS) {
      throw new BadRequestException(`O PDF precisa ter entre 1 e ${PAGINAS_MAXIMAS} páginas.`);
    }

    return paginas;
  }
}
