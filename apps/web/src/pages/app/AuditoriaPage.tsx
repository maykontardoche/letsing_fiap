import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import {
  Bot,
  Download,
  FileText,
  Link2,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  UserRoundPen,
} from 'lucide-react';
import { CabecalhoDaPagina } from '@/components/layout/CabecalhoDaPagina';
import { Botao, estilosDeBotao } from '@/components/ui/Botao';
import { Cartao } from '@/components/ui/Cartao';
import { Seletor } from '@/components/ui/Campo';
import { Paginacao } from '@/components/ui/Diversos';
import { Alerta, Carregando, EstadoDeErro, EstadoVazio, Esqueleto } from '@/components/ui/Estados';
import { apiDeAuditoria, type EventoDeAuditoria } from '@/lib/api/gestao';
import { cn } from '@/lib/cn';
import { formatarDataHora, formatarRelativo } from '@/lib/formatadores';

const ATORES = {
  usuario: { rotulo: 'Usuário', icone: User, classe: 'bg-destaque-suave text-destaque-tinta' },
  signatario: {
    rotulo: 'Signatário',
    icone: UserRoundPen,
    classe: 'bg-sucesso-suave text-sucesso-tinta',
  },
  sistema: { rotulo: 'Sistema', icone: Bot, classe: 'bg-neutro-suave text-neutro-tinta' },
} as const;

