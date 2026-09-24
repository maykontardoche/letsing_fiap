import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Papel, Usuario } from '@prisma/client';
import { PrismaService } from '../../config/database/prisma.service';
import { EnvService } from '../../config/env/env.service';
import { AuditoriaService } from '../../common/auditoria/auditoria.service';
import { ROTULO_DO_PAPEL } from '../../common/auth/permissoes';
import type { Origem, UsuarioAutenticado } from '../../common/auth/requisicao';
import { SessaoService } from '../../common/auth/sessao.service';
import { gerarToken } from '../../common/cripto/hash';
import { EmailService } from '../../common/email/email.service';
import { modelos } from '../../common/email/modelos';
import { LIMITES_DO_PLANO, ROTULO_DO_PLANO } from '../../common/planos';
import { semEscopoDeOrganizacao } from '../../common/tenancy/tenant-context';

const VALIDADE_DO_CONVITE_MS = 72 * 60 * 60 * 1000;

/**
 * Gestão da equipe da organização.
 *
 * Regras que protegem a organização de si mesma:
 * - ninguém altera o próprio papel nem se desativa (evita se trancar para fora);
 * - só um **proprietário** concede ou retira o papel de proprietário;
 * - a organização nunca fica **sem nenhum proprietário ativo**.
 */
