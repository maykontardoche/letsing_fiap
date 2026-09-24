import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  Prisma,
  type DesafioDeVerificacao,
  type Documento,
  type Organizacao,
  type Signatario,
  type TipoDeVerificacao,
  type Usuario,
} from '@prisma/client';
import { PrismaService } from '../../config/database/prisma.service';
import { EnvService } from '../../config/env/env.service';
import { ArmazenamentoService } from '../../common/armazenamento/armazenamento.service';
import { ConvitesService, ehAVezDe } from '../../common/assinaturas/convites.service';
import { FinalizadorDeDocumentoService } from '../../common/assinaturas/finalizador-de-documento.service';
import {
  ROTULO_DA_VERIFICACAO,
  VERIFICACOES_DO_NIVEL,
} from '../../common/assinaturas/status-do-documento';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import type { Origem } from '../../common/auth/requisicao';
import { ChaveDaPlataformaService } from '../../common/cripto/chave-da-plataforma.service';
import { chaveDeCifra, cifrar } from '../../common/cripto/cifra';
import { gerarCodigoNumerico, iguaisEmTempoConstante, sha256 } from '../../common/cripto/hash';
import { EmailService } from '../../common/email/email.service';
import { modelos } from '../../common/email/modelos';
import { NotificacoesService } from '../../common/notificacoes/notificacoes.service';
import { comOrganizacaoDoContexto } from '../../common/tenancy/dados-escopados';
import { executarNoContexto, semEscopoDeOrganizacao } from '../../common/tenancy/tenant-context';
import { abreviarNome, apenasDigitos, cpfValido, mascararEmail } from '../../common/texto/mascaras';
import {
  ACOES_DE_VIVACIDADE,
  avaliarFacial,
  avaliarGestos,
  avaliarVoz,
  GESTOS,
  PALAVRAS,
  sortear,
  TENTATIVAS_POR_DESAFIO,
  VALIDADE_DA_APROVACAO_MS,
  VALIDADE_DO_CODIGO_MS,
  VALIDADE_DO_DESAFIO_MS,
  type ResultadoDoDesafio,
} from './desafios';
import type {
  AssinarDto,
  ConcluirCodigoDto,
  ConcluirFacialDto,
  ConcluirGestosDto,
  ConcluirVozDto,
} from './assinatura.dto';

type DocumentoCompleto = Documento & {
  organizacao: Organizacao;
  criadoPor: Usuario;
  signatarios: Signatario[];
};

interface Contexto {
  readonly signatario: Signatario & { desafios: DesafioDeVerificacao[] };
  readonly documento: DocumentoCompleto;
}

const LINK_INVALIDO =
  'Este link de assinatura é inválido ou expirou. Peça um novo convite a quem enviou o documento.';

/**
 * O fluxo de quem assina — **sem conta**, autenticado pelo token do link.
 *
 * ## Como o token vira contexto
 *
 * O token chega na URL; o banco só tem o hash dele. A busca é **sem escopo** de
 * organização (quem assina não está logado, logo não há contexto), e a partir do
 * signatário encontrado o resto da operação roda **dentro** do contexto da
 * organização do documento — com o isolamento valendo como em qualquer outra rota.
 *
 * ## Ordem das verificações
 *
 * ⚠️ As verificações do nível seguem uma ordem fixa (e-mail → rosto → voz →
 * gestos), e cada uma exige as anteriores aprovadas. Pular direto para a
 * biometria sem provar a posse do e-mail seria assinar pelo link de outra pessoa.
 */
@Injectable()
export class AssinaturaService {
  private readonly logger = new Logger(AssinaturaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly armazenamento: ArmazenamentoService,
    private readonly auditoria: AuditoriaService,
    private readonly convites: ConvitesService,
    private readonly finalizador: FinalizadorDeDocumentoService,
    private readonly chave: ChaveDaPlataformaService,
    private readonly email: EmailService,
    private readonly notificacoes: NotificacoesService,
    private readonly env: EnvService,
  ) {}

