import { useEffect, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileSearch,
  Fingerprint,
  KeyRound,
  Link2,
  Loader2,
  Search,
  ShieldAlert,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { NavegacaoPublica } from '@/components/layout/NavegacaoPublica';
import { Botao } from '@/components/ui/Botao';
import { Cartao, CabecalhoDoCartao } from '@/components/ui/Cartao';
import { Avatar, Hash } from '@/components/ui/Diversos';
import { Alerta, Carregando, EstadoDeErro, Esqueleto } from '@/components/ui/Estados';
import { EtiquetaDoDocumento } from '@/components/ui/EtiquetaDeStatus';
import { NIVEIS, VERIFICACAO } from '@/constants/status';
import { apiDeValidacao, sha256DoArquivo, type ResultadoDaValidacao } from '@/lib/api/validacao';
import { ErroDaApi, mensagemDoErro } from '@/lib/erros';
import { cn } from '@/lib/cn';
import { formatarDataHora, formatarDataHoraLonga } from '@/lib/formatadores';
import { Rodape } from './landing/Final';

/** A validação pública: por código, QR Code ou arrastando o PDF. Sem conta. */
export function ValidarPage() {
  const { codigo } = useParams();

  useEffect(() => {
    document.title = 'Validar documento · LetsSign';
  }, []);

  return (
    <>
      <NavegacaoPublica sobre="escuro" />
      <main id="conteudo">
        <section className="bg-noite-950 relative isolate overflow-hidden pt-32 pb-16 text-white">
          <div aria-hidden="true" className="grade-de-fundo absolute inset-0 -z-10" />
          <div aria-hidden="true" className="absolute -top-40 left-1/2 -z-10 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.3),transparent)]" />
          <div className="mx-auto max-w-3xl px-5 text-center">
            <p className="text-ciano-300 text-sm font-semibold tracking-wider uppercase">Validação pública</p>
            <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">Este documento é autêntico?</h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/65">
              Confira quem assinou, quando, com quais verificações — e se algo foi alterado depois.
            </p>
            <Busca codigoAtual={codigo} />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-12">{codigo ? <Resultado codigo={codigo} /> : <ComoFunciona />}</section>
      </main>
      <Rodape />
    </>
  );
}

function Busca({ codigoAtual }: { readonly codigoAtual?: string }) {
  const navegar = useNavigate();
  const [codigo, definirCodigo] = useState(codigoAtual ?? '');
  const [arrastando, definirArrastando] = useState(false);
  const [conferindo, definirConferindo] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => definirCodigo(codigoAtual ?? ''), [codigoAtual]);

  const buscar = (evento: FormEvent) => {
    evento.preventDefault();

    const limpo = codigo.trim().toUpperCase();

    if (limpo) navegar(`/validar/${limpo}`);
  };

  const conferirArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;

    definirErro(null);
    definirConferindo(true);

    try {
      const hash = await sha256DoArquivo(arquivo);
      const { codigo: encontrado, versao } = await apiDeValidacao.porHash(hash);

      navegar(`/validar/${encontrado}?arquivo=${versao}&hash=${hash}`);
    } catch (causa) {
      definirErro(causa instanceof ErroDaApi && causa.status === 404 ? causa.message : mensagemDoErro(causa));
    } finally {
      definirConferindo(false);
    }
  };

  const aoSoltar = (evento: DragEvent) => {
    evento.preventDefault();
    definirArrastando(false);
    void conferirArquivo(evento.dataTransfer.files[0]);
  };

  return (
    <div className="mx-auto mt-10 max-w-2xl space-y-4 text-left">
      <form onSubmit={buscar} className="flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur">
        <label htmlFor="codigo" className="sr-only">Código do documento</label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-white/40" aria-hidden="true" />
          <input
            id="codigo"
            value={codigo}
            onChange={(e) => definirCodigo(e.target.value)}
            placeholder="LS-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            className="h-12 w-full rounded-xl bg-transparent pr-3 pl-11 font-mono text-lg tracking-wider text-white uppercase placeholder:text-white/30 focus:outline-none"
          />
        </div>
        <Botao type="submit" variante="claro" tamanho="lg">Validar</Botao>
      </form>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          definirArrastando(true);
        }}
        onDragLeave={() => definirArrastando(false)}
        onDrop={aoSoltar}
        className={cn(
          'flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-5 py-5 text-sm transition',
          arrastando ? 'border-ciano-300 bg-white/10 text-white' : 'border-white/15 text-white/60 hover:border-white/30 hover:text-white/85',
        )}
      >
        <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => void conferirArquivo(e.target.files?.[0])} />
        {conferindo ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <UploadCloud className="size-5" aria-hidden="true" />}
        <span>{conferindo ? 'Calculando o hash e conferindo…' : 'Ou arraste o PDF aqui — o hash é calculado no seu navegador, o arquivo não é enviado'}</span>
      </label>

      {erro && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-300" aria-hidden="true" />
          {erro}
        </div>
      )}
    </div>
  );
}