/** `documento_enviado` → "Documento enviado". */
function rotuloDaAcao(acao: string): string {
  const texto = acao.replace(/_/g, ' ');

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function AuditoriaPage() {
  const [acao, definirAcao] = useState('');
  const [busca, definirBusca] = useState('');
  const [q, definirQ] = useState('');
  const [pagina, definirPagina] = useState(1);
  const [aberto, definirAberto] = useState<number | null>(null);

  useEffect(() => {
    const espera = window.setTimeout(() => {
      definirQ(busca);
      definirPagina(1);
    }, 350);

    return () => window.clearTimeout(espera);
  }, [busca]);

  const consulta = useQuery({
    queryKey: ['auditoria', acao, q, pagina],
    queryFn: () => apiDeAuditoria.listar({ acao: acao || undefined, q: q || undefined, pagina }),
    placeholderData: keepPreviousData,
  });

  const exame = useMutation({ mutationFn: apiDeAuditoria.integridade });

  return (
    <>
      <CabecalhoDaPagina
        titulo="Trilha de auditoria"
        descricao="Tudo o que aconteceu na organização, em registros imutáveis e encadeados por hash."
        acoes={
          <>
            <Botao
              variante="secundario"
              icone={<ShieldCheck className="size-4" />}
              carregando={exame.isPending}
              onClick={() => exame.mutate()}
            >
              Examinar integridade
            </Botao>
            <a href={apiDeAuditoria.urlDeExportacao()} className={estilosDeBotao('secundario')}>
              <Download className="size-4" aria-hidden="true" /> Exportar CSV
            </a>
          </>
        }
      />

      {exame.data &&
        (exame.data.integra ? (
          <Alerta tom="sucesso" titulo="Trilha íntegra" className="mb-6">
            {exame.data.eventos} eventos em {exame.data.cadeias} cadeias recalculados agora (
            {formatarDataHora(exame.data.verificadoEm)}). Nenhum registro foi alterado, apagado ou
            inserido fora de ordem.
          </Alerta>
        ) : (
          <Alerta
            tom="perigo"
            titulo={`${exame.data.quebradas.length} cadeia(s) com quebra`}
            className="mb-6"
          >
            <ul className="list-disc pl-5">
              {exame.data.quebradas.map((q) => (
                <li key={q.cadeia}>
                  <span className="font-mono">{q.cadeia}</span> — evento {q.quebraEm}: {q.motivo}
                </li>
              ))}
            </ul>
          </Alerta>
        ))}
      {exame.isError && (
        <Alerta tom="perigo" className="mb-6">
          Não foi possível examinar a trilha agora.
        </Alerta>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="text-tinta-3 pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => definirBusca(e.target.value)}
            placeholder="Buscar no resumo dos eventos"
            aria-label="Buscar eventos"
            className="border-linha bg-superficie text-tinta placeholder:text-tinta-3 focus:border-destaque focus:ring-destaque/15 h-11 w-full rounded-xl border pr-3 pl-10 text-sm focus:ring-4 focus:outline-none"
          />
        </div>
        <label htmlFor="filtro-acao" className="sr-only">
          Filtrar por ação
        </label>
        <Seletor
          id="filtro-acao"
          className="sm:w-72"
          value={acao}
          onChange={(e) => {
            definirAcao(e.target.value);
            definirPagina(1);
          }}
        >
          <option value="">Todas as ações</option>
          {consulta.data?.acoes.map((a) => (
            <option key={a.acao} value={a.acao}>
              {rotuloDaAcao(a.acao)} ({a.total})
            </option>
          ))}
        </Seletor>
      </div>

      <Cartao semPreenchimento>
        {consulta.isPending && (
          <Carregando>
            <div className="space-y-px">
              {Array.from({ length: 8 }, (_, i) => (
                <Esqueleto key={i} className="h-16 rounded-none" />
              ))}
            </div>
          </Carregando>
        )}
        {consulta.isError && (
          <EstadoDeErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />
        )}
        {consulta.data?.itens.length === 0 && (
          <EstadoVazio
            icone={<Search />}
            titulo="Nenhum evento encontrado"
            descricao="Mude a busca ou o filtro de ação."
          />
        )}
        {consulta.data && consulta.data.itens.length > 0 && (
          <ol className="divide-linha divide-y">
            {consulta.data.itens.map((evento) => (
              <Evento
                key={evento.id}
                evento={evento}
                aberto={aberto === evento.id}
                aoAlternar={() => definirAberto(aberto === evento.id ? null : evento.id)}
              />
            ))}
          </ol>
        )}
      </Cartao>

      {consulta.data && (
        <Paginacao
          pagina={consulta.data.pagina}
          porPagina={consulta.data.porPagina}
          total={consulta.data.total}
          aoMudar={definirPagina}
        />
      )}
    </>
  );
}

function Evento({
  evento,
  aberto,
  aoAlternar,
}: {
  readonly evento: EventoDeAuditoria;
  readonly aberto: boolean;
  readonly aoAlternar: () => void;
}) {
  const ator = ATORES[evento.tipoAtor];
  const Icone = ator.icone;
  const falha = evento.acao.includes('falhou') || evento.acao.includes('reprovada');

  return (
    <li>
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberto}
        className="hover:bg-superficie-2/60 flex w-full items-start gap-4 px-5 py-4 text-left transition"
      >
        <span
          className={cn(
            'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl',
            falha ? 'bg-perigo-suave text-perigo-tinta' : ator.classe,
          )}
        >
          {falha ? (
            <ShieldAlert className="size-4" aria-hidden="true" />
          ) : (
            <Icone className="size-4" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-tinta block text-sm">{evento.resumo}</span>
          <span className="text-tinta-3 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-medium">{rotuloDaAcao(evento.acao)}</span>
            <span>{formatarRelativo(evento.criadoEm)}</span>
            {evento.documento?.titulo && (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3" aria-hidden="true" /> {evento.documento.titulo}
              </span>
            )}
          </span>
        </span>
        <span className="text-tinta-3 hidden shrink-0 font-mono text-xs sm:block">
          {evento.hash.slice(0, 10)}…
        </span>
      </button>

      {aberto && (
        <div className="bg-superficie-2/50 border-linha animate-surgir grid gap-3 border-t px-5 py-4 text-xs sm:grid-cols-2">
          <Dado rotulo="Data e hora" valor={formatarDataHora(evento.criadoEm)} />
          <Dado
            rotulo="Ator"
            valor={`${ator.rotulo}${evento.atorNome ? ` · ${evento.atorNome}` : ''}`}
          />
          <Dado
            rotulo="Cadeia · sequência"
            valor={`${evento.cadeia} · #${evento.sequencia}`}
            mono
          />
          <Dado rotulo="IP" valor={evento.ip ?? '—'} mono />
          <Dado rotulo="Hash anterior" valor={evento.hashAnterior} mono />
          <Dado rotulo="Hash deste evento" valor={evento.hash} mono />
          {evento.userAgent && (
            <Dado rotulo="Navegador" valor={evento.userAgent} className="sm:col-span-2" />
          )}
          {evento.documento?.uuid && (
            <Link
              to={`/app/documentos/${evento.documento.uuid}`}
              className="text-destaque inline-flex items-center gap-1.5 font-semibold hover:underline sm:col-span-2"
            >
              <Link2 className="size-3.5" aria-hidden="true" /> Abrir o documento
            </Link>
          )}
        </div>
      )}
    </li>
  );
}

function Dado({
  rotulo,
  valor,
  mono = false,
  className,
}: {
  readonly rotulo: string;
  readonly valor: string;
  readonly mono?: boolean;
  readonly className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-tinta-3 font-semibold tracking-wide uppercase">{rotulo}</p>
      <p className={cn('text-tinta mt-0.5 break-all', mono && 'font-mono')}>{valor}</p>
    </div>
  );
}
