import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './config/database/prisma.module';
import { EnvModule } from './config/env/env.module';
import { EnvService } from './config/env/env.service';
import { LoggerModule } from './config/logger/logger.module';
import { RedisModule } from './config/redis/redis.module';
import { AutorizacaoGuard } from './common/auth/autorizacao.guard';
import { OrigemMiddleware } from './common/auth/origem.middleware';
import { SessaoMiddleware } from './common/auth/sessao.middleware';
import { CommonModule } from './common/common.module';
import { SaudeController } from './saude/saude.controller';
import { AssinaturaModule } from './modules/assinatura/assinatura.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { AutenticacaoModule } from './modules/autenticacao/autenticacao.module';
import { DocumentosModule } from './modules/documentos/documentos.module';
import { EquipeModule } from './modules/equipe/equipe.module';
import { MeModule } from './modules/me/me.module';
import { OrganizacaoModule } from './modules/organizacao/organizacao.module';
import { PainelModule } from './modules/painel/painel.module';
import { TarefasModule } from './modules/tarefas/tarefas.module';
import { ValidacaoModule } from './modules/validacao/validacao.module';

@Module({
  imports: [
    EnvModule,
    LoggerModule,
    PrismaModule,
    RedisModule,
    CommonModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) => [
        { ttl: env.throttleTtlSegundos * 1000, limit: env.throttleLimite },
      ],
    }),
    AutenticacaoModule,
    MeModule,
    DocumentosModule,
    AssinaturaModule,
    ValidacaoModule,
    PainelModule,
    EquipeModule,
    AuditoriaModule,
    OrganizacaoModule,
    TarefasModule,
  ],
  controllers: [SaudeController],
  providers: [
    // ⚠️ A ordem importa: o rate limit barra o abuso ANTES de qualquer trabalho de autorização.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AutorizacaoGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumidor: MiddlewareConsumer): void {
    // Origem primeiro (CSRF), depois a sessão — que abre o contexto de organização.
    consumidor.apply(OrigemMiddleware, SessaoMiddleware).forRoutes('*');
  }
}
