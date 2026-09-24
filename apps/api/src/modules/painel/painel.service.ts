import { Injectable } from '@nestjs/common';
import type { Prisma, StatusDoDocumento } from '@prisma/client';
import { PrismaService } from '../../config/database/prisma.service';
import { ehAVezDe } from '../../common/assinaturas/convites.service';
import { pode } from '../../common/auth/permissoes';
import type { UsuarioAutenticado } from '../../common/auth/requisicao';
import { LIMITES_DO_PLANO, inicioDoMes } from '../../common/planos';

const MESES = 12;

/**
 * O painel inicial: números, série mensal e o que precisa da atenção da pessoa.
 *
 * ⚠️ Respeita a mesma visibilidade da listagem — um membro vê os números dos
 * **seus** documentos, não os da empresa inteira.
 */
@Injectable()
export class PainelService {
  constructor(private readonly prisma: PrismaService) {}

  async resumo(usuario: UsuarioAutenticado) {
    const visiveis: Prisma.DocumentoWhereInput = pode(usuario.papel, 'documentos.ver_todos')
      ? {}
      : { OR: [{ criadoPorId: usuario.id }, { signatarios: { some: { email: usuario.email } } }] };
    const inicioDaSerie = new Date();

    inicioDaSerie.setMonth(inicioDaSerie.getMonth() - (MESES - 1), 1);
    inicioDaSerie.setHours(0, 0, 0, 0);

    const [porStatus, recentes, concluidos90, organizacao, enviadosNoMes, pendentes, verificacoes] =
      await Promise.all([
        this.prisma.db.documento.groupBy({ by: ['status'], where: visiveis, _count: true }),
        this.prisma.db.documento.findMany({
          where: { AND: [visiveis, { enviadoEm: { gte: inicioDaSerie } }] },
          select: { enviadoEm: true, concluidoEm: true },
        }),
        this.prisma.db.documento.findMany({
          where: {
            AND: [
              visiveis,
              { status: 'concluido', concluidoEm: { gte: new Date(Date.now() - 90 * 86_400_000) } },
            ],
          },
          select: { enviadoEm: true, concluidoEm: true },
        }),
        this.prisma.db.organizacao.findUniqueOrThrow({
          where: { id: usuario.organizacaoId },
          select: { plano: true },
        }),
        this.prisma.db.documento.count({ where: { enviadoEm: { gte: inicioDoMes() } } }),
        this.prisma.db.signatario.findMany({
          where: {
            email: usuario.email,
            status: { in: ['pendente', 'visualizado'] },
            documento: { status: 'em_andamento' },
          },
          include: {
            documento: {
              include: {
                criadoPor: { select: { nome: true } },
                signatarios: { select: { ordem: true, status: true } },
              },
            },
          },
          take: 20,
        }),
        this.prisma.db.desafioDeVerificacao.groupBy({
          by: ['tipo'],
          where: { aprovado: true, signatario: { documento: visiveis } },
          _count: true,
        }),
      ]);

    const contagem = Object.fromEntries(porStatus.map((g) => [g.status, g._count])) as Partial<
      Record<StatusDoDocumento, number>
    >;
    const enviados =
      (contagem.em_andamento ?? 0) +
      (contagem.concluido ?? 0) +
      (contagem.recusado ?? 0) +
      (contagem.expirado ?? 0) +
      (contagem.cancelado ?? 0);
    const horas = concluidos90
      .filter((d) => d.enviadoEm !== null && d.concluidoEm !== null)
      .map(
        (d) => ((d.concluidoEm as Date).getTime() - (d.enviadoEm as Date).getTime()) / 3_600_000,
      );

    return {
      indicadores: {
        total: Object.values(contagem).reduce((soma, n) => soma + (n ?? 0), 0),
        rascunhos: contagem.rascunho ?? 0,
        emAndamento: contagem.em_andamento ?? 0,
        concluidos: contagem.concluido ?? 0,
        encerradosSemConclusao:
          (contagem.cancelado ?? 0) + (contagem.recusado ?? 0) + (contagem.expirado ?? 0),
        taxaDeConclusao: enviados === 0 ? null : (contagem.concluido ?? 0) / enviados,
        // `null`, não zero: sem documento concluído não há tempo médio — e "0 h" mentiria.
        tempoMedioDeConclusaoHoras:
          horas.length === 0 ? null : horas.reduce((a, b) => a + b, 0) / horas.length,
      },
      porStatus: contagem,
      serieMensal: montarSerie(recentes, inicioDaSerie),
      verificacoes: Object.fromEntries(verificacoes.map((v) => [v.tipo, v._count])),
      cota: {
        usados: enviadosNoMes,
        limite: LIMITES_DO_PLANO[organizacao.plano].enviosPorMes,
        plano: organizacao.plano,
      },
      aguardandoVoce: pendentes
        .filter((s) => ehAVezDe(s, s.documento.signatarios, s.documento.ordemSequencial))
        .map((s) => ({
          documento: s.documento.uuid,
          titulo: s.documento.titulo,
          remetente: s.documento.criadoPor.nome,
          prazo: s.documento.prazo,
          enviadoEm: s.documento.enviadoEm,
        })),
      atividade: await this.atividade(usuario),
    };
  }

  private async atividade(usuario: UsuarioAutenticado) {
    const podeVerTudo =
      pode(usuario.papel, 'auditoria.ver') || pode(usuario.papel, 'documentos.ver_todos');
    const meus = podeVerTudo
      ? undefined
      : (
          await this.prisma.db.documento.findMany({
            where: { criadoPorId: usuario.id },
            select: { id: true },
          })
        ).map((d) => d.id);

    const eventos = await this.prisma.db.eventoDeAuditoria.findMany({
      where: {
        documentoId: meus === undefined ? { not: null } : { in: meus },
        acao: {
          in: [
            'documento_enviado',
            'assinatura_registrada',
            'documento_concluido',
            'assinatura_recusada',
            'documento_cancelado',
            'documento_visualizado',
          ],
        },
      },
      orderBy: { criadoEm: 'desc' },
      take: 8,
    });
    const documentos = await this.prisma.db.documento.findMany({
      where: { id: { in: [...new Set(eventos.map((e) => e.documentoId as number))] } },
      select: { id: true, uuid: true, titulo: true },
    });
    const porId = new Map(documentos.map((d) => [d.id, d]));

    return eventos.map((e) => ({
      acao: e.acao,
      resumo: e.resumo,
      em: e.criadoEm,
      documento: porId.get(e.documentoId as number)
        ? {
            uuid: porId.get(e.documentoId as number)?.uuid,
            titulo: porId.get(e.documentoId as number)?.titulo,
          }
        : null,
    }));
  }
}

/** Série dos últimos 12 meses (`AAAA-MM`), com enviados e concluídos. Meses sem nada aparecem com zero. */
function montarSerie(
  documentos: readonly { enviadoEm: Date | null; concluidoEm: Date | null }[],
  inicio: Date,
) {
  const chave = (data: Date) =>
    `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
  const meses = new Map<string, { mes: string; enviados: number; concluidos: number }>();

  for (let i = 0; i < MESES; i += 1) {
    const data = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);

    meses.set(chave(data), { mes: chave(data), enviados: 0, concluidos: 0 });
  }

  for (const documento of documentos) {
    if (documento.enviadoEm !== null) {
      const mes = meses.get(chave(documento.enviadoEm));

      if (mes) mes.enviados += 1;
    }

    if (documento.concluidoEm !== null) {
      const mes = meses.get(chave(documento.concluidoEm));

      if (mes) mes.concluidos += 1;
    }
  }

  return [...meses.values()];
}
