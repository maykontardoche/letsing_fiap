import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { apiDeSessao, type Perfil } from '@/lib/api/sessao';
import { ErroDaApi } from '@/lib/erros';
import { ContextoDaSessao, type EstadoDaSessao } from './sessao-contexto';

/**
 * O estado de sessão do SPA, lido de `GET /api/me`.
 *
 * ⚠️ A sessão não é guardada aqui: ela vive num cookie `httpOnly` que o
 * JavaScript não lê. O estado abaixo é só um **reflexo** do que o servidor
 * respondeu — a fonte da verdade está lá.
 */
export function SessaoProvider({ children }: { readonly children: ReactNode }) {
  const clienteDeQuery = useQueryClient();

  const consulta = useQuery({
    queryKey: ['sessao'],
    queryFn: () => apiDeSessao.perfil(),
    retry: false,
    staleTime: Infinity,
  });

  const recarregar = async () => {
    await clienteDeQuery.invalidateQueries({ queryKey: ['sessao'] });
  };

  const sair = async () => {
    try {
      await apiDeSessao.sair();
    } finally {
      // ⚠️ `clear()`, não `invalidate`: o cache tem dados de documentos de quem
      // está saindo, e eles não podem reaparecer para o próximo login na mesma aba.
      clienteDeQuery.clear();
      clienteDeQuery.setQueryData(['sessao'], undefined);
      await clienteDeQuery.invalidateQueries({ queryKey: ['sessao'] });
    }
  };

  return (
    <ContextoDaSessao value={{ estado: interpretar(consulta), recarregar, sair }}>
      {children}
    </ContextoDaSessao>
  );
}

function interpretar(consulta: { isPending: boolean; data?: Perfil; error: unknown }): EstadoDaSessao {
  if (consulta.data !== undefined) return { situacao: 'autenticado', perfil: consulta.data };

  if (consulta.isPending) return { situacao: 'carregando' };

  if (consulta.error instanceof ErroDaApi && consulta.error.precisaMfa) {
    return { situacao: 'precisa-mfa' };
  }

  return { situacao: 'anonimo' };
}
