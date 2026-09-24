import { Body, Controller, Get, HttpCode, HttpStatus, Module, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Papel } from '@prisma/client';
import { ExigePermissao, OrigemDaRequisicao, UsuarioAtual } from '../../common/auth/decorators';
import type { Origem, UsuarioAutenticado } from '../../common/auth/requisicao';
import { EquipeService } from './equipe.service';

export class ConvidarMembroDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120, { message: 'O nome deve ter entre 2 e 120 caracteres.' })
  nome!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(180)
  email!: string;

  @IsEnum(Papel, { message: 'Papel inválido.' })
  papel!: Papel;
}

export class AtualizarMembroDto {
  @IsOptional()
  @IsEnum(Papel, { message: 'Papel inválido.' })
  papel?: Papel;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

const UUID = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND });

@Controller('equipe')
export class EquipeController {
  constructor(private readonly servico: EquipeService) {}

  @Get()
  @ExigePermissao('equipe.ver', 'equipe.gerenciar')
  listar() {
    return this.servico.listar();
  }

  @Post()
  @ExigePermissao('equipe.gerenciar')
  convidar(@UsuarioAtual() usuario: UsuarioAutenticado, @Body() dto: ConvidarMembroDto, @OrigemDaRequisicao() origem: Origem) {
    return this.servico.convidar(usuario, dto, origem);
  }

  @Patch(':uuid')
  @ExigePermissao('equipe.gerenciar')
  atualizar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('uuid', UUID) uuid: string,
    @Body() dto: AtualizarMembroDto,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.atualizar(usuario, uuid, dto, origem);
  }

  @Post(':uuid/reenviar-convite')
  @ExigePermissao('equipe.gerenciar')
  @HttpCode(HttpStatus.NO_CONTENT)
  reenviar(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('uuid', UUID) uuid: string) {
    return this.servico.reenviarConvite(usuario, uuid);
  }
}

@Module({
  controllers: [EquipeController],
  providers: [EquipeService],
})
export class EquipeModule {}
