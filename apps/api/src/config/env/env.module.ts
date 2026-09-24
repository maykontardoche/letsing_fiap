import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validarAmbiente } from './env.schema';
import { EnvService } from './env.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validarAmbiente,
    }),
  ],
  providers: [EnvService],
  exports: [EnvService],
})
export class EnvModule {}
