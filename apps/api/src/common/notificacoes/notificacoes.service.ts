import { Injectable } from '@nestjs/common';
import { PrismaService, type TransacaoEscopada } from '../../config/database/prisma.service';

export interface NovaNotificacao {
  readonly usuarioId: number;
  readonly titulo: string;
  readonly mensagem: string;
  readonly link?: string;
  /** Só fora de contexto (fluxo do signatário já entra no contexto, então raramente). */
  readonly organizacaoId?: number;
}

/** Notificações in-app — o sino do cabeçalho. */
@Injectable()
export class NotificacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(nova: NovaNotificacao, tx?: TransacaoEscopada): Promise<void> {
    const cliente = tx ?? this.prisma.db;

    await cliente.notificacao.create({
      data: {
        usuarioId: nova.usuarioId,
        titulo: nova.titulo.slice(0, 160),
        mensagem: nova.mensagem.slice(0, 500),
        link: nova.link ?? null,
        ...(nova.organizacaoId === undefined ? {} : { organizacaoId: nova.organizacaoId }),
      } as { usuarioId: number; titulo: string; mensagem: string; link: string | null; organizacaoId: number },
    });
  }
}
