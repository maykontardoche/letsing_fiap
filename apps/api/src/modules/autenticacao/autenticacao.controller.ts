import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { EnvService } from '../../config/env/env.service';
import { apagarCookieDeSessao, gravarCookieDeSessao } from '../../common/auth/cookie';
import { DispensaMfa, OrigemDaRequisicao, Publico } from '../../common/auth/decorators';
import type { Origem, RequisicaoAutenticada } from '../../common/auth/requisicao';
import {
  CadastroDto,
  DesafioMfaDto,
  EntrarDto,
  EsqueciSenhaDto,
  RedefinirSenhaDto,
} from './autenticacao.dto';
import { AutenticacaoService } from './autenticacao.service';

/** Rotas de autenticação. Rate limit mais estrito que o global: 10 por minuto por IP. */
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AutenticacaoController {
  constructor(
    private readonly servico: AutenticacaoService,
    private readonly env: EnvService,
  ) {}

  @Publico()
  @Post('cadastro')
  @HttpCode(HttpStatus.CREATED)
  async cadastrar(
    @Body() dto: CadastroDto,
    @OrigemDaRequisicao() origem: Origem,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<{ precisaMfa: boolean }> {
    const { idDaSessao, precisaMfa } = await this.servico.cadastrar(dto, origem);

    gravarCookieDeSessao(resposta, idDaSessao, this.env.cookieSeguro);

    return { precisaMfa };
  }

  @Publico()
  @Post('entrar')
  @HttpCode(HttpStatus.OK)
  async entrar(
    @Body() dto: EntrarDto,
    @OrigemDaRequisicao() origem: Origem,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<{ precisaMfa: boolean }> {
    const { idDaSessao, precisaMfa } = await this.servico.entrar(dto.email, dto.senha, origem);

    gravarCookieDeSessao(resposta, idDaSessao, this.env.cookieSeguro);

    return { precisaMfa };
  }

  @DispensaMfa()
  @Post('mfa')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmarMfa(
    @Body() dto: DesafioMfaDto,
    @Req() requisicao: RequisicaoAutenticada,
    @OrigemDaRequisicao() origem: Origem,
  ): Promise<void> {
    await this.servico.confirmarMfa(
      requisicao.idDaSessao as string,
      requisicao.sessao as NonNullable<RequisicaoAutenticada['sessao']>,
      dto.codigo,
      origem,
    );
  }

  /** Público: sair com sessão já expirada ainda precisa limpar o cookie. */
  @Publico()
  @Post('sair')
  @HttpCode(HttpStatus.NO_CONTENT)
  async sair(
    @Req() requisicao: RequisicaoAutenticada,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<void> {
    if (requisicao.idDaSessao !== undefined) await this.servico.sair(requisicao.idDaSessao);

    apagarCookieDeSessao(resposta, this.env.cookieSeguro);
  }

  @Publico()
  @Post('esqueci-senha')
  @HttpCode(HttpStatus.ACCEPTED)
  async esqueciSenha(@Body() dto: EsqueciSenhaDto): Promise<void> {
    await this.servico.esqueciSenha(dto.email);
  }

  @Publico()
  @Post('redefinir-senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  async redefinirSenha(
    @Body() dto: RedefinirSenhaDto,
    @OrigemDaRequisicao() origem: Origem,
  ): Promise<void> {
    await this.servico.redefinirSenha(dto.token, dto.senha, origem);
  }
}