  /** Resolve o token e executa `acao` dentro do contexto da organização do documento. */
  private async comToken<T>(token: string, acao: (contexto: Contexto) => Promise<T>): Promise<T> {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw new NotFoundException(LINK_INVALIDO);

    // Sem escopo: quem assina não tem sessão, e é o próprio token que diz de qual organização é.
    const signatario = await semEscopoDeOrganizacao(() =>
      this.prisma.db.signatario.findUnique({
        where: { tokenHash: sha256(token) },
        include: {
          desafios: { orderBy: { criadoEm: 'desc' } },
          documento: {
            include: {
              organizacao: true,
              criadoPor: true,
              signatarios: { orderBy: { ordem: 'asc' } },
            },
          },
        },
      }),
    );

    if (
      signatario === null ||
      (signatario.tokenExpiraEm !== null && signatario.tokenExpiraEm < new Date())
    ) {
      throw new NotFoundException(LINK_INVALIDO);
    }

    const { documento, ...resto } = signatario;

    return executarNoContexto({ organizacaoId: signatario.organizacaoId }, () =>
      acao({ signatario: resto, documento }),
    );
  }

  async sessao(token: string, origem: Origem) {
    return this.comToken(token, async ({ signatario, documento }) => {
      if (signatario.visualizadoEm === null && documento.status === 'em_andamento') {
        await this.prisma.db.$transaction(async (tx) => {
          await tx.signatario.update({
            where: { id: signatario.id },
            data: {
              visualizadoEm: new Date(),
              status: signatario.status === 'pendente' ? 'visualizado' : signatario.status,
            },
          });
          await this.auditoria.registrar(
            {
              acao: 'documento_visualizado',
              resumo: `${signatario.nome} abriu o documento pelo link de assinatura.`,
              tipoAtor: 'signatario',
              atorId: signatario.id,
              atorNome: signatario.nome,
              documento: { id: documento.id, uuid: documento.uuid },
              origem,
            },
            tx,
          );
        });
      }

      return this.montarSessao(signatario, documento);
    });
  }

  async arquivo(token: string, versao: 'original' | 'assinado') {
    return this.comToken(token, async ({ documento }) => {
      const chave = versao === 'assinado' ? documento.arquivoAssinado : documento.arquivoOriginal;

      if (chave === null)
        throw new NotFoundException('O PDF assinado fica disponível quando todos assinarem.');

      return {
        conteudo: await this.armazenamento.ler(chave),
        nome: `${documento.codigo}-${versao}.pdf`,
      };
    });
  }

  /** Sorteia e registra um desafio de verificação. */
  async iniciarVerificacao(token: string, tipo: TipoDeVerificacao) {
    return this.comToken(token, async ({ signatario, documento }) => {
      this.exigirPodeAssinar(signatario, documento);
      this.exigirEtapaLiberada(signatario, documento, tipo);

      if (tipo === 'codigo_email') return this.enviarCodigo(signatario, documento);

      const desafio = sortearDesafio(tipo);
      const registro = await this.prisma.db.desafioDeVerificacao.create({
        data: comOrganizacaoDoContexto<Prisma.DesafioDeVerificacaoUncheckedCreateInput>({
          signatarioId: signatario.id,
          tipo,
          desafio,
          expiraEm: new Date(Date.now() + VALIDADE_DO_DESAFIO_MS),
        }),
      });

      return { desafio: registro.uuid, expiraEm: registro.expiraEm, ...desafio };
    });
  }

  concluirCodigo(token: string, dto: ConcluirCodigoDto, origem: Origem) {
    return this.concluir(token, 'codigo_email', dto.desafio, origem, (desafio) => {
      const esperado = (desafio.desafio as { hash: string }).hash;

      return iguaisEmTempoConstante(sha256(`${dto.codigo}:${desafio.uuid}`), esperado)
        ? { aprovado: true, pontuacao: 1 }
        : {
            aprovado: false,
            pontuacao: 0,
            motivo: 'Código incorreto. Confira o e-mail mais recente.',
          };
    });
  }

  concluirVoz(token: string, dto: ConcluirVozDto, origem: Origem) {
    return this.concluir(
      token,
      'voz',
      dto.desafio,
      origem,
      (desafio) =>
        avaliarVoz((desafio.desafio as { palavras: string[] }).palavras, dto.transcricao),
      { transcricao: dto.transcricao.slice(0, 200) },
    );
  }