@Injectable()
export class EquipeService {
  // eslint-disable-next-line max-params -- colaboradores injetados pelo Nest
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly sessoes: SessaoService,
    private readonly email: EmailService,
    private readonly env: EnvService,
  ) {}

  async listar() {
    const usuarios = await this.prisma.db.usuario.findMany({ orderBy: [{ ativo: 'desc' }, { nome: 'asc' }] });

    return usuarios.map(apresentar);
  }

  async convidar(quem: UsuarioAutenticado, dados: { nome: string; email: string; papel: Papel }, origem: Origem) {
    if (dados.papel === 'proprietario' && quem.papel !== 'proprietario') {
      throw new ForbiddenException('Só um proprietário pode convidar outro proprietário.');
    }

    const organizacao = await this.prisma.db.organizacao.findUniqueOrThrow({ where: { id: quem.organizacaoId } });
    const limite = LIMITES_DO_PLANO[organizacao.plano].membros;

    if (limite !== null && (await this.prisma.db.usuario.count({ where: { ativo: true } })) >= limite) {
      throw new UnprocessableEntityException(`O plano ${ROTULO_DO_PLANO[organizacao.plano]} permite até ${limite} pessoas na equipe.`);
    }

    // O e-mail é único na plataforma inteira — por isso a busca atravessa organizações.
    const existente = await semEscopoDeOrganizacao(() => this.prisma.db.usuario.findUnique({ where: { email: dados.email }, select: { id: true } }));

    if (existente !== null) throw new ConflictException('Este e-mail já tem uma conta no LetsSign.');

    const { token, hash } = gerarToken();
    const criado = await this.prisma.db.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: { nome: dados.nome, email: dados.email, papel: dados.papel } as { nome: string; email: string; papel: Papel; organizacaoId: number },
      });

      await tx.tokenDeSenha.create({
        data: { usuarioId: usuario.id, tokenHash: hash, finalidade: 'convite', expiraEm: new Date(Date.now() + VALIDADE_DO_CONVITE_MS) },
      });
      await this.auditoria.registrar(
        {
          acao: 'membro_convidado',
          resumo: `${quem.nome} convidou ${usuario.nome} como ${ROTULO_DO_PAPEL[usuario.papel]}.`,
          tipoAtor: 'usuario',
          atorId: quem.id,
          atorNome: quem.nome,
          dados: { membro: usuario.uuid, papel: usuario.papel },
          origem,
        },
        tx,
      );

      return usuario;
    });

    await this.email.enfileirar(
      modelos.conviteParaEquipe({
        para: criado.email,
        nome: criado.nome,
        quem: quem.nome,
        organizacao: organizacao.nome,
        url: `${this.env.urlDoApp}/redefinir-senha?token=${token}&convite=1`,
      }),
    );

    return apresentar(criado);
  }

  async atualizar(quem: UsuarioAutenticado, uuid: string, dados: { papel?: Papel; ativo?: boolean }, origem: Origem) {
    const alvo = await this.prisma.db.usuario.findUnique({ where: { uuid } });

    if (alvo === null) throw new NotFoundException('Membro não encontrado.');
    if (alvo.id === quem.id) throw new BadRequestException('Você não pode alterar o próprio papel nem se desativar.');

    const mexeEmProprietario = alvo.papel === 'proprietario' || dados.papel === 'proprietario';

    if (mexeEmProprietario && quem.papel !== 'proprietario') {
      throw new ForbiddenException('Só um proprietário pode alterar o papel de proprietário.');
    }

    const deixaDeSerProprietarioAtivo =
      alvo.papel === 'proprietario' && alvo.ativo && ((dados.papel !== undefined && dados.papel !== 'proprietario') || dados.ativo === false);

    if (deixaDeSerProprietarioAtivo && (await this.prisma.db.usuario.count({ where: { papel: 'proprietario', ativo: true } })) <= 1) {
      throw new UnprocessableEntityException('A organização precisa de pelo menos um proprietário ativo.');
    }

    const atualizado = await this.prisma.db.usuario.update({ where: { id: alvo.id }, data: { papel: dados.papel, ativo: dados.ativo } });

    if (dados.ativo === false) await this.sessoes.revogarTodasDo(alvo.id);

    await this.auditoria.registrar({
      acao: dados.ativo === false ? 'membro_desativado' : dados.ativo === true ? 'membro_reativado' : 'papel_alterado',
      resumo: descrever(quem, alvo, dados),
      tipoAtor: 'usuario',
      atorId: quem.id,
      atorNome: quem.nome,
      dados: { membro: alvo.uuid, ...dados },
      origem,
    });

    return apresentar(atualizado);
  }

  async reenviarConvite(quem: UsuarioAutenticado, uuid: string): Promise<void> {
    const alvo = await this.prisma.db.usuario.findUnique({ where: { uuid } });

    if (alvo === null) throw new NotFoundException('Membro não encontrado.');
    if (alvo.senhaHash !== null) throw new UnprocessableEntityException('Esta pessoa já aceitou o convite.');

    const organizacao = await this.prisma.db.organizacao.findUniqueOrThrow({ where: { id: quem.organizacaoId } });
    const { token, hash } = gerarToken();

    await this.prisma.db.tokenDeSenha.create({
      data: { usuarioId: alvo.id, tokenHash: hash, finalidade: 'convite', expiraEm: new Date(Date.now() + VALIDADE_DO_CONVITE_MS) },
    });
    await this.email.enfileirar(
      modelos.conviteParaEquipe({
        para: alvo.email,
        nome: alvo.nome,
        quem: quem.nome,
        organizacao: organizacao.nome,
        url: `${this.env.urlDoApp}/redefinir-senha?token=${token}&convite=1`,
      }),
    );
  }
}

function apresentar(usuario: Usuario) {
  return {
    uuid: usuario.uuid,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    ativo: usuario.ativo,
    mfaAtivo: usuario.mfaAtivadoEm !== null,
    convitePendente: usuario.senhaHash === null,
    ultimoAcessoEm: usuario.ultimoAcessoEm,
    criadoEm: usuario.criadoEm,
  };
}

function descrever(quem: UsuarioAutenticado, alvo: Usuario, dados: { papel?: Papel; ativo?: boolean }): string {
  if (dados.ativo === false) return `${quem.nome} desativou ${alvo.nome}; as sessões dele foram encerradas.`;
  if (dados.ativo === true) return `${quem.nome} reativou ${alvo.nome}.`;

  return `${quem.nome} mudou o papel de ${alvo.nome} para ${ROTULO_DO_PAPEL[dados.papel ?? alvo.papel]}.`;
}
