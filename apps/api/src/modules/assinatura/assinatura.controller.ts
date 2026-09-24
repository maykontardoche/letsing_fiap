import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { OrigemDaRequisicao, Publico } from '../../common/auth/decorators';
import type { Origem } from '../../common/auth/requisicao';
import { enviarPdf } from '../../common/http/resposta-pdf';
import {
  AssinarDto,
  ConcluirCodigoDto,
  ConcluirFacialDto,
  ConcluirGestosDto,
  ConcluirVozDto,
  RecusarDto,
} from './assinatura.dto';
import { AssinaturaService } from './assinatura.service';

/**
 * O fluxo público de assinatura. **Sem sessão**: quem autentica é o token do link.
 *
 * ⚠️ Rate limit por IP mais estrito que o global — o token tem 256 bits e não é
 * adivinhável, mas não há por que deixar alguém tentar.
 */
@Publico()
@Controller('assinatura/:token')
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class AssinaturaController {
  constructor(private readonly servico: AssinaturaService) {}

  @Get()
  sessao(@Param('token') token: string, @OrigemDaRequisicao() origem: Origem) {
    return this.servico.sessao(token, origem);
  }

  @Get('arquivo')
  async arquivo(
    @Param('token') token: string,
    @Query('versao') versao: string | undefined,
    @Query('baixar') baixar: string | undefined,
    @Res() resposta: Response,
  ): Promise<void> {
    const { conteudo, nome } = await this.servico.arquivo(
      token,
      versao === 'assinado' ? 'assinado' : 'original',
    );

    enviarPdf(resposta, conteudo, nome, baixar === '1');
  }

  @Post('verificacoes/codigo_email/iniciar')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  iniciarCodigo(@Param('token') token: string) {
    return this.servico.iniciarVerificacao(token, 'codigo_email');
  }

  @Post('verificacoes/facial/iniciar')
  iniciarFacial(@Param('token') token: string) {
    return this.servico.iniciarVerificacao(token, 'facial');
  }

  @Post('verificacoes/voz/iniciar')
  iniciarVoz(@Param('token') token: string) {
    return this.servico.iniciarVerificacao(token, 'voz');
  }

  @Post('verificacoes/gestos/iniciar')
  iniciarGestos(@Param('token') token: string) {
    return this.servico.iniciarVerificacao(token, 'gestos');
  }

  @Post('verificacoes/codigo_email/concluir')
  @HttpCode(HttpStatus.OK)
  concluirCodigo(
    @Param('token') token: string,
    @Body() dto: ConcluirCodigoDto,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.concluirCodigo(token, dto, origem);
  }

  @Post('verificacoes/facial/concluir')
  @HttpCode(HttpStatus.OK)
  concluirFacial(
    @Param('token') token: string,
    @Body() dto: ConcluirFacialDto,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.concluirFacial(token, dto, origem);
  }

  @Post('verificacoes/voz/concluir')
  @HttpCode(HttpStatus.OK)
  concluirVoz(
    @Param('token') token: string,
    @Body() dto: ConcluirVozDto,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.concluirVoz(token, dto, origem);
  }

  @Post('verificacoes/gestos/concluir')
  @HttpCode(HttpStatus.OK)
  concluirGestos(
    @Param('token') token: string,
    @Body() dto: ConcluirGestosDto,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.concluirGestos(token, dto, origem);
  }

  @Post('assinar')
  @HttpCode(HttpStatus.OK)
  assinar(
    @Param('token') token: string,
    @Body() dto: AssinarDto,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.assinar(token, dto, origem);
  }

  @Post('recusar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async recusar(
    @Param('token') token: string,
    @Body() dto: RecusarDto,
    @OrigemDaRequisicao() origem: Origem,
  ): Promise<void> {
    await this.servico.recusar(token, dto.motivo, origem);
  }
}