  concluirGestos(token: string, dto: ConcluirGestosDto, origem: Origem) {
    return this.concluir(
      token,
      'gestos',
      dto.desafio,
      origem,
      (desafio) =>
        avaliarGestos(
          (desafio.desafio as { sequencia: string[] }).sequencia,
          dto.gestos,
          dto.confiancas,
        ),
      { gestos: dto.gestos },
    );
  }

  concluirFacial(token: string, dto: ConcluirFacialDto, origem: Origem) {
    return this.concluir(
      token,
      'facial',
      dto.desafio,
      origem,
      (desafio) => avaliarFacial((desafio.desafio as { acoes: string[] }).acoes, dto.medicao),
      { ...dto.medicao },
    );
  }

  /** O ato de assinar. Exige todas as verificações do nível aprovadas há menos de 30 minutos. */
  async assinar(token: string, dto: AssinarDto, origem: Origem): Promise<{ concluido: boolean }> {
    const resultado = await this.comToken(token, async ({ signatario, documento }) => {
      this.exigirPodeAssinar(signatario, documento);

      const aprovadas = this.verificacoesValidas(signatario, documento);
      const faltando = VERIFICACOES_DO_NIVEL[documento.nivelVerificacao].filter(
        (tipo) => !aprovadas.has(tipo),
      );

      if (faltando.length > 0) {
        throw new UnprocessableEntityException(
          `Conclua antes: ${faltando.map((tipo) => ROTULO_DA_VERIFICACAO[tipo]).join(', ')}.`,
        );
      }

      const cpf = this.cpfInformado(dto.cpf);
      const assinadoEm = new Date(Math.floor(Date.now()));
      const assinador = this.chave.assinador;
      const { carga, assinatura } = assinador.assinar({
        versao: 1,
        tipo: 'assinatura',
        documento: {
          uuid: documento.uuid,
          codigo: documento.codigo,
          hashOriginal: documento.hashOriginal,
        },
        signatario: {
          uuid: signatario.uuid,
          nome: signatario.nome,
          email: signatario.email,
          // Hash do CPF com o uuid como sal: prova qual CPF foi declarado sem expô-lo na carga.
          cpf: cpf ? sha256(`${cpf}:${signatario.uuid}`) : null,
        },
        assinadoEm,
        origem: { ip: origem.ip ?? null },
        verificacoes: [...aprovadas.values()].map((d) => ({
          tipo: d.tipo,
          desafio: d.uuid,
          concluidoEm: d.concluidoEm,
          pontuacao: d.pontuacao,
        })),
        manifestacao: 'Li o documento e concordo com o seu conteúdo.',
        chave: assinador.idDaChave,
      });

      await this.prisma.db.$transaction(async (tx) => {
        const { count } = await tx.signatario.updateMany({
          where: { id: signatario.id, status: { in: ['pendente', 'visualizado'] } },
          data: {
            status: 'assinado',
            assinadoEm,
            ip: origem.ip ?? null,
            userAgent: origem.userAgent ?? null,
            tipoAssinatura: dto.tipo,
            imagemAssinatura: dto.imagem,
            cargaAssinada: carga,
            assinaturaDigital: assinatura,
            ...(cpf
              ? {
                  cpfCifrado: cifrar(cpf, chaveDeCifra(this.env.chaveDeCifra)),
                  cpfFinal: cpf.slice(-2),
                }
              : {}),
          },
        });

        if (count === 0)
          throw new UnprocessableEntityException('Esta assinatura já foi registrada.');

        await this.auditoria.registrar(
          {
            acao: 'assinatura_registrada',
            resumo: `${signatario.nome} assinou o documento (${dto.tipo === 'desenhada' ? 'rubrica desenhada' : 'nome digitado'}).`,
            tipoAtor: 'signatario',
            atorId: signatario.id,
            atorNome: signatario.nome,
            documento: { id: documento.id, uuid: documento.uuid },
            dados: {
              assinatura: sha256(assinatura).slice(0, 16),
              verificacoes: [...aprovadas.keys()],
            },
            origem,
            em: assinadoEm,
          },
          tx,
        );

        await this.notificacoes.criar(
          {
            usuarioId: documento.criadoPorId,
            titulo: 'Nova assinatura',
            mensagem: `${signatario.nome} assinou “${documento.titulo}”.`,
            link: `/app/documentos/${documento.uuid}`,
          },
          tx,
        );
      });

      await this.convidarProximo(documento, signatario);

      return { documentoId: documento.id, organizacaoId: documento.organizacaoId };
    });

    // A conclusão (PDF + selo) não pode desfazer a assinatura já registrada: se
    // falhar aqui, o job periódico conclui depois.
    const concluido = await executarNoContexto(
      { organizacaoId: resultado.organizacaoId },
      async () => {
        try {
          return await this.finalizador.finalizarSePronto(resultado.documentoId);
        } catch (erro) {
          this.logger.error(
            `Falha ao concluir o documento ${resultado.documentoId}; o job tentará de novo.`,
            erro instanceof Error ? erro.stack : String(erro),
          );
          return false;
        }
      },
    );

    return { concluido };
  }

