import { Injectable } from '@nestjs/common';
import type { Documento, Signatario } from '@prisma/client';
import { PrismaService, type TransacaoEscopada } from '../../config/database/prisma.service';
import { EnvService } from '../../config/env/env.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { gerarToken } from '../cripto/hash';
import { EmailService } from '../email/email.service';
import { modelos } from '../email/modelos';

/** Sem prazo definido, o link vale 30 dias. */
const VALIDADE_PADRAO_MS = 30 * 24 * 60 * 60 * 1000;

export interface ContextoDoConvite {
  readonly documento: Documento;
  readonly organizacao: string;
  readonly remetente: string;
}

/**
 * Emite o link de assinatura de um signatário e o envia por e-mail.
 *
 * ⚠️ O token é **rotacionado** a cada emissão: reenviar o convite invalida o link
 * anterior. Se um link vazou (e-mail encaminhado por engano), reenviar é o jeito
 * de fechá-lo. Só o hash vai para o banco.
 *
 * Compartilhado por Documentos (envio, reenvio, "assinar agora") e por Assinatura
 * (convite do próximo da fila em ordem sequencial) — por isso mora em `common/`.
 */
@Injectable()
export class ConvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly email: EmailService,
    private readonly env: EnvService,
  ) {}

  /** Gera um token novo, grava o hash e devolve o link. Não envia nada. */
  async emitirLink(
    signatario: Signatario,
    documento: Documento,
    tx?: TransacaoEscopada,
  ): Promise<string> {
    const { token, hash } = gerarToken();
    const cliente = tx ?? this.prisma.db;

    await cliente.signatario.update({
      where: { id: signatario.id },
      data: {
        tokenHash: hash,
        tokenExpiraEm: documento.prazo ?? new Date(Date.now() + VALIDADE_PADRAO_MS),
      },
    });

    return `${this.env.urlDoApp}/assinar/${token}`;
  }

  /** Emite o link, registra na trilha e envia o e-mail de convite. */
  async convidar(
    signatario: Signatario,
    contexto: ContextoDoConvite,
    opcoes: { readonly reenvio?: boolean; readonly tx?: TransacaoEscopada } = {},
  ): Promise<string> {
    const link = await this.emitirLink(signatario, contexto.documento, opcoes.tx);

    await this.auditoria.registrar(
      {
        acao: opcoes.reenvio ? 'convite_reenviado' : 'convite_enviado',
        resumo: `${opcoes.reenvio ? 'Convite reenviado' : 'Convite de assinatura enviado'} para ${signatario.nome}.`,
        tipoAtor: 'sistema',
        atorNome: 'LetsSign',
        documento: { id: contexto.documento.id, uuid: contexto.documento.uuid },
        dados: { signatario: signatario.uuid, ordem: signatario.ordem },
      },
      opcoes.tx,
    );

    await this.email.enfileirar(
      modelos.conviteParaAssinar({
        para: signatario.email,
        nome: signatario.nome,
        remetente: contexto.remetente,
        organizacao: contexto.organizacao,
        titulo: contexto.documento.titulo,
        mensagem: contexto.documento.mensagem,
        url: link,
        prazo: contexto.documento.prazo
          ? contexto.documento.prazo.toLocaleString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
              dateStyle: 'long',
              timeStyle: 'short',
            })
          : null,
      }),
    );

    return link;
  }
}

/**
 * Se é a vez deste signatário.
 *
 * - Em paralelo: sempre, enquanto ele não assinou nem recusou.
 * - Em ordem: só quando todos os anteriores já assinaram.
 */
export function ehAVezDe(
  signatario: Pick<Signatario, 'ordem' | 'status'>,
  todos: readonly Pick<Signatario, 'ordem' | 'status'>[],
  sequencial: boolean,
): boolean {
  if (signatario.status === 'assinado' || signatario.status === 'recusado') return false;

  if (!sequencial) return true;

  return todos
    .filter((outro) => outro.ordem < signatario.ordem)
    .every((outro) => outro.status === 'assinado');
}
