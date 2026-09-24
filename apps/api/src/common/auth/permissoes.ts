import type { Papel } from '@prisma/client';

/**
 * O catálogo de permissões. Granular por ação, agrupado por área.
 *
 * ⚠️ A permissão é o que o **código** verifica; o papel é só um pacote de
 * permissões. Guard nunca pergunta "é administrador?" — pergunta "pode
 * `equipe.gerenciar`?". Assim, mudar o que um papel faz é mudar esta tabela, e
 * nenhum `if` espalhado pelo código precisa ser caçado.
 */
export const PERMISSOES = [
  'documentos.criar',
  /** Ver todos os documentos da organização, não só os próprios. */
  'documentos.ver_todos',
  /** Cancelar, reenviar e gerar link em documento de outra pessoa. */
  'documentos.gerenciar_todos',
  'equipe.ver',
  'equipe.gerenciar',
  'auditoria.ver',
  'organizacao.gerenciar',
] as const;

export type Permissao = (typeof PERMISSOES)[number];

/**
 * O que cada papel pode.
 *
 * - **proprietário**: tudo. É quem criou a organização.
 * - **administrador**: tudo menos mexer na organização (nome, plano).
 * - **membro**: cria e acompanha os **próprios** documentos.
 * - **auditor**: só leitura, de tudo — o papel de quem fiscaliza.
 */
export const PERMISSOES_DO_PAPEL: Readonly<Record<Papel, readonly Permissao[]>> = {
  proprietario: PERMISSOES,
  administrador: PERMISSOES.filter((permissao) => permissao !== 'organizacao.gerenciar'),
  membro: ['documentos.criar'],
  auditor: ['documentos.ver_todos', 'equipe.ver', 'auditoria.ver'],
};

export function permissoesDo(papel: Papel): readonly Permissao[] {
  return PERMISSOES_DO_PAPEL[papel];
}

export function pode(papel: Papel, permissao: Permissao): boolean {
  return PERMISSOES_DO_PAPEL[papel].includes(permissao);
}

export const ROTULO_DO_PAPEL: Readonly<Record<Papel, string>> = {
  proprietario: 'Proprietário',
  administrador: 'Administrador',
  membro: 'Membro',
  auditor: 'Auditor',
};
