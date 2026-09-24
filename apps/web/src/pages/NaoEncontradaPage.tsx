import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { estilosDeBotao } from '@/components/ui/Botao';

/** 404 em português, com saída — dentro ou fora da área logada. */
export function NaoEncontradaPage() {
  useEffect(() => {
    document.title = 'Página não encontrada · LetsSign';
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6 text-center">
      <span className="bg-destaque-suave text-destaque flex size-16 items-center justify-center rounded-2xl">
        <Compass className="size-8" aria-hidden="true" />
      </span>
      <div>
        <p className="font-display text-tinta-3 text-sm font-bold tracking-widest">ERRO 404</p>
        <h1 className="text-tinta mt-2 text-3xl font-extrabold">Esta página não existe</h1>
        <p className="text-tinta-2 mt-2 max-w-md">
          O endereço pode ter sido digitado errado ou o conteúdo mudou de lugar.
        </p>
      </div>
      <div className="flex gap-2">
        <Link to="/" className={estilosDeBotao('secundario')}>
          Início
        </Link>
        <Link to="/app" className={estilosDeBotao('primario')}>
          Ir para o painel
        </Link>
      </div>
    </div>
  );
}