  async recusar(token: string, motivo: string, origem: Origem): Promise<void> {
    await this.comToken(token, async ({ signatario, documento }) => {
      this.exigirPodeAssinar(signatario, documento);

      await this.prisma.db.$transaction(async (tx) => {
        await tx.signatario.update({
          where: { id: signatario.id },
          data: { status: 'recusado', recusadoEm: new Date(), motivoRecusa: motivo },
        });
        await tx.documento.update({ where: { id: documento.id }, data: { status: 'recusado' } });
        await tx.signatario.updateMany({
          where: { documentoId: documento.id, NOT: { id: signatario.id } },
          data: { tokenHash: null },
        });
        await this.auditoria.registrar(
          {
            acao: 'assinatura_recusada',
            resumo: `${signatario.nome} recusou assinar. Motivo: “${motivo}”. O documento foi encerrado.`,
            tipoAtor: 'signatario',
            atorId: signatario.id,
            atorNome: signatario.nome,
            documento: { id: documento.id, uuid: documento.uuid },
            origem,
          },
          tx,
        );
        await this.notificacoes.criar(
          {
            usuarioId: documento.criadoPorId,
            titulo: 'Assinatura recusada',
            mensagem: `${signatario.nome} recusou “${documento.titulo}”.`,
            link: `/app/documentos/${documento.uuid}`,
          },
          tx,
        );
      });

      await this.email.enfileirar(
        modelos.documentoRecusado({
          para: documento.criadoPor.email,
          nome: documento.criadoPor.nome,
          titulo: documento.titulo,
          quem: signatario.nome,
          motivo,
          url: `${this.env.urlDoApp}/app/documentos/${documento.uuid}`,
        }),
      );
    });
  }

  // -------------------------------------------------------------------------

  private montarSessao(signatario: Contexto['signatario'], documento: DocumentoCompleto) {
    const exigidas = VERIFICACOES_DO_NIVEL[documento.nivelVerificacao];
    const aprovadas = this.verificacoesValidas(signatario, documento);
    const prazoVencido = documento.prazo !== null && documento.prazo < new Date();

    return {
      documento: {
        uuid: documento.uuid,
        titulo: documento.titulo,
        mensagem: documento.mensagem,
        codigo: documento.codigo,
        paginas: documento.paginas,
        hashOriginal: documento.hashOriginal,
        status: prazoVencido && documento.status === 'em_andamento' ? 'expirado' : documento.status,
        nivelVerificacao: documento.nivelVerificacao,
        ordemSequencial: documento.ordemSequencial,
        prazo: documento.prazo,
        organizacao: documento.organizacao.nome,
        remetente: documento.criadoPor.nome,
        temPdfAssinado: documento.arquivoAssinado !== null,
      },
      signatario: {
        uuid: signatario.uuid,
        nome: signatario.nome,
        email: signatario.email,
        emailMascarado: mascararEmail(signatario.email),
        status: signatario.status,
        assinadoEm: signatario.assinadoEm,
        cpfInformado: signatario.cpfFinal !== null,
      },
      ehSuaVez:
        documento.status === 'em_andamento' &&
        !prazoVencido &&
        ehAVezDe(signatario, documento.signatarios, documento.ordemSequencial),
      verificacoes: exigidas.map((tipo) => ({ tipo, aprovada: aprovadas.has(tipo) })),
      participantes: documento.signatarios.map((s) => ({
        nome: s.id === signatario.id ? s.nome : abreviarNome(s.nome),
        ordem: s.ordem,
        status: s.status,
        voce: s.id === signatario.id,
      })),
    };
  }

