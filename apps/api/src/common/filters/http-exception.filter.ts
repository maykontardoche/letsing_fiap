import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Envelope único de erro da API. Toda falha sai nesta forma.
 *
 * ⚠️ O contrato é "sempre tem estes cinco", não "só tem estes cinco": campos
 * extras do chamador (ex.: `error: 'MFA_NECESSARIO'`) são preservados, e é
 * assim que o SPA distingue um 403 de "sem permissão" de um 403 de "falta o
 * segundo fator".
 */
export interface ErroResposta {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
  [extra: string]: unknown;
}

/**
 * Traduz qualquer falha para o envelope padrão. Erro inesperado **loga** e nunca
 * vaza detalhe interno (stack, SQL, caminho de arquivo) para o cliente.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const resposta = http.getResponse<Response>();
    const requisicao = http.getRequest<Request>();

    const ehHttp = exception instanceof HttpException;
    const status = ehHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!ehHttp) {
      this.logger.error(
        `Erro não tratado em ${requisicao.method} ${requisicao.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const corpo = ehHttp ? this.corpoDoChamador(exception) : null;
    const { statusCode: _s, message: _m, error: erroProprio, ...extras } = corpo ?? {};

    resposta.status(status).json({
      ...extras,
      statusCode: status,
      message: this.mensagem(exception, corpo),
      error: typeof erroProprio === 'string' ? erroProprio : (HttpStatus[status] ?? 'ERROR'),
      path: requisicao.url,
      timestamp: new Date().toISOString(),
    } satisfies ErroResposta);
  }

  private corpoDoChamador(exception: HttpException): Record<string, unknown> | null {
    const bruto = exception.getResponse();

    return typeof bruto === 'object' && bruto !== null ? (bruto as Record<string, unknown>) : null;
  }

  private mensagem(exception: unknown, corpo: Record<string, unknown> | null): string | string[] {
    if (!(exception instanceof HttpException)) {
      return 'Erro interno do servidor. Tente novamente em instantes.';
    }

    const bruto = exception.getResponse();

    if (typeof bruto === 'string') return bruto;

    const mensagem = corpo?.message;

    if (typeof mensagem === 'string' || Array.isArray(mensagem)) {
      return mensagem as string | string[];
    }

    return exception.message;
  }
}
