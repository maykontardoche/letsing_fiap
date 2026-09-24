import { Injectable, Logger, Module } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../config/database/prisma.service';
import { EnvService } from '../../config/env/env.service';
import { FinalizadorDeDocumentoService } from '../../common/assinaturas/finalizador-de-documento.service';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { executarNoContexto, semEscopoDeOrganizacao } from '../../common/tenancy/tenant-context';

/**
 * Jobs agendados.
 *
 * ⚠️ Rodam **fora** do ciclo HTTP: não há requisição, logo não há contexto de
 * organização. Cada job busca o trabalho sem escopo e **entra no contexto de
 * cada organização por iteração** — é o que mantém o isolamento valendo aqui.
 *
 * ⚠️ Com mais de uma réplica da API, os `@Cron` rodariam em duplicata. As duas
 * tarefas são idempotentes (`updateMany ... WHERE status = 'em_andamento'`), então
 * a duplicata é inofensiva — mas ao escalar, mova-as para um worker único.
 */
@Injectable()
export class TarefasService {
  private readonly logger = new Logger(TarefasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly finalizador: FinalizadorDeDocumentoService,
    private readonly env: EnvService,
  ) {}

  /** Documento em andamento com prazo vencido → expirado. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async expirarPrazosVencidos(): Promise<number> {
    if (this.env.ambiente === 'test') return 0;

    return this.expirar(new Date());
  }

  async expirar(agora: Date): Promise<number> {
    const vencidos = await semEscopoDeOrganizacao(() =>
      this.prisma.db.documento.findMany({ where: { status: 'em_andamento', prazo: { lt: agora } }, select: { id: true, uuid: true, organizacaoId: true } }),
    );

    for (const documento of vencidos) {
      await executarNoContexto({ organizacaoId: documento.organizacaoId }, () =>
        this.prisma.db.$transaction(async (tx) => {
          const { count } = await tx.documento.updateMany({ where: { id: documento.id, status: 'em_andamento' }, data: { status: 'expirado' } });

          if (count === 0) return;

          await tx.signatario.updateMany({ where: { documentoId: documento.id }, data: { tokenHash: null } });
          await this.auditoria.registrar(
            {
              acao: 'documento_expirado',
              resumo: 'O prazo terminou antes de todas as assinaturas. O documento foi encerrado.',
              tipoAtor: 'sistema',
              atorNome: 'LetsSign',
              documento: { id: documento.id, uuid: documento.uuid },
            },
            tx,
          );
        }),
      );
    }

    if (vencidos.length > 0) this.logger.log(`${vencidos.length} documento(s) expirado(s).`);

    return vencidos.length;
  }

  /**
   * Conclui documento que tem todas as assinaturas e ficou sem PDF final — o
   * servidor pode ter caído entre gravar a última assinatura e gerar o PDF.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async concluirPendentes(): Promise<void> {
    if (this.env.ambiente === 'test') return;

    const prontos = await semEscopoDeOrganizacao(() =>
      this.prisma.db.documento.findMany({
        where: { status: 'em_andamento', signatarios: { every: { status: 'assinado' }, some: {} } },
        select: { id: true, organizacaoId: true },
      }),
    );

    for (const documento of prontos) {
      try {
        await executarNoContexto({ organizacaoId: documento.organizacaoId }, () => this.finalizador.finalizarSePronto(documento.id));
      } catch (erro) {
        this.logger.error(`Falha ao concluir o documento ${documento.id}.`, erro instanceof Error ? erro.stack : String(erro));
      }
    }
  }
}

@Module({ providers: [TarefasService], exports: [TarefasService] })
export class TarefasModule {}