  /** Verificações aprovadas e ainda dentro da validade, por tipo. */
  private verificacoesValidas(
    signatario: Contexto['signatario'],
    documento: Documento,
  ): Map<TipoDeVerificacao, DesafioDeVerificacao> {
    const exigidas = VERIFICACOES_DO_NIVEL[documento.nivelVerificacao];
    const limite = Date.now() - VALIDADE_DA_APROVACAO_MS;
    const validas = new Map<TipoDeVerificacao, DesafioDeVerificacao>();

    for (const tipo of exigidas) {
      const aprovada = signatario.desafios.find(
        (d) =>
          d.tipo === tipo &&
          d.aprovado === true &&
          d.concluidoEm !== null &&
          (signatario.status === 'assinado' || d.concluidoEm.getTime() >= limite),
      );

      if (aprovada !== undefined) validas.set(tipo, aprovada);
    }

    return validas;
  }

  private exigirPodeAssinar(signatario: Signatario, documento: DocumentoCompleto): void {
    if (signatario.status === 'assinado')
      throw new UnprocessableEntityException('Você já assinou este documento.');
    if (signatario.status === 'recusado')
      throw new UnprocessableEntityException('Você recusou este documento.');
    if (documento.status !== 'em_andamento')
      throw new GoneException('Este documento não está mais aceitando assinaturas.');
    if (documento.prazo !== null && documento.prazo < new Date())
      throw new GoneException('O prazo para assinar este documento terminou.');
    if (!ehAVezDe(signatario, documento.signatarios, documento.ordemSequencial)) {
      throw new UnprocessableEntityException(
        'Ainda não é a sua vez: este documento é assinado em ordem.',
      );
    }
  }

  private exigirEtapaLiberada(
    signatario: Contexto['signatario'],
    documento: DocumentoCompleto,
    tipo: TipoDeVerificacao,
  ): void {
    const exigidas = VERIFICACOES_DO_NIVEL[documento.nivelVerificacao];
    const posicao = exigidas.indexOf(tipo);

    if (posicao === -1)
      throw new BadRequestException('Esta verificação não é exigida neste documento.');

    const aprovadas = this.verificacoesValidas(signatario, documento);
    const anteriores = exigidas.slice(0, posicao).filter((anterior) => !aprovadas.has(anterior));

    if (anteriores.length > 0) {
      throw new UnprocessableEntityException(
        `Conclua antes: ${anteriores.map((t) => ROTULO_DA_VERIFICACAO[t]).join(', ')}.`,
      );
    }
  }

  private async enviarCodigo(signatario: Signatario, documento: Documento) {
    const recentes = await this.prisma.db.desafioDeVerificacao.count({
      where: {
        signatarioId: signatario.id,
        tipo: 'codigo_email',
        criadoEm: { gte: new Date(Date.now() - 15 * 60_000) },
      },
    });

    if (recentes >= 5)
      throw new UnprocessableEntityException(
        'Muitos códigos pedidos. Aguarde 15 minutos e tente de novo.',
      );

    const codigo = gerarCodigoNumerico(6);
    const registro = await this.prisma.db.desafioDeVerificacao.create({
      data: comOrganizacaoDoContexto<Prisma.DesafioDeVerificacaoUncheckedCreateInput>({
        signatarioId: signatario.id,
        tipo: 'codigo_email',
        desafio: {},
        expiraEm: new Date(Date.now() + VALIDADE_DO_CODIGO_MS),
      }),
    });

    // ⚠️ O hash usa o uuid do desafio como sal: o mesmo código em dois desafios gera hashes diferentes.
    await this.prisma.db.desafioDeVerificacao.update({
      where: { id: registro.id },
      data: { desafio: { hash: sha256(`${codigo}:${registro.uuid}`) } },
    });
    await this.email.enfileirar(
      modelos.codigoDeVerificacao({
        para: signatario.email,
        nome: signatario.nome,
        codigo,
        titulo: documento.titulo,
      }),
    );

    return {
      desafio: registro.uuid,
      expiraEm: registro.expiraEm,
      enviadoPara: mascararEmail(signatario.email),
    };
  }

