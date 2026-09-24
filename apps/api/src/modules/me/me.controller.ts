import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { OrigemDaRequisicao, UsuarioAtual } from '../../common/auth/decorators';
import type { Origem, RequisicaoAutenticada, UsuarioAutenticado } from '../../common/auth/requisicao';
import type { DadosDaSessao } from '../../common/auth/sessao.service';
import { AtualizarPerfilDto, CodigoMfaDto, DesativarMfaDto, TrocarSenhaDto } from './me.dto';
import { MeService } from './me.service';

/** Tudo que é "da própria pessoa logada". Não exige permissão além da sessão. */
@Controller('me')
export class MeController {
  constructor(private readonly servico: MeService) {}

  @Get()
  perfil(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servico.perfil(usuario);
  }

  @Patch()
  @HttpCode(HttpStatus.NO_CONTENT)
  atualizar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: AtualizarPerfilDto,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.atualizarNome(usuario, dto.nome, origem);
  }

  @Post('senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  trocarSenha(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: TrocarSenhaDto,
    @Req() requisicao: RequisicaoAutenticada,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.trocarSenha(
      usuario,
      { ...dto, idDaSessao: requisicao.idDaSessao as string },
      origem,
    );
  }

  @Post('mfa/iniciar')
  iniciarMfa(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: RequisicaoAutenticada) {
    return this.servico.iniciarMfa(usuario, requisicao.idDaSessao as string, requisicao.sessao as DadosDaSessao);
  }

  @Post('mfa/confirmar')
  confirmarMfa(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: CodigoMfaDto,
    @Req() requisicao: RequisicaoAutenticada,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.confirmarMfa(
      usuario,
      { codigo: dto.codigo, idDaSessao: requisicao.idDaSessao as string, sessao: requisicao.sessao as DadosDaSessao },
      origem,
    );
  }

  @Post('mfa/desativar')
  @HttpCode(HttpStatus.NO_CONTENT)
  desativarMfa(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: DesativarMfaDto,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.desativarMfa(usuario, dto.senha, origem);
  }

  @Get('sessoes')
  sessoes(@UsuarioAtual() usuario: UsuarioAutenticado, @Req() requisicao: RequisicaoAutenticada) {
    return this.servico.sessoesAtivas(usuario, requisicao.idDaSessao as string);
  }

  @Delete('sessoes/:uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  revogarSessao(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('uuid', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) uuid: string,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.revogarSessao(usuario, uuid, origem);
  }

  @Get('notificacoes')
  notificacoes(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servico.notificacoes(usuario);
  }

  @Post('notificacoes/lidas')
  @HttpCode(HttpStatus.NO_CONTENT)
  marcarLidas(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servico.marcarNotificacoesLidas(usuario);
  }
}
