import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Logo } from '@/components/marca/Logo';
import { Botao, estilosDeBotao } from '@/components/ui/Botao';

/**
 * ⚠️ Erro em render nunca vira tela branca. Esta fronteira fica no topo da
 * árvore de rotas e mostra uma saída em português — em vez do "Unexpected
 * Application Error! 💿 Hey developer" do React Router, em inglês e sem volta.
 */
export function FronteiraDeErro() {
  const erro = useRouteError();
  const naoEncontrado = isRouteErrorResponse(erro) && erro.status === 404;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      <span className="bg-perigo-suave text-perigo-tinta flex size-14 items-center justify-center rounded-2xl">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </span>
      <div className="max-w-md">
        <h1 className="text-tinta text-2xl font-bold">
          {naoEncontrado ? 'Página não encontrada' : 'Algo deu errado nesta tela'}
        </h1>
        <p className="text-tinta-2 mt-2">
          {naoEncontrado
            ? 'O endereço pode ter sido digitado errado, ou a página mudou de lugar.'
            : 'O erro foi inesperado. Recarregar costuma resolver; se persistir, volte ao início.'}
        </p>
      </div>
      <div className="flex gap-2">
        {!naoEncontrado && (
          <Botao variante="secundario" onClick={() => window.location.reload()}>
            Recarregar
          </Botao>
        )}
        <Link to="/" className={estilosDeBotao('primario')}>
          Ir para o início
        </Link>
      </div>
    </div>
  );
}