function Resultado({ codigo }: { readonly codigo: string }) {
  const [parametros] = useSearchParams();
  const consulta = useQuery({ queryKey: ['validacao', codigo], queryFn: () => apiDeValidacao.porCodigo(codigo), retry: false });

  if (consulta.isPending) {
    return (
      <Carregando rotulo="Verificando assinaturas e trilha…">
        <Esqueleto className="mb-6 h-32 rounded-[var(--radius-cartao)]" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Esqueleto className="h-72 rounded-[var(--radius-cartao)]" />
          <Esqueleto className="h-72 rounded-[var(--radius-cartao)]" />
        </div>
      </Carregando>
    );
  }

  if (consulta.isError) {
    return consulta.error instanceof ErroDaApi && consulta.error.status === 404 ? (
      <Cartao className="mx-auto max-w-xl text-center">
        <FileSearch className="text-tinta-3 mx-auto size-12" aria-hidden="true" />
        <h2 className="text-tinta mt-4 text-xl font-bold">Documento não encontrado</h2>
        <p className="text-tinta-2 mt-2 text-sm">{consulta.error.message}</p>
      </Cartao>
    ) : (
      <Cartao><EstadoDeErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} /></Cartao>
    );
  }

  const dados = consulta.data;
  const arquivo = parametros.get('arquivo') as 'original' | 'assinado' | null;

  return <Laudo dados={dados} arquivo={arquivo} />;
}

type Veredito = { tom: 'sucesso' | 'alerta' | 'perigo' | 'neutro'; titulo: string; texto: string; icone: ReactNode };

function veredito(dados: ResultadoDaValidacao): Veredito {
  const assinaturasOk = dados.signatarios.every((s) => s.assinaturaDigital === null || s.assinaturaDigital.valida);
  const { documento, selo, trilha } = dados;

  if (!trilha.integra || !assinaturasOk || (selo.presente && !selo.valido)) {
    return { tom: 'perigo', icone: <ShieldAlert />, titulo: 'Atenção: a integridade não confere', texto: 'Algum registro deste documento não passou na verificação criptográfica. Não confie nele sem conferir com quem o enviou.' };
  }

  if (documento.status === 'concluido' && selo.valido) {
    return { tom: 'sucesso', icone: <BadgeCheck />, titulo: 'Documento autêntico e íntegro', texto: `Assinado por todos os ${dados.signatarios.length} signatários. Assinaturas, selo da plataforma e trilha de auditoria verificados agora.` };
  }

  if (documento.status === 'em_andamento') {
    return { tom: 'alerta', icone: <Clock3 />, titulo: 'Assinaturas em andamento', texto: 'O documento é autêntico, mas ainda não foi assinado por todos. As assinaturas já feitas são válidas.' };
  }

  return { tom: 'neutro', icone: <XCircle />, titulo: 'Documento encerrado sem conclusão', texto: 'Este documento foi cancelado, recusado ou expirou antes de todas as assinaturas.' };
}

const TONS_DO_VEREDITO = {
  sucesso: 'from-emerald-500 to-teal-600 shadow-[0_20px_60px_-20px_rgba(16,185,129,0.6)]',
  alerta: 'from-amber-500 to-orange-600 shadow-[0_20px_60px_-20px_rgba(245,158,11,0.6)]',
  perigo: 'from-red-500 to-rose-700 shadow-[0_20px_60px_-20px_rgba(239,68,68,0.6)]',
  neutro: 'from-slate-500 to-slate-700',
} as const;

