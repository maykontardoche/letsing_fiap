import {
  BadRequestException,
  ValidationPipe,
  type INestApplication,
  type ValidationError,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { EnvService } from './config/env/env.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

const UM_ANO_EM_SEGUNDOS = 31_536_000;

/**
 * A borda de segurança e os padrões globais.
 *
 * ⚠️ É **compartilhada entre o `main.ts` e os testes de integração** — uma fonte
 * de verdade só. Sem isso o teste sobe uma aplicação configurada de um jeito e a
 * produção roda de outro, e o teste deixa de provar o que diz provar.
 *
 * - **helmet** com CSP sem `unsafe-inline`/`unsafe-eval` e HSTS;
 * - **CORS estrito**: só as origens do ambiente, com credenciais (cookie);
 * - **ValidationPipe** com `whitelist` + `forbidNonWhitelisted`: campo não
 *   declarado no DTO é **rejeitado**, não ignorado. É o que impede um cliente de
 *   injetar `organizacaoId`, `status` ou `papel` num payload e o servidor aceitar
 *   calado (mass assignment);
 * - **filtro global** de erro, com envelope único;
 * - prefixo `/api`.
 */
export function configurarApp(app: INestApplication, env: EnvService): void {
  const express = app as NestExpressApplication;

  // Atrás de um proxy reverso (nginx, load balancer) o IP real vem no
  // X-Forwarded-For. `loopback` confia só no proxy local.
  express.set('trust proxy', 'loopback');
  express.disable('x-powered-by');

  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'none'"],
          'frame-ancestors': ["'self'", ...env.origensPermitidas],
          'form-action': ["'self'"],
          'base-uri': ["'none'"],
        },
      },
      // O PDF é exibido no SPA (outra origem em dev) via react-pdf.
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: { maxAge: UM_ANO_EM_SEGUNDOS, includeSubDomains: true, preload: true },
    }),
  );

  app.enableCors({
    origin: env.origensPermitidas,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: (erros) => new BadRequestException(mensagensDeValidacao(erros)),
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
}

/**
 * Achata os erros do class-validator (inclusive os aninhados) numa lista de
 * mensagens em português. As mensagens padrão da biblioteca saem em inglês —
 * "property x should not exist" — e chegariam assim até a tela.
 */
export function mensagensDeValidacao(erros: ValidationError[], prefixo = ''): string[] {
  return erros.flatMap((erro) => {
    const campo = `${prefixo}${erro.property}`;
    const proprias = Object.entries(erro.constraints ?? {}).map(([regra, mensagem]) =>
      regra === 'whitelistValidation'
        ? `O campo "${campo}" não é permitido.`
        : traduzir(mensagem, campo),
    );

    return [...proprias, ...mensagensDeValidacao(erro.children ?? [], `${campo}.`)];
  });
}

function traduzir(mensagem: string, campo: string): string {
  // Mensagens já escritas em português nos DTOs passam direto.
  if (!/\b(must|should)\b/.test(mensagem)) return mensagem;

  return `O campo "${campo}" é inválido.`;
}
