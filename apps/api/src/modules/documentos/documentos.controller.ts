import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ExigePermissao, OrigemDaRequisicao, UsuarioAtual } from '../../common/auth/decorators';
import type { Origem, UsuarioAutenticado } from '../../common/auth/requisicao';
import { enviarPdf } from '../../common/http/resposta-pdf';
import {
  AtualizarDocumentoDto,
  CancelarDocumentoDto,
  CriarDocumentoDto,
  DefinirSignatariosDto,
  ListarDocumentosDto,
} from './documentos.dto';
import { DocumentosService, type ArquivoEnviado } from './documentos.service';

/** Teto duro do upload no multer; o limite configurável é conferido no service. */
const TETO_DO_UPLOAD = 50 * 1024 * 1024;
const UUID = new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND });

@Controller('documentos')
export class DocumentosController {
  constructor(private readonly servico: DocumentosService) {}

  @Get()
  listar(@UsuarioAtual() usuario: UsuarioAutenticado, @Query() filtro: ListarDocumentosDto) {
    return this.servico.listar(usuario, filtro);
  }

  @Post()
  @ExigePermissao('documentos.criar')
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: TETO_DO_UPLOAD, files: 1 } }))
  criar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: CriarDocumentoDto,
    @UploadedFile() arquivo: ArquivoEnviado | undefined,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.criar(usuario, dto, arquivo, origem);
  }

  @Get(':uuid')
  detalhe(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('uuid', UUID) uuid: string) {
    return this.servico.detalhe(usuario, uuid);
  }

  @Patch(':uuid')
  atualizar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('uuid', UUID) uuid: string,
    @Body() dto: AtualizarDocumentoDto,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.atualizar(usuario, uuid, dto, origem);
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  excluir(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('uuid', UUID) uuid: string,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.excluirRascunho(usuario, uuid, origem);
  }

  @Put(':uuid/signatarios')
  definirSignatarios(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('uuid', UUID) uuid: string,
    @Body() dto: DefinirSignatariosDto,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.definirSignatarios(usuario, uuid, dto.signatarios, origem);
  }

  @Post(':uuid/enviar')
  @HttpCode(HttpStatus.OK)
  enviar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('uuid', UUID) uuid: string,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.enviar(usuario, uuid, origem);
  }

  @Post(':uuid/cancelar')
  @HttpCode(HttpStatus.OK)
  cancelar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('uuid', UUID) uuid: string,
    @Body() dto: CancelarDocumentoDto,
    @OrigemDaRequisicao() origem: Origem,
  ) {
    return this.servico.cancelar(usuario, uuid, dto.motivo, origem);
  }

  @Post(':uuid/signatarios/:signatario/reenviar')
  @HttpCode(HttpStatus.OK)
  reenviar(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('uuid', UUID) uuid: string,
    @Param('signatario', UUID) signatario: string,
  ) {
    return this.servico.reenviarConvite(usuario, uuid, signatario);
  }

  @Post(':uuid/assinar-agora')
  @HttpCode(HttpStatus.OK)
  assinarAgora(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('uuid', UUID) uuid: string) {
    return this.servico.assinarAgora(usuario, uuid);
  }

  @Get(':uuid/trilha')
  trilha(@UsuarioAtual() usuario: UsuarioAutenticado, @Param('uuid', UUID) uuid: string) {
    return this.servico.trilha(usuario, uuid);
  }

  /** O PDF, por rota autenticada — nunca por URL pública. */
  @Get(':uuid/arquivo')
  async arquivo(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Param('uuid', UUID) uuid: string,
    @Query('versao') versao: string | undefined,
    @Query('baixar') baixar: string | undefined,
    @Res() resposta: Response,
  ): Promise<void> {
    const { conteudo, nome } = await this.servico.arquivo(
      usuario,
      uuid,
      versao === 'assinado' ? 'assinado' : 'original',
    );

    enviarPdf(resposta, conteudo, nome, baixar === '1');
  }
}