  /** O esqueleto comum a toda conclusão de desafio: valida, avalia, grava e audita. */
  private async concluir(
    token: string,
    tipo: TipoDeVerificacao,
    desafioUuid: string,
    origem: Origem,
    avaliar: (desafio: DesafioDeVerificacao) => ResultadoDoDesafio,
    metadados: Record<string, unknown> = {},
  ) {
    return this.comToken(token, async ({ signatario, documento }) => {
      this.exigirPodeAssinar(signatario, documento);

      const desafio = signatario.desafios.find((d) => d.uuid === desafioUuid && d.tipo === tipo);

      if (desafio === undefined)
        throw new NotFoundException('Desafio não encontrado. Comece a verificação de novo.');
      if (desafio.concluidoEm !== null && desafio.aprovado === true)
        return { aprovado: true, pontuacao: desafio.pontuacao ?? 1 };
      if (desafio.expiraEm < new Date())
        throw new GoneException('O desafio expirou. Comece a verificação de novo.');
      if (desafio.tentativas >= TENTATIVAS_POR_DESAFIO)
        throw new UnprocessableEntityException('Tentativas esgotadas. Peça um novo desafio.');

      const resultado = avaliar(desafio);
      const agora = new Date();

      await this.prisma.db.$transaction(async (tx) => {
        await tx.desafioDeVerificacao.update({
          where: { id: desafio.id },
          data: {
            tentativas: { increment: 1 },
            ...(resultado.aprovado
              ? {
                  aprovado: true,
                  concluidoEm: agora,
                  pontuacao: resultado.pontuacao,
                  resultado: metadados as Prisma.InputJsonValue,
                }
              : { aprovado: false, pontuacao: resultado.pontuacao }),
          },
        });
        await this.auditoria.registrar(
          {
            acao: resultado.aprovado ? 'verificacao_aprovada' : 'verificacao_reprovada',
            resumo: `${resultado.aprovado ? 'Aprovada' : 'Reprovada'}: ${ROTULO_DA_VERIFICACAO[tipo]} de ${signatario.nome}${resultado.aprovado ? ` (pontuação ${Math.round(resultado.pontuacao * 100)}%)` : ''}.`,
            tipoAtor: 'signatario',
            atorId: signatario.id,
            atorNome: signatario.nome,
            documento: { id: documento.id, uuid: documento.uuid },
            dados: { tipo, pontuacao: resultado.pontuacao },
            origem,
            em: agora,
          },
          tx,
        );
      });

      if (!resultado.aprovado)
        throw new UnprocessableEntityException(resultado.motivo ?? 'Verificação não aprovada.');

      return { aprovado: true, pontuacao: resultado.pontuacao };
    });
  }

  private cpfInformado(valor: string | undefined): string | null {
    if (valor === undefined || valor.trim().length === 0) return null;

    const cpf = apenasDigitos(valor);

    if (!cpfValido(cpf)) throw new BadRequestException('CPF inválido.');

    return cpf;
  }

  /** Em ordem sequencial, a assinatura de um libera o próximo — que recebe o convite agora. */
  private async convidarProximo(
    documento: DocumentoCompleto,
    quemAssinou: Signatario,
  ): Promise<void> {
    if (!documento.ordemSequencial) return;

    const proximo = documento.signatarios.find((s) => s.ordem === quemAssinou.ordem + 1);

    if (proximo === undefined || proximo.status !== 'pendente') return;

    await this.convites.convidar(proximo, {
      documento,
      organizacao: documento.organizacao.nome,
      remetente: documento.criadoPor.nome,
    });
  }
}

function sortearDesafio(
  tipo: Exclude<TipoDeVerificacao, 'codigo_email'>,
): Record<string, string[]> {
  switch (tipo) {
    case 'voz':
      return { palavras: sortear(PALAVRAS, 3) };
    case 'gestos':
      return { sequencia: sortear(GESTOS, 3) };
    case 'facial':
      return { acoes: sortear(ACOES_DE_VIVACIDADE, 2) };
  }
}
