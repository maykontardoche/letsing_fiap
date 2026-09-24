import { Body, Controller, Get, Injectable, Module, Patch } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { Plano } from '@prisma/client';
import { PrismaService } from '../../config/database/prisma.service';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { ExigePermissao, OrigemDaRequisicao, UsuarioAtual } from '../../common/auth/decorators';
import type { Origem, UsuarioAutenticado } from '../../common/auth/requisicao';
import { LIMITES_DO_PLANO, ROTULO_DO_PLANO, inicioDoMes } from '../../common/planos';

export class AtualizarOrganizacaoDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120, { message: 'O nome deve ter entre 2 e 120 caracteres.' })
  nome?: string;

  /** ⚠️ Projeto acadêmico: a troca de plano é simulada, sem cobrança. */
  @IsOptional()
  @IsEnum(Plano, { message: 'Plano inválido.' })
  plano?: Plano;
}

@Injectable()
export class OrganizacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async detalhe(organizacaoId: number) {
    const [organizacao, enviados, membros] = await Promise.all([
      this.prisma.db.organizacao.findUniqueOrThrow({ where: { id: organizacaoId } }),
      this.prisma.db.documento.count({ where: { enviadoEm: { gte: inicioDoMes() } } }),
      this.prisma.db.usuario.count({ where: { ativo: true } }),
    ]);
    const limites = LIMITES_DO_PLANO[organizacao.plano];

    return {
      uuid: organizacao.uuid,
      nome: organizacao.nome,
      plano: organizacao.plano,
      criadoEm: organizacao.criadoEm,
      uso: { enviadosNoMes: enviados, limiteDeEnvios: limites.enviosPorMes, membros, limiteDeMembros: limites.membros },
    };
  }

  async atualizar(usuario: UsuarioAutenticado, dto: AtualizarOrganizacaoDto, origem: Origem) {
    const antes = await this.prisma.db.organizacao.findUniqueOrThrow({ where: { id: usuario.organizacaoId } });

    await this.prisma.db.organizacao.update({ where: { id: usuario.organizacaoId }, data: { nome: dto.nome, plano: dto.plano } });

    const mudancas = [
      dto.nome && dto.nome !== antes.nome ? `nome para “${dto.nome}”` : null,
      dto.plano && dto.plano !== antes.plano ? `plano de ${ROTULO_DO_PLANO[antes.plano]} para ${ROTULO_DO_PLANO[dto.plano]}` : null,
    ].filter(Boolean);

    if (mudancas.length > 0) {
      await this.auditoria.registrar({
        acao: 'organizacao_atualizada',
        resumo: `${usuario.nome} alterou ${mudancas.join(' e ')}.`,
        tipoAtor: 'usuario',
        atorId: usuario.id,
        atorNome: usuario.nome,
        dados: { ...dto },
        origem,
      });
    }

    return this.detalhe(usuario.organizacaoId);
  }
}

@Controller('organizacao')
export class OrganizacaoController {
  constructor(private readonly servico: OrganizacaoService) {}

  @Get()
  detalhe(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servico.detalhe(usuario.organizacaoId);
  }

  @Patch()
  @ExigePermissao('organizacao.gerenciar')
  atualizar(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dto: AtualizarOrganizacaoDto, @OrigemDaRequisicao() origem: Origem) {
    return this.servico.atualizar(usuario, dto, origem);
  }
}

@Module({
  controllers: [OrganizacaoController],
  providers: [OrganizacaoService],
})
export class OrganizacaoModule {}
