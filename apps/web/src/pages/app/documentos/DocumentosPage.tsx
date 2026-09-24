import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDownUp, FileSearch, FileText, Plus, Search, X } from 'lucide-react';
import { usePode } from '@/app/providers/sessao-contexto';
import { CabecalhoDaPagina } from '@/components/layout/CabecalhoDaPagina';
import { estilosDeBotao } from '@/components/ui/Botao';
import { Cartao } from '@/components/ui/Cartao';
import { Seletor } from '@/components/ui/Campo';
import { Abas, Avatar, BarraDeProgresso, Paginacao } from '@/components/ui/Diversos';
import { Carregando, EstadoDeErro, EstadoVazio, Esqueleto } from '@/components/ui/Estados';
import { EtiquetaDoDocumento } from '@/components/ui/EtiquetaDeStatus';
import { NIVEIS, STATUS_DO_DOCUMENTO, STATUS_EM_ORDEM } from '@/constants/status';
import {
  apiDeDocumentos,
  type ResumoDoDocumento,
  type StatusDoDocumento,
} from '@/lib/api/documentos';
import { useFiltrosNaUrl } from '@/hooks/useFiltrosNaUrl';
import { formatarData, formatarRelativo } from '@/lib/formatadores';

const POR_PAGINA = 12;
const ORDENACOES = [
  { id: 'criadoEm', rotulo: 'Data de criação' },
  { id: 'atualizadoEm', rotulo: 'Última atividade' },
  { id: 'titulo', rotulo: 'Título' },
  { id: 'prazo', rotulo: 'Prazo' },
] as const;
const ORDENACOES_VALIDAS = ORDENACOES.map((o) => o.id);

