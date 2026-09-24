import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface Props {
  readonly titulo: string;
  readonly descricao?: ReactNode;
  readonly acoes?: ReactNode;
  readonly trilha?: readonly { readonly rotulo: string; readonly para?: string }[];
}

/**
 * O título de toda tela — e o `<title>` da aba, para quem tem vinte abas abertas.
 * Padrão obrigatório: nenhuma tela monta o próprio cabeçalho à mão.
 */
export function CabecalhoDaPagina({ titulo, descricao, acoes, trilha }: Props) {
  useEffect(() => {
    document.title = `${titulo} · LetsSign`;
  }, [titulo]);

  return (
    <div className="mb-8">
      {trilha && trilha.length > 0 && (
        <nav aria-label="Você está em" className="mb-3">
          <ol className="text-tinta-3 flex flex-wrap items-center gap-1 text-sm">
            {trilha.map((item, indice) => (
              <li key={item.rotulo} className="flex items-center gap-1">
                {indice > 0 && <ChevronRight className="size-3.5" aria-hidden="true" />}
                {item.para ? (
                  <Link to={item.para} className="hover:text-tinta transition">
                    {item.rotulo}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-tinta-2">
                    {item.rotulo}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-tinta text-2xl font-extrabold sm:text-3xl">{titulo}</h1>
          {descricao && <div className="text-tinta-2 mt-1.5">{descricao}</div>}
        </div>
        {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
      </div>
    </div>
  );
}
