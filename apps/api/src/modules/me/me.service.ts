import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { MfaService } from '../../common/auth/mfa.service';
import { permissoesDo } from '../../common/auth/permissoes';
import type { Origem, UsuarioAutenticado } from '../../common/auth/requisicao';
import { SessaoService, type DadosDaSessao } from '../../common/auth/sessao.service';
import { sha256 } from '../../common/cripto/hash';
import { conferirSenha, gerarHashDeSenha, problemasDaSenha } from '../../common/cripto/senha';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessoes: SessaoService,
    private readonly mfa: MfaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async perfil(usuario: UsuarioAutenticado) {
    const organizacao = await this.prisma.db.organizacao.findUniqueOrThrow({
      where: { id: usuario.organizacaoId },
      select: { uuid: true, nome: true, plano: true },
    });

    return {
      uuid: usuario.uuid,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      // ⚠️ Calculadas aqui, a partir do papel: o SPA as usa só para decidir o que
      // MOSTRAR. Quem autoriza é o guard, em toda requisição.
      permissoes: permissoesDo(usuario.papel),
      mfaAtivo: usuario.mfaAtivo,
      organizacao,
    };
  }

  async atualizarNome(usuario: UsuarioAutenticado, nome: string, origem: Origem): Promise<void> {
    await this.prisma.db.usuario.update({ where: { id: usuario.id }, data: { nome } });
    await this.auditoria.registrar({
      acao: 'perfil_atualizado',
      resumo: `${usuario.nome} alterou o próprio nome para ${nome}.`,
      tipoAtor: 'usuario',
      atorId: usuario.id,
      atorNome: nome,
      origem,
    });
  }

  async trocarSenha(
    usuario: UsuarioAutenticado,
    dados: { senhaAtual: string; novaSenha: string; idDaSessao: string },
    origem: Origem,
  ): Promise<void> {
    const registro = await this.prisma.db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });

    if (
      registro.senhaHash === null ||
      !(await conferirSenha(dados.senhaAtual, registro.senhaHash))
    ) {
      throw new UnauthorizedException('A senha atual não confere.');
    }

    const problemas = problemasDaSenha(dados.novaSenha);

    if (problemas.length > 0)
      throw new BadRequestException(`A senha precisa ${problemas.join(', ')}.`);

    await this.prisma.db.usuario.update({
      where: { id: usuario.id },
      data: { senhaHash: await gerarHashDeSenha(dados.novaSenha) },
    });

    // Derruba as OUTRAS sessões: se a troca foi por suspeita, o invasor sai agora.
    await this.sessoes.revogarTodasDo(usuario.id, sha256(dados.idDaSessao));
    await this.auditoria.registrar({
      acao: 'senha_alterada',
      resumo: `${usuario.nome} alterou a senha; as demais sessões foram encerradas.`,
      tipoAtor: 'usuario',
      atorId: usuario.id,
      atorNome: usuario.nome,
      origem,
    });
  }

  /** Gera o segredo e guarda **na sessão** até a confirmação. */
  async iniciarMfa(usuario: UsuarioAutenticado, idDaSessao: string, sessao: DadosDaSessao) {
    if (usuario.mfaAtivo) throw new BadRequestException('O MFA já está ativo nesta conta.');

    const gerado = await this.mfa.gerarSegredo(usuario.email);

    await this.sessoes.atualizar(idDaSessao, { ...sessao, segredoMfaPendente: gerado.segredo });

    return { qrCode: gerado.qrCode, segredo: gerado.segredo };
  }

  /** Confere o primeiro código, grava o segredo cifrado e devolve os códigos de recuperação — uma única vez. */
  async confirmarMfa(
    usuario: UsuarioAutenticado,
    dados: { codigo: string; idDaSessao: string; sessao: DadosDaSessao },
    origem: Origem,
  ): Promise<{ codigosDeRecuperacao: string[] }> {
    const segredo = dados.sessao.segredoMfaPendente;

    if (segredo === undefined)
      throw new BadRequestException('Comece a configuração do MFA de novo.');

    if (!this.mfa.conferirComSegredo(dados.codigo, segredo)) {
      throw new BadRequestException(
        'Código incorreto. Confira o relógio do celular e tente o código atual.',
      );
    }

    const codigos = this.mfa.gerarCodigosDeRecuperacao();

    await this.prisma.db.usuario.update({
      where: { id: usuario.id },
      data: {
        mfaSegredo: this.mfa.cifrarSegredo(segredo),
        mfaCodigos: this.mfa.cifrarCodigos(codigos),
        mfaAtivadoEm: new Date(),
      },
    });

    const { segredoMfaPendente: _removido, ...resto } = dados.sessao;

    await this.sessoes.atualizar(dados.idDaSessao, { ...resto, mfaPendente: false });
    await this.auditoria.registrar({
      acao: 'mfa_ativado',
      resumo: `${usuario.nome} ativou a verificação em duas etapas.`,
      tipoAtor: 'usuario',
      atorId: usuario.id,
      atorNome: usuario.nome,
      origem,
    });

    return { codigosDeRecuperacao: codigos };
  }

  async desativarMfa(usuario: UsuarioAutenticado, senha: string, origem: Origem): Promise<void> {
    const registro = await this.prisma.db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });

    if (registro.senhaHash === null || !(await conferirSenha(senha, registro.senhaHash))) {
      throw new UnauthorizedException('Senha incorreta.');
    }

    await this.prisma.db.usuario.update({
      where: { id: usuario.id },
      data: { mfaSegredo: null, mfaCodigos: null, mfaAtivadoEm: null },
    });
    await this.auditoria.registrar({
      acao: 'mfa_desativado',
      resumo: `${usuario.nome} desativou a verificação em duas etapas.`,
      tipoAtor: 'usuario',
      atorId: usuario.id,
      atorNome: usuario.nome,
      origem,
    });
  }

  async sessoesAtivas(usuario: UsuarioAutenticado, idDaSessao: string) {
    const atual = sha256(idDaSessao);
    const sessoes = await this.prisma.db.sessao.findMany({
      where: {
        usuarioId: usuario.id,
        revogadaEm: null,
        ultimaAtividadeEm: { gte: new Date(Date.now() - 8 * 3600_000) },
      },
      orderBy: { ultimaAtividadeEm: 'desc' },
      take: 20,
    });

    return sessoes.map((sessao) => ({
      uuid: sessao.uuid,
      ip: sessao.ip,
      userAgent: sessao.userAgent,
      criadaEm: sessao.criadaEm,
      ultimaAtividadeEm: sessao.ultimaAtividadeEm,
      atual: sessao.sessaoHash === atual,
    }));
  }

  async revogarSessao(usuario: UsuarioAutenticado, uuid: string, origem: Origem): Promise<void> {
    const sessao = await this.prisma.db.sessao.findFirst({
      where: { uuid, usuarioId: usuario.id },
    });

    if (sessao === null) throw new NotFoundException('Sessão não encontrada.');

    await this.sessoes.revogarPorHash(sessao.sessaoHash);
    await this.auditoria.registrar({
      acao: 'sessao_revogada',
      resumo: `${usuario.nome} encerrou uma sessão aberta em ${sessao.ip ?? 'IP desconhecido'}.`,
      tipoAtor: 'usuario',
      atorId: usuario.id,
      atorNome: usuario.nome,
      origem,
    });
  }

  async notificacoes(usuario: UsuarioAutenticado) {
    const [itens, naoLidas] = await Promise.all([
      this.prisma.db.notificacao.findMany({
        where: { usuarioId: usuario.id },
        orderBy: { criadaEm: 'desc' },
        take: 20,
      }),
      this.prisma.db.notificacao.count({ where: { usuarioId: usuario.id, lidaEm: null } }),
    ]);

    return {
      naoLidas,
      itens: itens.map((n) => ({
        id: n.id,
        titulo: n.titulo,
        mensagem: n.mensagem,
        link: n.link,
        lida: n.lidaEm !== null,
        criadaEm: n.criadaEm,
      })),
    };
  }

  async marcarNotificacoesLidas(usuario: UsuarioAutenticado): Promise<void> {
    await this.prisma.db.notificacao.updateMany({
      where: { usuarioId: usuario.id, lidaEm: null },
      data: { lidaEm: new Date() },
    });
  }
}
