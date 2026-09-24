import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { createTransport, type Transporter } from 'nodemailer';
import { EnvService } from '../../config/env/env.service';
import type { MensagemDeEmail } from './modelos';

const FILA = 'emails';

/**
 * Envio de e-mail **por fila** (BullMQ sobre Redis).
 *
 * ## Por que fila, e não `sendMail` direto na requisição
 *
 * Um SMTP lento ou fora do ar não pode travar o "enviar para assinatura" — nem
 * perder o convite. A requisição só **enfileira** (milissegundos); o consumidor
 * envia com 5 tentativas e recuo exponencial. Se o SMTP cair por dez minutos, os
 * convites saem quando ele voltar.
 *
 * O consumidor roda no mesmo processo por padrão (`WORKER_EMBUTIDO=true`), o que
 * basta para este volume. Para escalar, sobe-se o worker em processo próprio e
 * desliga-se aqui — sem mudar uma linha de quem enfileira.
 *
 * ## Em teste
 *
 * ⚠️ Os e-mails vão para uma **caixa em memória** (`caixaDeTeste`), não para a
 * fila: o teste de integração lê o código de verificação dali, sem SMTP e sem
 * mandar mensagem para endereço de ninguém.
 */
@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private fila: Queue<MensagemDeEmail> | null = null;
  private consumidor: Worker<MensagemDeEmail> | null = null;
  private transporte: Transporter | null = null;

  /** Só em `NODE_ENV=test`. */
  readonly caixaDeTeste: MensagemDeEmail[] = [];

  constructor(private readonly env: EnvService) {}

  onModuleInit(): void {
    if (this.env.ambiente === 'test') return;

    const conexao = { url: this.env.redisUrl, maxRetriesPerRequest: null };

    this.fila = new Queue<MensagemDeEmail>(FILA, {
      connection: conexao,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 500,
        removeOnFail: 1_000,
      },
    });

    if (this.env.smtpUrl !== undefined) this.transporte = createTransport(this.env.smtpUrl);

    if (this.env.workerEmbutido) {
      this.consumidor = new Worker<MensagemDeEmail>(FILA, (job) => this.entregar(job.data), {
        connection: conexao,
        concurrency: 5,
      });
      this.consumidor.on('failed', (job, erro) =>
        this.logger.error(`Falha ao enviar e-mail "${job?.data.assunto}": ${erro.message}`),
      );
    }
  }

  async enfileirar(mensagem: MensagemDeEmail): Promise<void> {
    if (this.env.ambiente === 'test') {
      this.caixaDeTeste.push(mensagem);
      return;
    }

    await this.fila?.add('enviar', mensagem);
  }

  private async entregar(mensagem: MensagemDeEmail): Promise<void> {
    if (this.transporte === null) {
      // Sem SMTP configurado: registra em vez de falhar. O conteúdo não vai para
      // o log — pode conter código de verificação.
      this.logger.warn(`SMTP não configurado; e-mail "${mensagem.assunto}" não foi enviado.`);
      return;
    }

    await this.transporte.sendMail({
      from: this.env.remetenteDeEmail,
      to: mensagem.para,
      subject: mensagem.assunto,
      html: mensagem.html,
      text: mensagem.texto,
      attachments: mensagem.anexos?.map((anexo) => ({
        filename: anexo.nome,
        content: Buffer.from(anexo.conteudoBase64, 'base64'),
        contentType: anexo.tipo,
      })),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumidor?.close();
    await this.fila?.close();
    this.transporte?.close();
  }
}
