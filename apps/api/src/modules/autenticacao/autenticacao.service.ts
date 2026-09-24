import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Usuario } from '@prisma/client';
import { PrismaService } from '../../config/database/prisma.service';
import { EnvService } from '../../config/env/env.service';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import {
  LimiteDeTentativasService,
  REGRA_DE_LOGIN,
  REGRA_DE_MFA,
} from '../../common/auth/limite-de-tentativas.service';
import { MfaService } from '../../common/auth/mfa.service';
import type { Origem } from '../../common/auth/requisicao';
import { SessaoService, type DadosDaSessao } from '../../common/auth/sessao.service';
import { gerarToken, sha256 } from '../../common/cripto/hash';
import { conferirSenha, gerarHashDeSenha, problemasDaSenha } from '../../common/cripto/senha';
import { EmailService } from '../../common/email/email.service';
import { modelos } from '../../common/email/modelos';
import { executarNoContexto, semEscopoDeOrganizacao } from '../../common/tenancy/tenant-context';
import type { CadastroDto } from './autenticacao.dto';

/**
 * ⚠️ Mensagem ambígua de propósito: "e-mail ou senha" não conta a quem sonda se
 * a conta existe. Enumerar e-mails cadastrados é o primeiro passo de um ataque
 * de credenciais vazadas.
 */
const CREDENCIAIS_INVALIDAS = 'E-mail ou senha inválidos.';

/**
 * Hash de uma senha que ninguém tem. Conferir contra ele quando o e-mail não
 * existe gasta o mesmo tempo que conferir uma senha real — sem isso, a resposta
 * rápida para e-mail inexistente denunciaria quais existem (ataque de tempo).
 */
let hashFantasma: Promise<string> | null = null;

const VALIDADE_DA_REDEFINICAO_MS = 60 * 60 * 1000;

export interface ResultadoDoLogin {
  readonly idDaSessao: string;
  readonly precisaMfa: boolean;
}

