import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { EnvService } from '../env/env.service';
import { CENSURA, redigirProfundo } from './redaction';

/**
 * Log JSON estruturado (pino), com duas camadas de redação:
 *
 * 1. `redact.paths` — cabeçalhos de credencial, que têm caminho fixo;
 * 2. `formatters.log` com `redigirProfundo` — por nome de campo, em qualquer
 *    profundidade.
 *
 * ⚠️ Log é diagnóstico; auditoria é outra coisa (`common/auditoria/`). Nunca use o
 * logger para registrar quem fez o quê num documento.
 *
 * Em desenvolvimento a saída é "bonita" (pino-pretty); em produção, JSON puro.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        pinoHttp: {
          level: env.nivelDeLog,
          genReqId: (req: IncomingMessage) =>
            (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
            censor: CENSURA,
          },
          formatters: {
            log: (objeto: Record<string, unknown>) =>
              redigirProfundo(objeto) as Record<string, unknown>,
          },
          // Health é batido sem parar; logar cada batida afoga o log útil.
          autoLogging: {
            ignore: (req: IncomingMessage) => req.url?.startsWith('/api/saude') ?? false,
          },
          transport:
            env.ambiente === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss' } }
              : undefined,
        },
      }),
    }),
  ],
})
export class LoggerModule {}
