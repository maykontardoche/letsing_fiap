import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { EnvService } from './config/env/env.service';
import { configurarApp } from './configurar-app';

async function iniciar(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const env = app.get(EnvService);

  app.useLogger(app.get(Logger));
  configurarApp(app, env);

  await app.listen(env.porta);
  app.get(Logger).log(`API do LetsSign em http://localhost:${env.porta}/api`);
}

void iniciar();
