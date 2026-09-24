import { Module } from '@nestjs/common';
import { ValidacaoController } from './validacao.controller';
import { ValidacaoService } from './validacao.service';

@Module({
  controllers: [ValidacaoController],
  providers: [ValidacaoService],
})
export class ValidacaoModule {}
