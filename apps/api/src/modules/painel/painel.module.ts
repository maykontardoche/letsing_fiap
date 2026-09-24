import { Controller, Get, Module } from '@nestjs/common';
import { UsuarioAtual } from '../../common/auth/decorators';
import type { UsuarioAutenticado } from '../../common/auth/requisicao';
import { PainelService } from './painel.service';

@Controller('painel')
export class PainelController {
  constructor(private readonly servico: PainelService) {}

  @Get()
  resumo(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.servico.resumo(usuario);
  }
}

@Module({
  controllers: [PainelController],
  providers: [PainelService],
})
export class PainelModule {}
