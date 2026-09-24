import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  Fingerprint,
  Link2,
  PenLine,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmacao } from '@/app/providers/ConfirmacaoProvider';
import { CabecalhoDaPagina } from '@/components/layout/CabecalhoDaPagina';
import { VisualizadorDePdf } from '@/components/pdf/VisualizadorDePdf';
import { Botao, estilosDeBotao } from '@/components/ui/Botao';
import { Cartao, CabecalhoDoCartao } from '@/components/ui/Cartao';
import { AreaDeTexto, Campo } from '@/components/ui/Campo';
import { Abas, Avatar, Hash } from '@/components/ui/Diversos';
import { Alerta, Carregando, EstadoDeErro, Esqueleto } from '@/components/ui/Estados';
import { EtiquetaDoDocumento, EtiquetaDoSignatario } from '@/components/ui/EtiquetaDeStatus';
import { Modal } from '@/components/ui/Modal';
import { NIVEIS, VERIFICACAO } from '@/constants/status';
import {
  apiDeDocumentos,
  type DetalheDoDocumento,
  type SignatarioDoDetalhe,
} from '@/lib/api/documentos';
import { mensagemDoErro } from '@/lib/erros';
import { cn } from '@/lib/cn';
import {
  formatarBytes,
  formatarDataHora,
  formatarDataHoraLonga,
  formatarRelativo,
} from '@/lib/formatadores';

export function DetalheDoDocumentoPage() {
  const { uuid = '' } = useParams();
  const consulta = useQuery({
    queryKey: ['documento', uuid],
    queryFn: () => apiDeDocumentos.detalhe(uuid),
    refetchInterval: (q) => (q.state.data?.status === 'em_andamento' ? 15_000 : false),
  });

  if (consulta.isPending) {
    return (
      <Carregando>
        <Esqueleto className="mb-3 h-5 w-48" />
        <Esqueleto className="mb-8 h-10 w-96" />
        <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <Esqueleto className="h-[28rem] rounded-[var(--radius-cartao)]" />
          <Esqueleto className="h-[28rem] rounded-[var(--radius-cartao)]" />
        </div>
      </Carregando>
    );
  }

  if (consulta.isError)
    return (
      <Cartao>
        <EstadoDeErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />
      </Cartao>
    );

  return <Conteudo documento={consulta.data} />;
}

