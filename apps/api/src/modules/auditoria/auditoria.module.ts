import { Controller, Get, Injectable, Module, Query, Res } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { TipoDeAtor, type Prisma } from '@prisma/client';
import type { Response } from 'express';
import { PrismaService } from '../../config/database/prisma.service';
import { verificarCadeia } from '../../common/auditoria/cadeia';
import { ExigePermissao } from '../../common/auth/decorators';

const inteiro = ({ value }: { value: unknown }) => (value === undefined || value === '' ? undefined : Number(value));

export class FiltroDeAuditoriaDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  acao?: string;

  @IsOptional()
  @IsEnum(TipoDeAtor)
  tipoAtor?: TipoDeAtor;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Transform(inteiro)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Transform(inteiro)
  @IsInt()
  @Min(1)
  @Max(100)
  por?: number;
}

/**
 * A trilha de auditoria da organização inteira — só leitura, para quem tem
 * `auditoria.ver`. Não há rota de escrita, edição ou exclusão, e não haverá.
 */
@Injectable()
export class ConsultaDeAuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(filtro: FiltroDeAuditoriaDto) {
    const pagina = filtro.pagina ?? 1;
    const porPagina = filtro.por ?? 25;
    const onde: Prisma.EventoDeAuditoriaWhereInput = {
      ...(filtro.acao ? { acao: filtro.acao } : {}),
      ...(filtro.tipoAtor ? { tipoAtor: filtro.tipoAtor } : {}),
      ...(filtro.q ? { resumo: { contains: filtro.q, mode: 'insensitive' } } : {}),
    };

    const [eventos, total, acoes] = await Promise.all([
      this.prisma.db.eventoDeAuditoria.findMany({ where: onde, orderBy: { criadoEm: 'desc' }, skip: (pagina - 1) * porPagina, take: porPagina }),
      this.prisma.db.eventoDeAuditoria.count({ where: onde }),
      this.prisma.db.eventoDeAuditoria.groupBy({ by: ['acao'], _count: true, orderBy: { acao: 'asc' } }),
    ]);
    const documentos = await this.prisma.db.documento.findMany({
      where: { id: { in: eventos.map((e) => e.documentoId).filter((id): id is number => id !== null) } },
      select: { id: true, uuid: true, titulo: true },
    });
    const porId = new Map(documentos.map((d) => [d.id, d]));

    return {
      total,
      pagina,
      porPagina,
      acoes: acoes.map((a) => ({ acao: a.acao, total: a._count })),
      itens: eventos.map((e) => ({
        id: e.id,
        cadeia: e.cadeia,
        sequencia: e.sequencia,
        acao: e.acao,
        resumo: e.resumo,
        tipoAtor: e.tipoAtor,
        atorNome: e.atorNome,
        ip: e.ip,
        userAgent: e.userAgent,
        criadoEm: e.criadoEm,
        hash: e.hash,
        hashAnterior: e.hashAnterior,
        documento: e.documentoId !== null && porId.has(e.documentoId) ? { uuid: porId.get(e.documentoId)?.uuid, titulo: porId.get(e.documentoId)?.titulo } : null,
      })),
    };
  }

  /** Recalcula TODAS as cadeias da organização. É o "exame de integridade" completo. */
  async integridade() {
    const eventos = await this.prisma.db.eventoDeAuditoria.findMany({ orderBy: [{ cadeia: 'asc' }, { sequencia: 'asc' }] });
    const porCadeia = new Map<string, typeof eventos>();

    for (const evento of eventos) porCadeia.set(evento.cadeia, [...(porCadeia.get(evento.cadeia) ?? []), evento]);

    const quebradas = [...porCadeia.entries()]
      .map(([cadeia, lista]) => ({ cadeia, ...verificarCadeia(lista) }))
      .filter((resultado) => !resultado.integra)
      .map(({ cadeia, quebraEm, motivo }) => ({ cadeia, quebraEm, motivo }));

    return {
      verificadoEm: new Date(),
      cadeias: porCadeia.size,
      eventos: eventos.length,
      integra: quebradas.length === 0,
      quebradas,
    };
  }

  /** CSV para quem fiscaliza fora do sistema (planilha, auditoria externa). */
  async csv(): Promise<string> {
    const eventos = await this.prisma.db.eventoDeAuditoria.findMany({ orderBy: { criadoEm: 'asc' }, take: 50_000 });
    const celula = (valor: unknown) => {
      const texto = valor === null || valor === undefined ? '' : String(valor instanceof Date ? valor.toISOString() : valor);

      // ⚠️ Prefixo em fórmula (=, +, -, @) é neutralizado: CSV aberto no Excel executaria (CSV injection).
      return `"${(/^[=+\-@]/.test(texto) ? `'${texto}` : texto).replace(/"/g, '""')}"`;
    };
    const linhas = eventos.map((e) =>
      [e.criadoEm, e.cadeia, e.sequencia, e.acao, e.tipoAtor, e.atorNome, e.resumo, e.ip, e.hashAnterior, e.hash].map(celula).join(';'),
    );

    return ['﻿data;cadeia;sequencia;acao;tipo_ator;ator;resumo;ip;hash_anterior;hash', ...linhas].join('\r\n');
  }
}

@Controller('auditoria')
@ExigePermissao('auditoria.ver')
export class AuditoriaController {
  constructor(private readonly servico: ConsultaDeAuditoriaService) {}

  @Get()
  listar(@Query() filtro: FiltroDeAuditoriaDto) {
    return this.servico.listar(filtro);
  }

  @Get('integridade')
  integridade() {
    return this.servico.integridade();
  }

  @Get('exportar')
  async exportar(@Res() resposta: Response): Promise<void> {
    resposta.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="auditoria-letssign-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    });
    resposta.send(await this.servico.csv());
  }
}

@Module({
  controllers: [AuditoriaController],
  providers: [ConsultaDeAuditoriaService],
})
export class AuditoriaModule {}
