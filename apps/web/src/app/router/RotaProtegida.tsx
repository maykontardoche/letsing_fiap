import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Monograma } from '@/components/marca/Logo';
import { useSessao } from '@/app/providers/sessao-contexto';

/**
 * Exige sessão para as rotas filhas.
 *
 * ⚠️ Isto é **experiência**, não segurança: redireciona quem não tem sessão para
 * o login e quem falta o segundo fator para o MFA. Quem protege os dados é a API,
 * que responde 401/403 a qualquer requisição sem sessão válida.
 */
export function RotaProtegida() {
  const { estado } = useSessao();
  const local = useLocation();
  const voltar = encodeURIComponent(`${local.pathname}${local.search}`);

  if (estado.situacao === 'carregando') {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center">
        <Monograma className="animate-pulso-suave size-12" />
        <span className="sr-only">Carregando sua sessão…</span>
      </div>
    );
  }

  if (estado.situacao === 'precisa-mfa') return <Navigate to={`/mfa?voltar=${voltar}`} replace />;
  if (estado.situacao === 'anonimo') return <Navigate to={`/entrar?voltar=${voltar}`} replace />;

  return <Outlet />;
}
