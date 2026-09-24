import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/database/prisma.service';
import { ROTULO_DA_VERIFICACAO } from '../../common/assinaturas/status-do-documento';
import { AuditoriaService, cadeiaDoDocumento } from '../../common/auditoria/auditoria.service';
import { ChaveDaPlataformaService } from '../../common/cripto/chave-da-plataforma.service';
import { ehSha256, sha256 } from '../../common/cripto/hash';
import { executarNoContexto, semEscopoDeOrganizacao } from '../../common/tenancy/tenant-context';
import { mascararCpf, mascararEmail } from '../../common/texto/mascaras';

/** Ações da trilha que aparecem na linha do tempo pública (o resto é interno). */
const ACOES_PUBLICAS = new Set([
  'documento_criado',
  'documento_enviado',
  'convite_enviado',
  'documento_visualizado',
  'verificacao_aprovada',
  'assinatura_registrada',
  'assinatura_recusada',
  'documento_cancelado',
  'documento_expirado',
  'documento_concluido',
]);

const NAO_ENCONTRADO = 'Nenhum documento com este código. Confira as letras e números impressos no rodapé do PDF.';

/**
 * A validação pública — o que qualquer pessoa, **sem conta**, pode conferir.
 *
 * ## O que é verificado aqui, e não apenas exibido
 *
 * 1. **Cada assinatura Ed25519** é verificada de novo, agora, contra a chave
 *    pública — e a carga assinada precisa conter o hash do original registrado.
 * 2. **O selo de conclusão** é verificado e precisa cobrir o hash do PDF final.
 * 3. **A trilha de auditoria** é recalculada elo a elo.
 *
 * Um "válido" aqui é resultado de conta feita na hora, não de uma flag no banco.
 *
 * ## O que NÃO sai daqui
 *
 * ⚠️ O PDF em si. Quem tem o código confere a autenticidade e vê quem assinou —
 * mas o conteúdo de um contrato é de quem o assinou. E-mail e CPF aparecem
 * mascarados. Rascunho não existe para a validação pública.
 */
@Injectable()
export class ValidacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chave: ChaveDaPlataformaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async porCodigo(codigoBruto: string) {
    const codigo = normalizarCodigo(codigoBruto);

    // Sem escopo: a validação é pública — qualquer organização, sem sessão.
    const documento = await semEscopoDeOrganizacao(() =>
      this.prisma.db.documento.findUnique({
        where: { codigo },
        include: {
          organizacao: { select: { nome: true } },
          criadoPor: { select: { nome: true } },
          signatarios: { orderBy: { ordem: 'asc' }, include: { desafios: { where: { aprovado: true } } } },
        },
      }),
    );

    if (documento === null || documento.status === 'rascunho') throw new NotFoundException(NAO_ENCONTRADO);

    const assinador = this.chave.assinador;

    return executarNoContexto({ organizacaoId: documento.organizacaoId }, async () => {
      const cadeia = cadeiaDoDocumento(documento.uuid);
      const [integridade, eventos] = await Promise.all([
        this.auditoria.verificar(cadeia),
        this.prisma.db.eventoDeAuditoria.findMany({ where: { cadeia }, orderBy: { sequencia: 'asc' } }),
      ]);

      const seloValido =
        documento.selo !== null &&
        documento.cargaDoSelo !== null &&
        assinador.verificar(documento.cargaDoSelo, documento.selo) &&
        (JSON.parse(documento.cargaDoSelo) as { hashAssinado?: string }).hashAssinado === documento.hashAssinado;

      return {
        documento: {
          titulo: documento.titulo,
          codigo: documento.codigo,
          status: documento.status,
          organizacao: documento.organizacao.nome,
          remetente: documento.criadoPor.nome,
          paginas: documento.paginas,
          nivelVerificacao: documento.nivelVerificacao,
          hashOriginal: documento.hashOriginal,
          hashAssinado: documento.hashAssinado,
          enviadoEm: documento.enviadoEm,
          concluidoEm: documento.concluidoEm,
          canceladoEm: documento.canceladoEm,
        },
        selo: {
          presente: documento.selo !== null,
          valido: seloValido,
          algoritmo: 'Ed25519',
          idDaChave: assinador.idDaChave,
        },
        trilha: { ...integridade },
        signatarios: documento.signatarios.map((s) => {
          const valida =
            s.cargaAssinada !== null &&
            s.assinaturaDigital !== null &&
            assinador.verificar(s.cargaAssinada, s.assinaturaDigital) &&
            (JSON.parse(s.cargaAssinada) as { documento?: { hashOriginal?: string } }).documento?.hashOriginal === documento.hashOriginal;

          return {
            nome: s.nome,
            emailMascarado: mascararEmail(s.email),
            cpfMascarado: mascararCpf(s.cpfFinal),
            ordem: s.ordem,
            status: s.status,
            assinadoEm: s.assinadoEm,
            recusadoEm: s.recusadoEm,
            tipoAssinatura: s.tipoAssinatura,
            verificacoes: s.desafios.map((d) => ({ tipo: d.tipo, rotulo: ROTULO_DA_VERIFICACAO[d.tipo], pontuacao: d.pontuacao, em: d.concluidoEm })),
            assinaturaDigital: s.assinaturaDigital === null ? null : { valida, id: sha256(s.assinaturaDigital).slice(0, 16) },
          };
        }),
        linhaDoTempo: eventos
          .filter((e) => ACOES_PUBLICAS.has(e.acao))
          .map((e) => ({ acao: e.acao, resumo: e.resumo, em: e.criadoEm, tipoAtor: e.tipoAtor, hash: e.hash })),
      };
    });
  }

  /**
   * Busca pelo hash do arquivo: a pessoa arrasta o PDF, o navegador calcula o
   * SHA-256 e manda só o hash. O arquivo nunca sai da máquina dela.
   */
  async porHash(hash: string) {
    const normalizado = hash.trim().toLowerCase();

    if (!ehSha256(normalizado)) throw new BadRequestException('Hash SHA-256 inválido.');

    const documento = await semEscopoDeOrganizacao(() =>
      this.prisma.db.documento.findFirst({
        where: { OR: [{ hashAssinado: normalizado }, { hashOriginal: normalizado }], NOT: { status: 'rascunho' } },
        select: { codigo: true, hashAssinado: true },
      }),
    );

    if (documento === null) {
      throw new NotFoundException(
        'Este arquivo não corresponde a nenhum documento assinado no LetsSign. Se ele deveria corresponder, pode ter sido alterado.',
      );
    }

    return { codigo: documento.codigo, versao: documento.hashAssinado === normalizado ? 'assinado' : 'original' };
  }

  chavePublica() {
    const assinador = this.chave.assinador;

    return { algoritmo: 'Ed25519', id: assinador.idDaChave, pem: assinador.chavePublicaPem };
  }
}

function normalizarCodigo(bruto: string): string {
  const limpo = bruto.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const semPrefixo = limpo.startsWith('LS') ? limpo.slice(2) : limpo;

  if (semPrefixo.length !== 8) throw new NotFoundException(NAO_ENCONTRADO);

  return `LS-${semPrefixo.slice(0, 4)}-${semPrefixo.slice(4)}`;
}
