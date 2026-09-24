import { Module } from '@nestjs/common';
import { AssinaturaController } from './assinatura.controller';
import { AssinaturaService } from './assinatura.service';

@Module({
  controllers: [AssinaturaController],
  providers: [AssinaturaService],
})
export class AssinaturaModule {}