function Laudo({ dados, arquivo }: { readonly dados: ResultadoDaValidacao; readonly arquivo: 'original' | 'assinado' | null }) {
  const resultado = veredito(dados);
  const { documento, selo, trilha } = dados;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={cn('flex flex-col gap-5 rounded-[var(--radius-cartao)] bg-gradient-to-br p-6 text-white sm:flex-row sm:items-center sm:p-8', TONS_DO_VEREDITO[resultado.tom])}>
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 [&_svg]:size-9">{resultado.icone}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-extrabold">{resultado.titulo}</h2>
          <p className="mt-1 text-white/85">{resultado.texto}</p>
        </div>
        <span className="rounded-xl bg-white/15 px-3 py-2 font-mono text-sm font-semibold">{documento.codigo}</span>
      </motion.div>

      {arquivo && (
        <Alerta tom="sucesso" titulo="O arquivo que você enviou confere">
          O hash SHA-256 do seu arquivo é idêntico ao do PDF {arquivo === 'assinado' ? 'final assinado emitido pela plataforma' : 'original enviado para assinatura'}. Nenhum byte foi alterado.
        </Alerta>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Cartao>
            <CabecalhoDoCartao titulo={documento.titulo} descricao={`${documento.organizacao} · enviado por ${documento.remetente}`} acoes={<EtiquetaDoDocumento status={documento.status} />} />
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <Dado rotulo="Enviado em" valor={formatarDataHora(documento.enviadoEm)} />
              <Dado rotulo="Concluído em" valor={formatarDataHora(documento.concluidoEm)} />
              <Dado rotulo="Verificação" valor={NIVEIS[documento.nivelVerificacao].rotulo} />
            </dl>
          </Cartao>

          <Cartao>
            <CabecalhoDoCartao titulo={`Signatários (${dados.signatarios.length})`} descricao="Cada assinatura digital é verificada agora contra a chave pública da plataforma." />
            <ul className="space-y-3">
              {dados.signatarios.map((s) => (
                <li key={s.ordem} className="border-linha rounded-2xl border p-4">
                  <div className="flex items-start gap-3">
                    <Avatar nome={s.nome} />
                    <div className="min-w-0 flex-1">
                      <p className="text-tinta font-semibold">{s.nome}</p>
                      <p className="text-tinta-3 text-xs">
                        {s.emailMascarado}
                        {s.cpfMascarado && ` · CPF ${s.cpfMascarado}`}
                      </p>
                      <p className="text-tinta-2 mt-1 text-xs">
                        {s.assinadoEm ? `Assinou em ${formatarDataHoraLonga(s.assinadoEm)}` : s.recusadoEm ? `Recusou em ${formatarDataHora(s.recusadoEm)}` : 'Ainda não assinou'}
                      </p>
                    </div>
                    {s.assinaturaDigital &&
                      (s.assinaturaDigital.valida ? (
                        <span className="bg-sucesso-suave text-sucesso-tinta inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
                          <ShieldCheck className="size-3.5" aria-hidden="true" /> Ed25519 válida
                        </span>
                      ) : (
                        <span className="bg-perigo-suave text-perigo-tinta inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
                          <ShieldAlert className="size-3.5" aria-hidden="true" /> Inválida
                        </span>
                      ))}
                  </div>
                  {s.verificacoes.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Identidade verificada por">
                      {s.verificacoes.map((v) => {
                        const Icone = VERIFICACAO[v.tipo].icone;

                        return (
                          <li key={v.tipo} className="bg-superficie-2 text-tinta-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                            <Icone className="text-sucesso size-3.5" aria-hidden="true" /> {VERIFICACAO[v.tipo].curto}
                            {v.pontuacao !== null && v.tipo !== 'codigo_email' && <span className="text-tinta-3 numeros">{Math.round(v.pontuacao * 100)}%</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {s.assinaturaDigital && <p className="text-tinta-3 mt-2 font-mono text-[11px]">id da assinatura {s.assinaturaDigital.id}</p>}
                </li>
              ))}
            </ul>
          </Cartao>
        </div>

        <div className="space-y-6">
          <Cartao>
            <CabecalhoDoCartao titulo="Provas criptográficas" />
            <ul className="space-y-4">
              <Prova ok={selo.valido} pendente={!selo.presente} icone={<KeyRound />} titulo="Selo da plataforma" texto={selo.presente ? `${selo.algoritmo} · chave ${selo.idDaChave}` : 'Emitido quando todos assinarem'} />
              <Prova ok={dados.signatarios.every((s) => s.assinaturaDigital === null || s.assinaturaDigital.valida)} icone={<FileCheck2 />} titulo="Assinaturas dos signatários" texto={`${dados.signatarios.filter((s) => s.assinaturaDigital?.valida).length} de ${dados.signatarios.length} válidas`} />
              <Prova ok={trilha.integra} icone={<Link2 />} titulo="Trilha de auditoria" texto={trilha.integra ? `${trilha.total} eventos encadeados, nenhum alterado` : `Quebra no evento ${trilha.quebraEm}: ${trilha.motivo}`} />
            </ul>
            <div className="border-linha mt-5 space-y-3 border-t pt-5">
              <div>
                <p className="text-tinta-3 mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase"><Fingerprint className="size-3.5" /> SHA-256 do original</p>
                <Hash valor={documento.hashOriginal} />
              </div>
              {documento.hashAssinado && (
                <div>
                  <p className="text-tinta-3 mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase"><ShieldCheck className="size-3.5" /> SHA-256 do PDF assinado</p>
                  <Hash valor={documento.hashAssinado} />
                </div>
              )}
            </div>
            <a href={apiDeValidacao.urlDaChave()} target="_blank" rel="noreferrer" className="text-destaque mt-5 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
              <KeyRound className="size-4" aria-hidden="true" /> Chave pública Ed25519 da plataforma
            </a>
          </Cartao>

          <Cartao>
            <CabecalhoDoCartao titulo="Linha do tempo" descricao="Eventos públicos da trilha de auditoria" />
            <ol className="relative space-y-4 pl-6">
              <span aria-hidden="true" className="bg-linha absolute top-1.5 bottom-1.5 left-[7px] w-px" />
              {dados.linhaDoTempo.map((e, i) => (
                <li key={`${e.hash}-${i}`} className="relative">
                  <span aria-hidden="true" className={cn('ring-superficie absolute top-1 -left-6 size-3.5 rounded-full ring-4', e.acao === 'documento_concluido' ? 'bg-sucesso' : e.acao.includes('recusa') || e.acao.includes('cancel') ? 'bg-perigo' : 'bg-destaque')} />
                  <p className="text-tinta text-sm">{e.resumo}</p>
                  <p className="text-tinta-3 mt-0.5 text-xs">
                    {formatarDataHora(e.em)} · <span className="font-mono">{e.hash.slice(0, 10)}…</span>
                  </p>
                </li>
              ))}
            </ol>
          </Cartao>
        </div>
      </div>
    </div>
  );
}

function Prova({ ok, pendente = false, icone, titulo, texto }: { readonly ok: boolean; readonly pendente?: boolean; readonly icone: ReactNode; readonly titulo: string; readonly texto: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5', pendente ? 'bg-superficie-2 text-tinta-3' : ok ? 'bg-sucesso-suave text-sucesso-tinta' : 'bg-perigo-suave text-perigo-tinta')}>
        {icone}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-tinta flex items-center gap-1.5 text-sm font-semibold">
          {titulo}
          {!pendente && (ok ? <CheckCircle2 className="text-sucesso size-4" aria-label="válido" /> : <AlertTriangle className="text-perigo size-4" aria-label="inválido" />)}
        </p>
        <p className="text-tinta-3 text-xs">{texto}</p>
      </div>
    </li>
  );
}

function Dado({ rotulo, valor }: { readonly rotulo: string; readonly valor: string }) {
  return (
    <div>
      <dt className="text-tinta-3 text-xs">{rotulo}</dt>
      <dd className="text-tinta mt-0.5 font-medium">{valor}</dd>
    </div>
  );
}

function ComoFunciona() {
  const itens = [
    { icone: Search, titulo: 'Digite o código', texto: 'Ele está no rodapé de todas as páginas do PDF assinado, no formato LS-XXXX-XXXX.' },
    { icone: UploadCloud, titulo: 'Ou arraste o PDF', texto: 'Calculamos a impressão digital SHA-256 no seu navegador e procuramos o documento correspondente.' },
    { icone: ShieldCheck, titulo: 'Veja o laudo', texto: 'Assinaturas Ed25519, selo da plataforma e trilha de auditoria são verificados na hora.' },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {itens.map(({ icone: Icone, titulo, texto }) => (
        <Cartao key={titulo}>
          <span className="bg-destaque-suave text-destaque flex size-11 items-center justify-center rounded-xl">
            <Icone className="size-5" aria-hidden="true" />
          </span>
          <h2 className="text-tinta mt-4 font-bold">{titulo}</h2>
          <p className="text-tinta-2 mt-1 text-sm">{texto}</p>
        </Cartao>
      ))}
      <p className="text-tinta-3 text-center text-sm md:col-span-3">
        É remetente? <Link to="/entrar" className="text-destaque font-semibold hover:underline">Entre na sua conta</Link> para ver os documentos completos.
      </p>
    </div>
  );
}
