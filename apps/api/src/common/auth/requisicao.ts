import type { Papel } from '@prisma/client';
import type { Request } from 'express';
import type { DadosDaSessao } from './sessao.service';

/** O que o middleware de sessão resolve sobre quem está falando. */
export interface UsuarioAutenticado {
  readonly id: number;
  readonly uuid: string;
  readonly organizacaoId: number;
  readonly nome: string;
  readonly email: string;
  readonly papel: Papel;
  readonly mfaAtivo: boolean;
}

export interface RequisicaoAutenticada extends Request {
  usuario?: UsuarioAutenticado;
  sessao?: DadosDaSessao;
  idDaSessao?: string;
}

/** Origem da requisição, para a trilha de auditoria. */
export interface Origem {
  readonly ip?: string;
  readonly userAgent?: string;
}

export function origemDa(requisicao: Request): Origem {
  return {
    ip: normalizarIp(requisicao.ip),
    userAgent: requisicao.get('user-agent')?.slice(0, 500),
  };
}

/** `::ffff:10.0.0.1` (IPv4 mapeado em IPv6) → `10.0.0.1`; `::1` → `127.0.0.1`. */
export function normalizarIp(ip: string | undefined): string | undefined {
  if (ip === undefined) return undefined;
  if (ip === '::1') return '127.0.0.1';

  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}