function Conteudo({ documento }: { readonly documento: DetalheDoDocumento }) {
  const navegar = useNavigate();
  const confirmar = useConfirmacao();
  const clienteDeQuery = useQueryClient();
  const [cancelando, definirCancelando] = useState(false);
  const [versao, definirVersao] = useState<'original' | 'assinado'>(
    documento.hashAssinado ? 'assinado' : 'original',
  );

  const atualizar = async () => {
    await Promise.all(
      ['documento', 'documentos', 'painel'].map((chave) =>
        clienteDeQuery.invalidateQueries({ queryKey: [chave] }),
      ),
    );
  };

  const assinarAgora = useMutation({
    mutationFn: () => apiDeDocumentos.assinarAgora(documento.uuid),
    onSuccess: ({ caminho }) => navegar(caminho),
    onError: (e) => toast.error(mensagemDoErro(e)),
  });

  const excluir = useMutation({
    mutationFn: () => apiDeDocumentos.excluir(documento.uuid),
    onSuccess: async () => {
      await atualizar();
      toast.success('Rascunho excluído.');
      void navegar('/app/documentos', { replace: true });
    },
    onError: (e) => toast.error(mensagemDoErro(e)),
  });

  const { assinados, total } = documento.progresso;
  const nivel = NIVEIS[documento.nivelVerificacao];

  return (
    <>
      <CabecalhoDaPagina
        titulo={documento.titulo}
        trilha={[{ rotulo: 'Documentos', para: '/app/documentos' }, { rotulo: documento.codigo }]}
        descricao={
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <EtiquetaDoDocumento status={documento.status} />
            <span className="text-tinta-3 font-mono">{documento.codigo}</span>
            <span className="text-tinta-3">
              · criado por {documento.criadoPor.nome} {formatarRelativo(documento.criadoEm)}
            </span>
          </span>
        }
        acoes={
          <>
            {documento.meuSignatario && (
              <Botao
                icone={<PenLine className="size-4" />}
                carregando={assinarAgora.isPending}
                onClick={() => assinarAgora.mutate()}
              >
                Assinar agora
              </Botao>
            )}
            {documento.status === 'rascunho' && documento.podeGerenciar && (
              <>
                <Link
                  to={`/app/documentos/${documento.uuid}/preparar`}
                  className={estilosDeBotao('primario')}
                >
                  <Wand2 className="size-4" aria-hidden="true" /> Continuar preparando
                </Link>
                <Botao
                  variante="secundario"
                  icone={<Trash2 className="size-4" />}
                  onClick={() =>
                    void confirmar({
                      titulo: 'Excluir rascunho?',
                      mensagem:
                        'O arquivo e as configurações serão apagados. Esta ação não pode ser desfeita.',
                      confirmar: 'Excluir',
                      perigosa: true,
                    }).then((ok) => ok && excluir.mutate())
                  }
                >
                  Excluir
                </Botao>
              </>
            )}
            {documento.hashAssinado && (
              <a
                href={apiDeDocumentos.urlDoArquivo(documento.uuid, 'assinado', true)}
                className={estilosDeBotao(documento.meuSignatario ? 'secundario' : 'primario')}
              >
                <Download className="size-4" aria-hidden="true" /> Baixar assinado
              </a>
            )}
            {documento.status !== 'rascunho' && (
              <a
                href={documento.urlDeValidacao}
                target="_blank"
                rel="noreferrer"
                className={estilosDeBotao('secundario')}
              >
                <ExternalLink className="size-4" aria-hidden="true" /> Validação pública
              </a>
            )}
            {documento.status === 'em_andamento' && documento.podeGerenciar && (
              <Botao
                variante="secundario"
                icone={<Ban className="size-4" />}
                onClick={() => definirCancelando(true)}
              >
                Cancelar
              </Botao>
            )}
          </>
        }
      />

      {documento.status === 'cancelado' && documento.motivoCancelamento && (
        <Alerta
          tom="alerta"
          titulo={`Cancelado em ${formatarDataHora(documento.canceladoEm)}`}
          className="mb-6"
        >
          {documento.motivoCancelamento}
        </Alerta>
      )}
      {documento.status === 'recusado' && (
        <Alerta tom="perigo" titulo="Um signatário recusou a assinatura" className="mb-6">
          {documento.signatarios.find((s) => s.status === 'recusado')?.motivoRecusa ??
            'O documento foi encerrado.'}
        </Alerta>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <Cartao>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <AnelDeProgresso
                assinados={assinados}
                total={total}
                concluido={documento.status === 'concluido'}
              />
              <div className="min-w-0 flex-1">
                <p className="text-tinta text-lg font-bold">
                  {documento.status === 'concluido'
                    ? 'Assinado por todos'
                    : documento.status === 'rascunho'
                      ? 'Ainda não enviado'
                      : `${assinados} de ${total} assinaturas`}
                </p>
                <p className="text-tinta-2 mt-0.5 text-sm">
                  {documento.status === 'concluido'
                    ? `Concluído em ${formatarDataHoraLonga(documento.concluidoEm)}`
                    : `${nivel.rotulo} · ${documento.ordemSequencial ? 'em ordem' : 'em paralelo'}${documento.prazo ? ` · prazo ${formatarDataHora(documento.prazo)}` : ''}`}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {nivel.verificacoes.map((tipo) => {
                    const { curto, icone: Icone } = VERIFICACAO[tipo];

                    return (
                      <span
                        key={tipo}
                        className="bg-superficie-2 text-tinta-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                      >
                        <Icone className="size-3.5" aria-hidden="true" /> {curto}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </Cartao>

          <Cartao>
            <CabecalhoDoCartao
              titulo="Signatários"
              descricao={
                documento.ordemSequencial
                  ? 'Assinam na ordem abaixo.'
                  : 'Assinam em qualquer ordem.'
              }
            />
            <ol className="space-y-3">
              {documento.signatarios.map((s) => (
                <CartaoDoSignatario key={s.uuid} documento={documento} signatario={s} />
              ))}
            </ol>
          </Cartao>

          <TrilhaDoDocumento uuid={documento.uuid} />
        </div>

        <div className="space-y-6">
          {documento.hashAssinado && (
            <Abas
              rotulo="Versão do PDF"
              ativa={versao}
              aoMudar={definirVersao}
              abas={[
                { id: 'assinado', rotulo: 'PDF assinado', icone: <FileCheck2 /> },
                { id: 'original', rotulo: 'Original' },
              ]}
            />
          )}
          <VisualizadorDePdf
            key={versao}
            arquivo={apiDeDocumentos.urlDoArquivo(documento.uuid, versao)}
            alturaMaxima="70dvh"
          />

          <Cartao>
            <CabecalhoDoCartao
              titulo="Integridade"
              descricao="As impressões digitais que a validação pública confere."
            />
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-tinta-3 mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                  <Fingerprint className="size-3.5" aria-hidden="true" /> SHA-256 do original
                </dt>
                <dd>
                  <Hash valor={documento.hashOriginal} />
                </dd>
              </div>
              {documento.hashAssinado && (
                <div>
                  <dt className="text-tinta-3 mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                    <ShieldCheck className="size-3.5" aria-hidden="true" /> SHA-256 do PDF assinado
                  </dt>
                  <dd>
                    <Hash valor={documento.hashAssinado} />
                  </dd>
                </div>
              )}
              <div className="border-linha grid grid-cols-3 gap-3 border-t pt-4">
                <Info rotulo="Páginas" valor={String(documento.paginas)} />
                <Info rotulo="Tamanho" valor={formatarBytes(documento.tamanhoBytes)} />
                <Info rotulo="Selo" valor={documento.temSelo ? 'Ed25519 ✓' : '—'} />
              </div>
            </dl>
          </Cartao>
        </div>
      </div>

      <ModalDeCancelamento
        aberto={cancelando}
        aoFechar={() => definirCancelando(false)}
        uuid={documento.uuid}
        aoCancelar={atualizar}
      />
    </>
  );
}

function Info({ rotulo, valor }: { readonly rotulo: string; readonly valor: string }) {
  return (
    <div>
      <dt className="text-tinta-3 text-xs">{rotulo}</dt>
      <dd className="text-tinta mt-0.5 font-semibold numeros">{valor}</dd>
    </div>
  );
}

function AnelDeProgresso({
  assinados,
  total,
  concluido,
}: {
  readonly assinados: number;
  readonly total: number;
  readonly concluido: boolean;
}) {
  const fracao = total === 0 ? 0 : assinados / total;
  const circunferencia = 2 * Math.PI * 34;

  return (
    <div
      className="relative size-24 shrink-0"
      role="img"
      aria-label={`${assinados} de ${total} assinaturas`}
    >
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90">
        <circle
          cx="40"
          cy="40"
          r="34"
          className="stroke-superficie-3"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="40"
          cy="40"
          r="34"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          stroke={concluido ? 'var(--sucesso)' : 'url(#anel)'}
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - fracao)}
          className="transition-[stroke-dashoffset] duration-1000"
        />
        <defs>
          <linearGradient id="anel" x1="0" x2="1">
            <stop offset="0" stopColor="#4f46e5" />
            <stop offset="1" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        {concluido ? (
          <CheckCircle2 className="text-sucesso size-9" aria-hidden="true" />
        ) : (
          <span className="font-display text-tinta text-xl font-extrabold numeros">
            {Math.round(fracao * 100)}%
          </span>
        )}
      </span>
    </div>
  );
}

function CartaoDoSignatario({
  documento,
  signatario,
}: {
  readonly documento: DetalheDoDocumento;
  readonly signatario: SignatarioDoDetalhe;
}) {
  const [link, definirLink] = useState<string | null>(null);
  const reenviar = useMutation({
    mutationFn: () => apiDeDocumentos.reenviar(documento.uuid, signatario.uuid),
    onSuccess: (resposta) => {
      definirLink(resposta.link);
      toast.success(`Convite reenviado para ${signatario.email}. O link anterior deixou de valer.`);
    },
    onError: (e) => toast.error(mensagemDoErro(e)),
  });

  const quando = signatario.assinadoEm
    ? `Assinou ${formatarRelativo(signatario.assinadoEm)}`
    : signatario.recusadoEm
      ? `Recusou ${formatarRelativo(signatario.recusadoEm)}`
      : signatario.visualizadoEm
        ? `Abriu ${formatarRelativo(signatario.visualizadoEm)}`
        : documento.status === 'em_andamento'
          ? signatario.ehAVez
            ? 'Convite enviado — aguardando'
            : 'Aguardando a vez'
          : '—';

  return (
    <li
      className={cn(
        'rounded-2xl border p-4 transition',
        signatario.ehAVez ? 'border-alerta/40 bg-alerta-suave/30' : 'border-linha',
      )}
    >
      <div className="flex items-start gap-3.5">
        <div className="relative">
          <Avatar nome={signatario.nome} />
          <span className="bg-superficie text-tinta-3 ring-linha absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold ring-1 numeros">
            {signatario.ordem}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-tinta font-semibold">{signatario.nome}</p>
            <EtiquetaDoSignatario status={signatario.status} />
          </div>
          <p className="text-tinta-3 truncate text-sm">
            {signatario.email}
            {signatario.cpfMascarado && ` · CPF ${signatario.cpfMascarado}`}
          </p>
          <p className="text-tinta-2 mt-1 text-xs">{quando}</p>

          {documento.status !== 'rascunho' && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Verificações de identidade">
              {signatario.verificacoes.map((v) => {
                const { curto, icone: Icone } = VERIFICACAO[v.tipo];

                return (
                  <li
                    key={v.tipo}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      v.aprovada
                        ? 'bg-sucesso-suave text-sucesso-tinta'
                        : 'bg-superficie-2 text-tinta-3',
                    )}
                  >
                    <Icone className="size-3.5" aria-hidden="true" />
                    {curto}
                    {v.aprovada ? (
                      <CheckCircle2 className="size-3" aria-label="aprovada" />
                    ) : (
                      <span className="sr-only">pendente</span>
                    )}
                    {v.aprovada && v.pontuacao !== null && v.tipo !== 'codigo_email' && (
                      <span className="opacity-70 numeros">{Math.round(v.pontuacao * 100)}%</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {documento.podeGerenciar && signatario.ehAVez && (
          <Botao
            variante="secundario"
            tamanho="sm"
            icone={<RotateCw className="size-3.5" />}
            carregando={reenviar.isPending}
            onClick={() => reenviar.mutate()}
          >
            Reenviar
          </Botao>
        )}
      </div>

      {link && (
        <div className="border-linha bg-superficie mt-3 flex items-center gap-2 rounded-xl border p-2 pl-3">
          <Link2 className="text-tinta-3 size-4 shrink-0" aria-hidden="true" />
          <span className="text-tinta-2 min-w-0 flex-1 truncate font-mono text-xs">{link}</span>
          <Botao
            variante="fantasma"
            tamanho="sm"
            icone={<Copy className="size-3.5" />}
            onClick={() =>
              void navigator.clipboard
                .writeText(link)
                .then(() =>
                  toast.success('Link copiado. Ele é pessoal: envie só para esta pessoa.'),
                )
            }
          >
            Copiar
          </Botao>
        </div>
      )}
    </li>
  );
}

function TrilhaDoDocumento({ uuid }: { readonly uuid: string }) {
  const [expandida, definirExpandida] = useState(false);
  const consulta = useQuery({
    queryKey: ['documento', uuid, 'trilha'],
    queryFn: () => apiDeDocumentos.trilha(uuid),
  });

  return (
    <Cartao>
      <CabecalhoDoCartao
        titulo="Trilha de auditoria"
        descricao="Cada evento é encadeado ao anterior por hash SHA-256."
        acoes={
          consulta.data &&
          (consulta.data.integridade.integra ? (
            <span className="bg-sucesso-suave text-sucesso-tinta inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
              <ShieldCheck className="size-4" aria-hidden="true" /> Íntegra ·{' '}
              {consulta.data.integridade.total} eventos
            </span>
          ) : (
            <span className="bg-perigo-suave text-perigo-tinta inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
              <ShieldAlert className="size-4" aria-hidden="true" /> Quebrada no evento{' '}
              {consulta.data.integridade.quebraEm}
            </span>
          ))
        }
      />
      {consulta.isPending && <Esqueleto className="h-40" />}
      {consulta.isError && <EstadoDeErro erro={consulta.error} />}
      {consulta.data && (
        <>
          <ol className="relative space-y-4 pl-6">
            <span
              aria-hidden="true"
              className="bg-linha absolute top-1.5 bottom-1.5 left-[7px] w-px"
            />
            {(expandida ? consulta.data.eventos : consulta.data.eventos.slice(-6)).map((e) => (
              <li key={e.sequencia} className="relative">
                <span
                  aria-hidden="true"
                  className={cn(
                    'ring-superficie absolute top-1 -left-6 size-3.5 rounded-full ring-4',
                    e.acao === 'documento_concluido'
                      ? 'bg-sucesso'
                      : e.tipoAtor === 'signatario'
                        ? 'bg-destaque'
                        : 'bg-linha-forte',
                  )}
                />
                <p className="text-tinta text-sm">{e.resumo}</p>
                <p className="text-tinta-3 mt-0.5 flex flex-wrap gap-x-2 text-xs">
                  <span>#{e.sequencia}</span>
                  <span>{formatarDataHora(e.criadoEm)}</span>
                  {e.ip && <span>IP {e.ip}</span>}
                  <span className="font-mono" title={e.hash}>
                    {e.hash.slice(0, 12)}…
                  </span>
                </p>
              </li>
            ))}
          </ol>
          {consulta.data.eventos.length > 6 && (
            <button
              type="button"
              onClick={() => definirExpandida(!expandida)}
              className="text-destaque mt-4 text-sm font-semibold hover:underline"
            >
              {expandida
                ? 'Mostrar só os recentes'
                : `Ver todos os ${consulta.data.eventos.length} eventos`}
            </button>
          )}
        </>
      )}
    </Cartao>
  );
}

function ModalDeCancelamento({
  aberto,
  aoFechar,
  uuid,
  aoCancelar,
}: {
  readonly aberto: boolean;
  readonly aoFechar: () => void;
  readonly uuid: string;
  readonly aoCancelar: () => Promise<void>;
}) {
  const [motivo, definirMotivo] = useState('');
  const cancelar = useMutation({
    mutationFn: () => apiDeDocumentos.cancelar(uuid, motivo.trim()),
    onSuccess: async () => {
      await aoCancelar();
      toast.success('Documento cancelado. Os links de assinatura deixaram de valer.');
      aoFechar();
    },
    onError: (e) => toast.error(mensagemDoErro(e)),
  });

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Cancelar documento"
      descricao="Quem ainda não assinou não poderá mais assinar. O motivo fica registrado na trilha de auditoria."
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>
            Voltar
          </Botao>
          <Botao
            variante="perigo"
            disabled={motivo.trim().length < 5}
            carregando={cancelar.isPending}
            onClick={() => cancelar.mutate()}
          >
            Cancelar documento
          </Botao>
        </>
      }
    >
      <Campo rotulo="Motivo do cancelamento" dica="Pelo menos 5 caracteres.">
        <AreaDeTexto
          value={motivo}
          maxLength={500}
          onChange={(e) => definirMotivo(e.target.value)}
          placeholder="Ex.: as condições foram renegociadas e uma nova versão será enviada."
        />
      </Campo>
    </Modal>
  );
}