@Injectable()
export class AutenticacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessoes: SessaoService,
    private readonly limite: LimiteDeTentativasService,
    private readonly mfa: MfaService,
    private readonly auditoria: AuditoriaService,
    private readonly email: EmailService,
    private readonly env: EnvService,
  ) {}

  /** Cria a organização e o proprietário dela, e já abre a sessão. */
  async cadastrar(dto: CadastroDto, origem: Origem): Promise<ResultadoDoLogin> {
    this.exigirSenhaForte(dto.senha);

    const existente = await semEscopoDeOrganizacao(() =>
      this.prisma.db.usuario.findUnique({ where: { email: dto.email }, select: { id: true } }),
    );

    if (existente !== null) {
      throw new ConflictException(
        'Já existe uma conta com este e-mail. Entre ou redefina a senha.',
      );
    }

    const senhaHash = await gerarHashDeSenha(dto.senha);

    const usuario = await this.prisma.db.$transaction(async (tx) => {
      const organizacao = await tx.organizacao.create({
        data: {
          nome: dto.nomeOrganizacao,
          slug: slugUnico(dto.nomeOrganizacao),
          plano: dto.plano ?? 'basico',
        },
      });

      const criado = await tx.usuario.create({
        data: {
          organizacaoId: organizacao.id,
          nome: dto.nome,
          email: dto.email,
          senhaHash,
          papel: 'proprietario',
        },
      });

      await this.auditoria.registrar(
        {
          acao: 'organizacao_criada',
          resumo: `${criado.nome} criou a organização ${organizacao.nome}.`,
          tipoAtor: 'usuario',
          atorId: criado.id,
          atorNome: criado.nome,
          organizacaoId: organizacao.id,
          dados: { plano: organizacao.plano },
          origem,
        },
        tx,
      );

      return criado;
    });

    return this.abrirSessao(usuario, origem);
  }

  async entrar(email: string, senha: string, origem: Origem): Promise<ResultadoDoLogin> {
    const chave = `login:${email}:${origem.ip ?? '?'}`;

    await this.limite.verificar(chave, REGRA_DE_LOGIN);

    // Sem escopo: o login é justamente o que descobre a organização.
    const usuario = await semEscopoDeOrganizacao(() =>
      this.prisma.db.usuario.findUnique({ where: { email } }),
    );

    hashFantasma ??= gerarHashDeSenha(randomBytes(16).toString('hex'));

    const confere = await conferirSenha(senha, usuario?.senhaHash ?? (await hashFantasma));

    if (usuario === null || usuario.senhaHash === null || !confere || !usuario.ativo) {
      await this.limite.registrarFalha(chave, REGRA_DE_LOGIN);

      if (usuario !== null) {
        await this.auditoria.registrar({
          acao: 'login_falhou',
          resumo: `Tentativa de login sem sucesso para ${usuario.email}.`,
          tipoAtor: 'sistema',
          organizacaoId: usuario.organizacaoId,
          origem,
        });
      }

      throw new UnauthorizedException(CREDENCIAIS_INVALIDAS);
    }

    await this.limite.limpar(chave);

    return this.abrirSessao(usuario, origem);
  }

  /** O segundo fator: código TOTP de 6 dígitos ou código de recuperação (uso único). */
  async confirmarMfa(
    idDaSessao: string,
    sessao: DadosDaSessao,
    codigo: string,
    origem: Origem,
  ): Promise<void> {
    const chave = `mfa:${sha256(idDaSessao)}`;

    await this.limite.verificar(chave, REGRA_DE_MFA);

    await executarNoContexto({ organizacaoId: sessao.organizacaoId }, async () => {
      const usuario = await this.prisma.db.usuario.findUniqueOrThrow({
        where: { id: sessao.usuarioId },
      });

      if (usuario.mfaSegredo === null)
        throw new BadRequestException('O MFA não está ativo nesta conta.');

      const ehRecuperacao = codigo.includes('-');
      let aceito = false;

      if (ehRecuperacao && usuario.mfaCodigos !== null) {
        const resultado = this.mfa.consumirCodigo(codigo, usuario.mfaCodigos);

        aceito = resultado.aceito;

        if (aceito) {
          await this.prisma.db.usuario.update({
            where: { id: usuario.id },
            data: { mfaCodigos: resultado.restantes },
          });
        }
      } else {
        aceito = this.mfa.conferir(codigo, usuario.mfaSegredo);
      }

      if (!aceito) {
        await this.limite.registrarFalha(chave, REGRA_DE_MFA);
        throw new UnauthorizedException('Código inválido ou expirado.');
      }

      await this.limite.limpar(chave);
      await this.sessoes.atualizar(idDaSessao, { ...sessao, mfaPendente: false });
      await this.registrarAcesso(
        usuario,
        origem,
        ehRecuperacao ? 'código de recuperação' : 'app autenticador',
      );
    });
  }

  async sair(idDaSessao: string): Promise<void> {
    await this.sessoes.revogar(idDaSessao);
  }

  /**
   * Pede a redefinição. ⚠️ Responde igual exista ou não o e-mail — a resposta
   * não pode virar oráculo de "quais e-mails têm conta aqui".
   */
  async esqueciSenha(email: string): Promise<void> {
    const usuario = await semEscopoDeOrganizacao(() =>
      this.prisma.db.usuario.findUnique({ where: { email } }),
    );

    if (usuario === null || !usuario.ativo) return;

    const { token, hash } = gerarToken();

    await this.prisma.db.tokenDeSenha.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: hash,
        finalidade: 'redefinicao',
        expiraEm: new Date(Date.now() + VALIDADE_DA_REDEFINICAO_MS),
      },
    });

    await this.email.enfileirar(
      modelos.redefinirSenha({
        para: usuario.email,
        nome: usuario.nome,
        url: `${this.env.urlDoApp}/redefinir-senha?token=${token}`,
      }),
    );
  }

  /** Usa o token (convite ou redefinição), grava a senha e derruba as sessões antigas. */
  async redefinirSenha(token: string, senha: string, origem: Origem): Promise<void> {
    this.exigirSenhaForte(senha);

    const registro = await this.prisma.db.tokenDeSenha.findUnique({
      where: { tokenHash: sha256(token) },
      include: { usuario: true },
    });

    if (
      registro === null ||
      registro.usadoEm !== null ||
      registro.expiraEm < new Date() ||
      !registro.usuario.ativo
    ) {
      throw new UnprocessableEntityException('Este link expirou ou já foi usado. Peça um novo.');
    }

    const senhaHash = await gerarHashDeSenha(senha);
    const usuario = registro.usuario;

    await executarNoContexto({ organizacaoId: usuario.organizacaoId }, async () => {
      await this.prisma.db.$transaction(async (tx) => {
        await tx.tokenDeSenha.update({ where: { id: registro.id }, data: { usadoEm: new Date() } });
        await tx.usuario.update({ where: { id: usuario.id }, data: { senhaHash } });
        await this.auditoria.registrar(
          {
            acao: registro.finalidade === 'convite' ? 'convite_aceito' : 'senha_redefinida',
            resumo:
              registro.finalidade === 'convite'
                ? `${usuario.nome} aceitou o convite e definiu a senha.`
                : `${usuario.nome} redefiniu a senha pelo link enviado por e-mail.`,
            tipoAtor: 'usuario',
            atorId: usuario.id,
            atorNome: usuario.nome,
            origem,
          },
          tx,
        );
      });

      // Senha nova derruba toda sessão antiga: se a redefinição foi porque a
      // conta estava comprometida, quem a comprometeu sai agora.
      await this.sessoes.revogarTodasDo(usuario.id);
    });
  }

  private async abrirSessao(usuario: Usuario, origem: Origem): Promise<ResultadoDoLogin> {
    const precisaMfa = usuario.mfaAtivadoEm !== null;
    const idDaSessao = await this.sessoes.criar(
      { usuarioId: usuario.id, organizacaoId: usuario.organizacaoId, mfaPendente: precisaMfa },
      origem,
    );

    if (!precisaMfa) {
      await executarNoContexto({ organizacaoId: usuario.organizacaoId }, () =>
        this.registrarAcesso(usuario, origem, 'senha'),
      );
    }

    return { idDaSessao, precisaMfa };
  }

  private async registrarAcesso(usuario: Usuario, origem: Origem, metodo: string): Promise<void> {
    await this.prisma.db.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcessoEm: new Date() },
    });
    await this.auditoria.registrar({
      acao: 'login',
      resumo: `${usuario.nome} entrou na plataforma (${metodo}).`,
      tipoAtor: 'usuario',
      atorId: usuario.id,
      atorNome: usuario.nome,
      origem,
    });
  }

  private exigirSenhaForte(senha: string): void {
    const problemas = problemasDaSenha(senha);

    if (problemas.length > 0) {
      throw new BadRequestException(`A senha precisa ${problemas.join(', ')}.`);
    }
  }
}

function slugUnico(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);

  return `${base || 'organizacao'}-${randomBytes(3).toString('hex')}`;
}
