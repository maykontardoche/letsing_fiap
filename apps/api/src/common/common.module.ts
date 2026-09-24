import { Global, Module } from '@nestjs/common';
import { ArmazenamentoService } from './armazenamento/armazenamento.service';
import { AuditoriaService } from './auditoria/auditoria.service';
import { LimiteDeTentativasService } from './auth/limite-de-tentativas.service';
import { MfaService } from './auth/mfa.service';
import { SessaoService } from './auth/sessao.service';
import { ChaveDaPlataformaService } from './cripto/chave-da-plataforma.service';
import { EmailService } from './email/email.service';
import { FinalizadorDeDocumentoService } from './assinaturas/finalizador-de-documento.service';
import { NotificacoesService } from './notificacoes/notificacoes.service';
import { ConvitesService } from './assinaturas/convites.service';

const SERVICOS = [
  ArmazenamentoService,
  AuditoriaService,
  LimiteDeTentativasService,
  MfaService,
  SessaoService,
  ChaveDaPlataformaService,
  EmailService,
  FinalizadorDeDocumentoService,
  NotificacoesService,
  ConvitesService,
];

/**
 * O que mais de um módulo de negócio precisa. ⚠️ Módulo não importa de módulo
 * irmão — o que dois compartilham sobe para cá. A regra é do ESLint.
 */
@Global()
@Module({
  providers: SERVICOS,
  exports: SERVICOS,
})
export class CommonModule {}
