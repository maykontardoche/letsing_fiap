import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CHAVE_PERMISSOES, CHAVE_PUBLICO, CHAVE_SEM_MFA } from './decorators';
import { pode, type Permissao } from './permissoes';
import type { RequisicaoAutenticada } from './requisicao';

export const MENSAGEM_SEM_PERMISSAO = 'Você não tem permissão para esta ação.';

/**
 * Exige sessão por padrão, cobra o segundo fator e confere a permissão da rota.
 *
 * ## Fechado por padrão
 *
 * ⚠️ Toda rota exige sessão, **exceto** as marcadas com `@Publico()`. O inverso —
 * proteger rota a rota — faz de "esqueci de proteger" uma rota aberta em
 * produção, que é a falha que ninguém percebe. Aqui, esquecer produz 401.
 *
 * ## O que este guard NÃO faz
 *
 * ⚠️ Não aplica isolamento de organização — isso é da extensão do Prisma, que não
 * consulta papel nenhum. Autorização e isolamento são perguntas diferentes.
 */
@Injectable()
export class AutorizacaoGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const alvos = [contexto.getHandler(), contexto.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICO, alvos) === true) return true;

    const requisicao = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();
    const usuario = requisicao.usuario;

    if (usuario === undefined) throw new UnauthorizedException('Sessão ausente ou expirada.');

    const dispensaMfa = this.reflector.getAllAndOverride<boolean>(CHAVE_SEM_MFA, alvos) === true;

    /*
     * ⚠️ 403 com código próprio, não 401: 401 faria o SPA achar que a sessão
     * caiu e mandaria a pessoa ao login — ela entraria de novo e cairia aqui, num
     * laço. `MFA_NECESSARIO` diz "você está autenticado, falta um passo".
     */
    if (!dispensaMfa && requisicao.sessao?.mfaPendente === true) {
      throw new ForbiddenException({
        message: 'Confirme o código do seu app autenticador para continuar.',
        error: 'MFA_NECESSARIO',
      });
    }

    const exigidas = this.reflector.getAllAndOverride<Permissao[] | undefined>(CHAVE_PERMISSOES, alvos);

    if (exigidas !== undefined && exigidas.length > 0 && !exigidas.some((p) => pode(usuario.papel, p))) {
      throw new ForbiddenException(MENSAGEM_SEM_PERMISSAO);
    }

    return true;
  }
}
