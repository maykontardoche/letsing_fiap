import { ForbiddenException, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { EnvService } from '../../config/env/env.service';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Proteção contra **CSRF** por checagem de origem.
 *
 * A sessão viaja num cookie, e o navegador manda cookie sozinho — é o que torna
 * CSRF possível: um site malicioso faz o navegador da vítima disparar um POST
 * para cá, com a sessão dela.
 *
 * Duas camadas:
 * 1. o cookie é `SameSite=Lax`, e navegadores modernos não o mandam em POST
 *    cross-site;
 * 2. **esta**: toda mutação com cabeçalho `Origin` fora da lista do CORS é
 *    recusada. Cobre navegador antigo e subdomínio irmão comprometido.
 *
 * ⚠️ Requisição **sem** `Origin` passa: não vem de navegador (curl, testes,
 * integração servidor-a-servidor), e sem navegador não há cookie de vítima para
 * sequestrar.
 */
@Injectable()
export class OrigemMiddleware implements NestMiddleware {
  constructor(private readonly env: EnvService) {}

  use(requisicao: Request, _resposta: Response, proximo: NextFunction): void {
    const origem = requisicao.get('origin');

    if (METODOS_SEGUROS.has(requisicao.method) || origem === undefined) return proximo();

    if (!this.env.origensPermitidas.includes(origem)) {
      throw new ForbiddenException('Origem da requisição não permitida.');
    }

    proximo();
  }
}
