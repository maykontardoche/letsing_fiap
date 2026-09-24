import { Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Publico } from '../../common/auth/decorators';
import { ValidacaoService } from './validacao.service';

/** Validação pública de autenticidade. Sem sessão, com rate limit por IP. */
@Publico()
@Controller('publico')
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class ValidacaoController {
  constructor(private readonly servico: ValidacaoService) {}

  @Get('validar/hash/:hash')
  porHash(@Param('hash') hash: string) {
    return this.servico.porHash(hash);
  }

  @Get('validar/:codigo')
  porCodigo(@Param('codigo') codigo: string) {
    return this.servico.porCodigo(codigo);
  }

  /** A chave pública Ed25519 — para quem quiser verificar as assinaturas sem o LetsSign. */
  @Get('chave')
  chave() {
    return this.servico.chavePublica();
  }
}