export function DocumentosPage() {
  const podeCriar = usePode('documentos.criar');
  const navegar = useNavigate();
  const { filtros, mudar } = useFiltrosNaUrl({
    statusValidos: STATUS_EM_ORDEM,
    ordenacoesValidas: ORDENACOES_VALIDAS,
  });
  const [busca, definirBusca] = useState(filtros.q);
  const [qDaUrl, definirQDaUrl] = useState(filtros.q);

  // A URL mudou por fora (voltar do navegador, link, "limpar filtros"): o campo acompanha.
  // Ajuste durante o render, não em efeito — é o padrão que o React recomenda.
  if (qDaUrl !== filtros.q) {
    definirQDaUrl(filtros.q);
    definirBusca(filtros.q);
  }

  // Busca com espera: não dispara uma requisição por tecla.
  useEffect(() => {
    if (busca === filtros.q) return undefined;

    const espera = window.setTimeout(() => mudar({ q: busca }), 350);

    return () => window.clearTimeout(espera);
  }, [busca, filtros.q, mudar]);

  const consulta = useQuery({
    queryKey: ['documentos', filtros],
    queryFn: () =>
      apiDeDocumentos.listar({
        q: filtros.q || undefined,
        status: filtros.status as StatusDoDocumento | null,
        ordenar: filtros.ordenar,
        dir: filtros.dir,
        pagina: filtros.pagina,
        por: POR_PAGINA,
      }),
    placeholderData: keepPreviousData,
  });

  const contagens = consulta.data?.contagens ?? {};
  const totalGeral = Object.values(contagens).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <>
      <CabecalhoDaPagina
        titulo="Documentos"
        descricao="Acompanhe cada envelope, do rascunho ao PDF selado."
        acoes={
          podeCriar && (
            <Link to="/app/documentos/novo" className={estilosDeBotao('primario')}>
              <Plus className="size-4" aria-hidden="true" /> Novo documento
            </Link>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Abas
          rotulo="Filtrar por status"
          ativa={(filtros.status ?? 'todos') as StatusDoDocumento | 'todos'}
          aoMudar={(id) => mudar({ status: id === 'todos' ? null : id })}
          abas={[
            { id: 'todos' as const, rotulo: 'Todos', contagem: totalGeral },
            ...STATUS_EM_ORDEM.map((s) => ({
              id: s,
              rotulo: STATUS_DO_DOCUMENTO[s].rotulo,
              contagem: contagens[s] ?? 0,
            })),
          ]}
        />
        <div className="flex gap-2">
          <div className="relative flex-1 lg:w-72">
            <Search
              className="text-tinta-3 pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => definirBusca(e.target.value)}
              placeholder="Título, código ou signatário"
              aria-label="Buscar documentos"
              className="border-linha bg-superficie text-tinta placeholder:text-tinta-3 focus:border-destaque focus:ring-destaque/15 h-10 w-full rounded-xl border pr-9 pl-10 text-sm focus:ring-4 focus:outline-none"
            />
            {busca && (
              <button
                type="button"
                onClick={() => definirBusca('')}
                aria-label="Limpar busca"
                className="text-tinta-3 hover:text-tinta absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <label className="sr-only" htmlFor="ordenacao">
            Ordenar por
          </label>
          <Seletor
            id="ordenacao"
            className="h-10 w-auto"
            value={`${filtros.ordenar}:${filtros.dir}`}
            onChange={(e) => {
              const [ordenar, dir] = e.target.value.split(':') as [string, 'asc' | 'desc'];
              mudar({ ordenar, dir });
            }}
          >
            {ORDENACOES.flatMap((o) => [
              <option key={`${o.id}:desc`} value={`${o.id}:desc`}>
                {o.rotulo} ↓
              </option>,
              <option key={`${o.id}:asc`} value={`${o.id}:asc`}>
                {o.rotulo} ↑
              </option>,
            ])}
          </Seletor>
        </div>
      </div>

      <Cartao semPreenchimento className="overflow-hidden">
        {consulta.isPending && (
          <Carregando rotulo="Carregando documentos…">
            <div className="divide-linha divide-y">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex items-center gap-4 p-5">
                  <Esqueleto className="size-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Esqueleto className="h-4 w-1/2" />
                    <Esqueleto className="h-3 w-1/4" />
                  </div>
                  <Esqueleto className="h-6 w-24 rounded-full" />
                </div>
              ))}
            </div>
          </Carregando>
        )}

        {consulta.isError && (
          <EstadoDeErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />
        )}

        {consulta.data &&
          consulta.data.itens.length === 0 &&
          (filtros.q || filtros.status ? (
            <EstadoVazio
              icone={<FileSearch />}
              titulo="Nada encontrado com esses filtros"
              descricao="Tente outro termo de busca ou veja todos os status."
              acao={
                <button
                  type="button"
                  className={estilosDeBotao('secundario')}
                  onClick={() => mudar({ q: '', status: null })}
                >
                  Limpar filtros
                </button>
              }
            />
          ) : (
            <EstadoVazio
              icone={<FileText />}
              titulo="Nenhum documento ainda"
              descricao="Envie um PDF, convide quem assina e acompanhe tudo por aqui."
              acao={
                podeCriar && (
                  <Link to="/app/documentos/novo" className={estilosDeBotao('primario')}>
                    <Plus className="size-4" /> Novo documento
                  </Link>
                )
              }
            />
          ))}

        {consulta.data && consulta.data.itens.length > 0 && (
          <>
            <table className="hidden w-full text-sm md:table">
              <caption className="sr-only">Documentos</caption>
              <thead className="bg-superficie-2/60 border-linha border-b">
                <tr className="text-tinta-3 text-left text-xs font-semibold tracking-wide uppercase">
                  <th scope="col" className="px-5 py-3">
                    Documento
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Assinaturas
                  </th>
                  <th scope="col" className="px-5 py-3">
                    <span className="inline-flex items-center gap-1">
                      <ArrowDownUp className="size-3" aria-hidden="true" />
                      {ORDENACOES.find((o) => o.id === filtros.ordenar)?.rotulo}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-linha divide-y">
                {consulta.data.itens.map((doc) => (
                  <LinhaDoDocumento
                    key={doc.uuid}
                    documento={doc}
                    ordenacao={filtros.ordenar}
                    aoAbrir={() => navegar(`/app/documentos/${doc.uuid}`)}
                  />
                ))}
              </tbody>
            </table>

            <ul className="divide-linha divide-y md:hidden">
              {consulta.data.itens.map((doc) => (
                <li key={doc.uuid}>
                  <Link
                    to={`/app/documentos/${doc.uuid}`}
                    className="hover:bg-superficie-2 block space-y-3 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-tinta truncate font-semibold">{doc.titulo}</p>
                        <p className="text-tinta-3 font-mono text-xs">{doc.codigo}</p>
                      </div>
                      <EtiquetaDoDocumento status={doc.status} />
                    </div>
                    <Progresso documento={doc} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Cartao>

      {consulta.data && (
        <Paginacao
          pagina={consulta.data.pagina}
          porPagina={consulta.data.porPagina}
          total={consulta.data.total}
          aoMudar={(pagina) => mudar({ pagina })}
        />
      )}
    </>
  );
}

function LinhaDoDocumento({
  documento,
  ordenacao,
  aoAbrir,
}: {
  readonly documento: ResumoDoDocumento;
  readonly ordenacao: string;
  readonly aoAbrir: () => void;
}) {
  const data =
    ordenacao === 'prazo'
      ? documento.prazo
        ? `Prazo ${formatarData(documento.prazo)}`
        : 'Sem prazo'
      : ordenacao === 'atualizadoEm'
        ? formatarRelativo(documento.atualizadoEm)
        : formatarData(documento.criadoEm);

  return (
    <tr onClick={aoAbrir} className="hover:bg-superficie-2/60 cursor-pointer transition">
      <td className="px-5 py-4">
        {/* O link é o alvo acessível; a linha inteira clicável é só conveniência de mouse. */}
        <Link
          to={`/app/documentos/${documento.uuid}`}
          onClick={(e) => e.stopPropagation()}
          className="group flex items-center gap-3.5"
        >
          <span className="bg-destaque-suave text-destaque flex size-10 shrink-0 items-center justify-center rounded-xl">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="text-tinta group-hover:text-destaque block max-w-md truncate font-semibold transition">
              {documento.titulo}
            </span>
            <span className="text-tinta-3 block text-xs">
              <span className="font-mono">{documento.codigo}</span> ·{' '}
              {NIVEIS[documento.nivelVerificacao].rotulo} · por {documento.criadoPor.nome}
            </span>
          </span>
        </Link>
      </td>
      <td className="px-5 py-4">
        <EtiquetaDoDocumento status={documento.status} />
      </td>
      <td className="w-64 px-5 py-4">
        <Progresso documento={documento} />
      </td>
      <td className="text-tinta-2 px-5 py-4 whitespace-nowrap numeros">{data}</td>
    </tr>
  );
}

function Progresso({ documento }: { readonly documento: ResumoDoDocumento }) {
  const { assinados, total } = documento.progresso;

  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2">
        {documento.signatarios.slice(0, 4).map((s, i) => (
          <span key={i} title={s.nome} className="ring-superficie rounded-full ring-2">
            <Avatar
              nome={s.nome}
              tamanho="sm"
              className={s.status === 'assinado' ? '' : 'opacity-45 grayscale'}
            />
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <BarraDeProgresso
          valor={total === 0 ? 0 : assinados / total}
          rotulo={`${assinados} de ${total} assinaturas`}
        />
        <p className="text-tinta-3 mt-1 text-xs numeros">
          {assinados}/{total} assinaturas
        </p>
      </div>
    </div>
  );
}
