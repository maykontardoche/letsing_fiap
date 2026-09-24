import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  Ban,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Hourglass,
  Link2Off,
  Lock,
  PenLine,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Logo } from '@/components/marca/Logo';
import { VisualizadorDePdf } from '@/components/pdf/VisualizadorDePdf';
import { Botao, estilosDeBotao } from '@/components/ui/Botao';
import { Cartao } from '@/components/ui/Cartao';
import { AreaDeTexto, Campo, Entrada } from '@/components/ui/Campo';
import { Avatar } from '@/components/ui/Diversos';
import { Alerta, Carregando, Esqueleto } from '@/components/ui/Estados';
import { EtiquetaDoSignatario } from '@/components/ui/EtiquetaDeStatus';
import { Modal } from '@/components/ui/Modal';
import { NIVEIS, VERIFICACAO } from '@/constants/status';
import { apiDeAssinatura, type SessaoDeAssinatura } from '@/lib/api/assinatura';
import type { TipoDeVerificacao } from '@/lib/api/documentos';
import { ErroDaApi, mensagemDoErro } from '@/lib/erros';
import { cn } from '@/lib/cn';
import { formatarDataHora, formatarDataHoraLonga, mascararCpf } from '@/lib/formatadores';
import { PadDeAssinatura, type ControleDoPad } from './PadDeAssinatura';
import { VerificacaoCodigo } from './VerificacaoCodigo';
import { VerificacaoFacial } from './VerificacaoFacial';
import { VerificacaoGestos } from './VerificacaoGestos';
import { VerificacaoVoz } from './VerificacaoVoz';

type Etapa = 'revisar' | 'verificar' | 'assinar';

/**
 * A experiência de quem assina — **sem conta**, pelo link do convite.
 *
 * Revisar o documento → provar a identidade (as verificações do nível, em ordem)
 * → assinar (rubrica + concordância) → concluído, com o PDF assinado quando todos
 * terminarem. Cada passo é validado de novo no servidor: a tela só conduz.
 */
export function AssinarPage() {
  const { token = '' } = useParams();
  const api = useMemo(() => apiDeAssinatura(token), [token]);
  const consulta = useQuery({
    queryKey: ['assinatura', token],
    queryFn: api.sessao,
    retry: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    document.title = consulta.data
      ? `Assinar: ${consulta.data.documento.titulo} · LetsSign`
      : 'Assinatura · LetsSign';
  }, [consulta.data]);

  return (
    <div className="bg-fundo min-h-dvh">
      <header className="border-linha bg-superficie/85 sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="LetsSign">
            <Logo />
          </Link>
          <span className="text-sucesso-tinta bg-sucesso-suave inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
            <Lock className="size-3.5" aria-hidden="true" /> Ambiente seguro
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {consulta.isPending && (
          <Carregando rotulo="Carregando o documento…">
            <Esqueleto className="mb-4 h-8 w-80" />
            <Esqueleto className="h-[60vh] rounded-[var(--radius-cartao)]" />
          </Carregando>
        )}
        {consulta.isError && <LinkInvalido erro={consulta.error} />}
        {consulta.data && <Fluxo sessao={consulta.data} api={api} token={token} />}
      </main>
    </div>
  );
}

function Fluxo({
  sessao,
  api,
  token,
}: {
  readonly sessao: SessaoDeAssinatura;
  readonly api: ReturnType<typeof apiDeAssinatura>;
  readonly token: string;
}) {
  const clienteDeQuery = useQueryClient();
  const [etapa, definirEtapa] = useState<Etapa>('revisar');
  const [concluiuAgora, definirConcluiuAgora] = useState<{ documentoConcluido: boolean } | null>(
    null,
  );
  const recarregar = useCallback(
    () => clienteDeQuery.invalidateQueries({ queryKey: ['assinatura', token] }),
    [clienteDeQuery, token],
  );
  const { documento, signatario } = sessao;

  if (concluiuAgora || signatario.status === 'assinado') {
    return (
      <Concluido
        sessao={sessao}
        api={api}
        documentoConcluido={concluiuAgora?.documentoConcluido ?? documento.temPdfAssinado}
      />
    );
  }

  if (signatario.status === 'recusado') {
    return (
      <Encerrado
        icone={<XCircle />}
        titulo="Você recusou este documento"
        texto="Quem enviou foi avisado. Se foi engano, peça um novo envio."
      />
    );
  }

  if (documento.status === 'cancelado') {
    return (
      <Encerrado
        icone={<Ban />}
        titulo="Este documento foi cancelado"
        texto={`${documento.remetente} cancelou o envio. Não é mais possível assinar.`}
      />
    );
  }

  if (documento.status === 'expirado') {
    return (
      <Encerrado
        icone={<Hourglass />}
        titulo="O prazo para assinar terminou"
        texto={`Fale com ${documento.remetente} para receber um novo envio.`}
      />
    );
  }

  if (documento.status === 'recusado') {
    return (
      <Encerrado
        icone={<XCircle />}
        titulo="Este documento foi encerrado"
        texto="Outro signatário recusou a assinatura."
      />
    );
  }

  if (!sessao.ehSuaVez) {
    return (
      <Encerrado
        icone={<Clock3 />}
        titulo="Ainda não é a sua vez"
        texto="Este documento é assinado em ordem. Você receberá um e-mail quando chegar a sua vez."
      >
        <Participantes sessao={sessao} />
      </Encerrado>
    );
  }

  const pendentes = sessao.verificacoes.filter((v) => !v.aprovada);

  return (
    <>
      <div className="mb-6">
        <p className="text-tinta-3 text-sm">
          {documento.remetente} · {documento.organizacao} pediu sua assinatura
        </p>
        <h1 className="text-tinta mt-1 text-2xl font-extrabold sm:text-3xl">{documento.titulo}</h1>
      </div>

      <IndicadorDeEtapas etapa={etapa} />

      {etapa === 'revisar' && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <VisualizadorDePdf
            arquivo={api.urlDoArquivo('original')}
            alturaMaxima="calc(100dvh - 17rem)"
          />
          <div className="space-y-5">
            <Cartao>
              <p className="text-tinta-3 text-xs font-semibold tracking-wide uppercase">
                Olá, {signatario.nome.split(' ')[0]}
              </p>
              {documento.mensagem && (
                <blockquote className="border-destaque text-tinta-2 mt-3 border-l-2 pl-3 text-sm italic">
                  “{documento.mensagem}”
                </blockquote>
              )}
              <dl className="mt-5 space-y-3 text-sm">
                <Linha
                  rotulo="Código"
                  valor={<span className="font-mono">{documento.codigo}</span>}
                />
                <Linha rotulo="Páginas" valor={String(documento.paginas)} />
                {documento.prazo && (
                  <Linha rotulo="Prazo" valor={formatarDataHora(documento.prazo)} />
                )}
                <Linha rotulo="Verificação" valor={NIVEIS[documento.nivelVerificacao].rotulo} />
              </dl>
              <div className="border-linha mt-5 border-t pt-5">
                <p className="text-tinta mb-3 text-sm font-semibold">
                  Para assinar, você vai confirmar sua identidade com:
                </p>
                <ul className="space-y-2">
                  {sessao.verificacoes.map(({ tipo, aprovada }) => {
                    const { rotulo, icone: Icone } = VERIFICACAO[tipo];

                    return (
                      <li key={tipo} className="text-tinta-2 flex items-center gap-2.5 text-sm">
                        <Icone
                          className={cn('size-4', aprovada ? 'text-sucesso' : 'text-destaque')}
                          aria-hidden="true"
                        />
                        {rotulo}
                        {aprovada && (
                          <CheckCircle2 className="text-sucesso size-4" aria-label="concluída" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <Botao
                tamanho="lg"
                className="mt-6 w-full"
                onClick={() => definirEtapa(pendentes.length > 0 ? 'verificar' : 'assinar')}
              >
                Li o documento — continuar
              </Botao>
              <BotaoDeRecusa api={api} aoRecusar={recarregar} />
            </Cartao>
            <Cartao>
              <Participantes sessao={sessao} />
            </Cartao>
          </div>
        </div>
      )}

      {etapa === 'verificar' && (
        <Verificacoes
          sessao={sessao}
          api={api}
          aoConcluirTodas={async () => {
            await recarregar();
            definirEtapa('assinar');
          }}
          aoAprovarUma={recarregar}
        />
      )}

      {etapa === 'assinar' && (
        <EtapaDeAssinatura
          sessao={sessao}
          api={api}
          aoAssinar={(concluido) => definirConcluiuAgora({ documentoConcluido: concluido })}
          aoVoltar={() => definirEtapa('revisar')}
        />
      )}
    </>
  );
}

function IndicadorDeEtapas({ etapa }: { readonly etapa: Etapa }) {
  const etapas: { id: Etapa; rotulo: string }[] = [
    { id: 'revisar', rotulo: 'Revisar' },
    { id: 'verificar', rotulo: 'Confirmar identidade' },
    { id: 'assinar', rotulo: 'Assinar' },
  ];
  const posicao = etapas.findIndex((e) => e.id === etapa);

  return (
    <ol className="mb-8 flex items-center gap-2 sm:gap-4" aria-label="Etapas da assinatura">
      {etapas.map((e, i) => (
        <li
          key={e.id}
          aria-current={i === posicao ? 'step' : undefined}
          className="flex flex-1 items-center gap-2 sm:gap-3"
        >
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition',
              i < posicao
                ? 'bg-sucesso text-white'
                : i === posicao
                  ? 'bg-gradiente-marca-texto text-white shadow-brilho'
                  : 'bg-superficie-3 text-tinta-3',
            )}
          >
            {i < posicao ? <CheckCircle2 className="size-4" aria-hidden="true" /> : i + 1}
          </span>
          <span
            className={cn(
              'hidden text-sm font-semibold sm:inline',
              i === posicao ? 'text-tinta' : 'text-tinta-3',
            )}
          >
            {e.rotulo}
          </span>
          {i < etapas.length - 1 && (
            <span
              className={cn(
                'h-0.5 flex-1 rounded-full',
                i < posicao ? 'bg-sucesso' : 'bg-superficie-3',
              )}
            />
          )}
        </li>
      ))}
    </ol>
  );
}

function Verificacoes({
  sessao,
  api,
  aoConcluirTodas,
  aoAprovarUma,
}: {
  readonly sessao: SessaoDeAssinatura;
  readonly api: ReturnType<typeof apiDeAssinatura>;
  readonly aoConcluirTodas: () => Promise<void>;
  readonly aoAprovarUma: () => Promise<void>;
}) {
  const [aprovadas, definirAprovadas] = useState<Set<TipoDeVerificacao>>(
    () => new Set(sessao.verificacoes.filter((v) => v.aprovada).map((v) => v.tipo)),
  );
  const ordem = sessao.verificacoes.map((v) => v.tipo);
  const atual = ordem.find((tipo) => !aprovadas.has(tipo));

  const aprovar = async (tipo: TipoDeVerificacao) => {
    const novas = new Set(aprovadas).add(tipo);

    definirAprovadas(novas);
    await aoAprovarUma();

    if (ordem.every((t) => novas.has(t))) await aoConcluirTodas();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <ol className="space-y-2" aria-label="Verificações de identidade">
        {ordem.map((tipo, i) => {
          const { rotulo, icone: Icone } = VERIFICACAO[tipo];
          const feita = aprovadas.has(tipo);
          const ativa = tipo === atual;

          return (
            <li
              key={tipo}
              aria-current={ativa ? 'step' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-2xl border p-3.5 transition',
                ativa
                  ? 'border-destaque bg-destaque-suave/60'
                  : feita
                    ? 'border-sucesso/30 bg-sucesso-suave/50'
                    : 'border-linha bg-superficie opacity-70',
              )}
            >
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-xl',
                  feita
                    ? 'bg-sucesso text-white'
                    : ativa
                      ? 'bg-destaque text-white'
                      : 'bg-superficie-3 text-tinta-3',
                )}
              >
                {feita ? (
                  <CheckCircle2 className="size-5" aria-hidden="true" />
                ) : (
                  <Icone className="size-5" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0">
                <span className="text-tinta-3 block text-xs numeros">Etapa {i + 1}</span>
                <span className="text-tinta block text-sm font-semibold">{rotulo}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <Cartao>
        {atual === undefined ? (
          <p className="text-sucesso-tinta flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-5" /> Identidade confirmada
          </p>
        ) : (
          <motion.div
            key={atual}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-tinta mb-1 text-xl font-bold">{VERIFICACAO[atual].rotulo}</h2>
            <p className="text-tinta-2 mb-6 text-sm">{DESCRICOES[atual]}</p>
            {atual === 'codigo_email' && (
              <VerificacaoCodigo
                api={api}
                emailMascarado={sessao.signatario.emailMascarado}
                aoAprovar={() => void aprovar('codigo_email')}
              />
            )}
            {atual === 'facial' && (
              <VerificacaoFacial api={api} aoAprovar={() => void aprovar('facial')} />
            )}
            {atual === 'voz' && <VerificacaoVoz api={api} aoAprovar={() => void aprovar('voz')} />}
            {atual === 'gestos' && (
              <VerificacaoGestos api={api} aoAprovar={() => void aprovar('gestos')} />
            )}
          </motion.div>
        )}
      </Cartao>
    </div>
  );
}

const DESCRICOES: Record<TipoDeVerificacao, string> = {
  codigo_email: 'Confirmamos que você tem acesso ao e-mail para onde o convite foi enviado.',
  facial:
    'Uma prova de vida: detectamos seu rosto e pedimos ações aleatórias, para garantir que é uma pessoa real, agora.',
  voz: 'Você fala em voz alta palavras sorteadas agora pelo servidor — uma gravação antiga não serviria.',
  gestos:
    'Uma sequência de gestos com a mão, sorteada a cada tentativa e reconhecida por visão computacional.',
};

function EtapaDeAssinatura({
  sessao,
  api,
  aoAssinar,
  aoVoltar,
}: {
  readonly sessao: SessaoDeAssinatura;
  readonly api: ReturnType<typeof apiDeAssinatura>;
  readonly aoAssinar: (concluido: boolean) => void;
  readonly aoVoltar: () => void;
}) {
  const pad = useRef<ControleDoPad>(null);
  const [preenchido, definirPreenchido] = useState(false);
  const [aceite, definirAceite] = useState(false);
  const [cpf, definirCpf] = useState('');
  const [enviando, definirEnviando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  const assinar = async () => {
    definirErro(null);

    const rubrica = await pad.current?.exportar();

    if (!rubrica) {
      definirErro('Desenhe ou digite sua assinatura.');
      return;
    }

    definirEnviando(true);

    try {
      const { concluido } = await api.assinar({
        tipo: rubrica.tipo,
        imagem: rubrica.imagem,
        aceite: true,
        ...(cpf.trim() ? { cpf } : {}),
      });

      aoAssinar(concluido);
    } catch (causa) {
      definirErro(mensagemDoErro(causa));
    } finally {
      definirEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Cartao>
        <h2 className="text-tinta text-xl font-bold">Sua assinatura</h2>
        <p className="text-tinta-2 mt-1 mb-6 text-sm">
          Identidade confirmada. Agora desenhe ou digite sua rubrica para concluir.
        </p>

        <PadDeAssinatura ref={pad} nome={sessao.signatario.nome} aoMudar={definirPreenchido} />

        {!sessao.signatario.cpfInformado && (
          <Campo
            rotulo="CPF"
            opcional
            className="mt-5"
            dica="Se informado, aparece mascarado no manifesto (•••.•••.•••-00) e fica cifrado no servidor."
          >
            <Entrada
              inputMode="numeric"
              value={cpf}
              placeholder="000.000.000-00"
              onChange={(e) => definirCpf(mascararCpf(e.target.value))}
            />
          </Campo>
        )}

        <label className="border-linha bg-superficie-2/60 mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm">
          <input
            type="checkbox"
            className="accent-brand-600 mt-0.5 size-4 shrink-0"
            checked={aceite}
            onChange={(e) => definirAceite(e.target.checked)}
          />
          <span className="text-tinta-2">
            Li o documento <strong className="text-tinta">“{sessao.documento.titulo}”</strong> e
            concordo com o seu conteúdo. Reconheço esta assinatura eletrônica como válida, nos
            termos da Lei 14.063/2020.
          </span>
        </label>

        {erro && (
          <Alerta tom="perigo" className="mt-5">
            {erro}
          </Alerta>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Botao variante="fantasma" onClick={aoVoltar}>
            Rever o documento
          </Botao>
          <Botao
            tamanho="lg"
            icone={<PenLine className="size-4" />}
            disabled={!aceite || !preenchido}
            carregando={enviando}
            onClick={() => void assinar()}
          >
            Assinar documento
          </Botao>
        </div>

        <p className="text-tinta-3 mt-5 flex items-start gap-2 text-xs">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Ao assinar, registramos data, hora, IP e as verificações que você concluiu, e a plataforma
          gera uma assinatura digital Ed25519 amarrada ao hash deste PDF.
        </p>
      </Cartao>
    </div>
  );
}

function Concluido({
  sessao,
  api,
  documentoConcluido,
}: {
  readonly sessao: SessaoDeAssinatura;
  readonly api: ReturnType<typeof apiDeAssinatura>;
  readonly documentoConcluido: boolean;
}) {
  return (
    <div className="mx-auto max-w-xl py-6 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
        className="relative mx-auto size-28"
      >
        <span
          aria-hidden="true"
          className="bg-sucesso/25 absolute inset-0 animate-ping rounded-full"
        />
        <span className="bg-sucesso relative flex size-28 items-center justify-center rounded-full text-white shadow-[0_20px_50px_-12px_rgba(16,185,129,0.6)]">
          <CheckCircle2 className="size-14" aria-hidden="true" />
        </span>
      </motion.div>
      <h1 className="text-tinta mt-8 text-3xl font-extrabold">Assinatura registrada!</h1>
      <p className="text-tinta-2 mt-3">
        Obrigado, {sessao.signatario.nome.split(' ')[0]}. Sua assinatura em{' '}
        <strong className="text-tinta">“{sessao.documento.titulo}”</strong> foi registrada
        {sessao.signatario.assinadoEm
          ? ` em ${formatarDataHoraLonga(sessao.signatario.assinadoEm)}`
          : ''}{' '}
        e selada criptograficamente.
      </p>

      {documentoConcluido ? (
        <Cartao className="mt-8 text-left">
          <p className="text-tinta flex items-center gap-2 font-semibold">
            <ShieldCheck className="text-sucesso size-5" /> Todos assinaram
          </p>
          <p className="text-tinta-2 mt-1 text-sm">
            O PDF final tem o manifesto de assinaturas, o QR Code de validação e as evidências
            criptográficas. Também enviamos uma cópia para o seu e-mail.
          </p>
          <a
            href={api.urlDoArquivo('assinado', true)}
            className={cn(estilosDeBotao('primario', 'lg'), 'mt-5 w-full')}
          >
            <Download className="size-4" aria-hidden="true" /> Baixar documento assinado
          </a>
        </Cartao>
      ) : (
        <Alerta tom="info" className="mt-8 text-left" titulo="Aguardando as demais assinaturas">
          Quando todos assinarem, você recebe o PDF final por e-mail.
        </Alerta>
      )}

      <Link
        to={`/validar/${sessao.documento.codigo}`}
        className="text-destaque mt-6 inline-block text-sm font-semibold hover:underline"
      >
        Ver a página pública de validação →
      </Link>
    </div>
  );
}

function Encerrado({
  icone,
  titulo,
  texto,
  children,
}: {
  readonly icone: ReactNode;
  readonly titulo: string;
  readonly texto: string;
  readonly children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <span className="bg-superficie-2 text-tinta-2 mx-auto flex size-16 items-center justify-center rounded-2xl [&_svg]:size-8">
        {icone}
      </span>
      <h1 className="text-tinta mt-6 text-2xl font-extrabold">{titulo}</h1>
      <p className="text-tinta-2 mt-2">{texto}</p>
      {children && <Cartao className="mt-8 text-left">{children}</Cartao>}
    </div>
  );
}

function LinkInvalido({ erro }: { readonly erro: unknown }) {
  return (
    <Encerrado
      icone={<Link2Off />}
      titulo={
        erro instanceof ErroDaApi && erro.status === 404
          ? 'Link inválido ou expirado'
          : 'Não foi possível abrir o documento'
      }
      texto={mensagemDoErro(erro)}
    />
  );
}

function Participantes({ sessao }: { readonly sessao: SessaoDeAssinatura }) {
  return (
    <>
      <p className="text-tinta mb-3 flex items-center gap-2 text-sm font-semibold">
        <FileText className="text-destaque size-4" aria-hidden="true" /> Quem assina{' '}
        {sessao.documento.ordemSequencial && (
          <span className="text-tinta-3 font-normal">(em ordem)</span>
        )}
      </p>
      <ul className="space-y-2.5">
        {sessao.participantes.map((p) => (
          <li key={p.ordem} className="flex items-center gap-3">
            <Avatar nome={p.nome} tamanho="sm" />
            <span className="text-tinta min-w-0 flex-1 truncate text-sm">
              {p.nome}{' '}
              {p.voce && <span className="text-destaque-tinta text-xs font-semibold">(você)</span>}
            </span>
            <EtiquetaDoSignatario status={p.status} />
          </li>
        ))}
      </ul>
    </>
  );
}

function BotaoDeRecusa({
  api,
  aoRecusar,
}: {
  readonly api: ReturnType<typeof apiDeAssinatura>;
  readonly aoRecusar: () => Promise<void>;
}) {
  const [aberto, definirAberto] = useState(false);
  const [motivo, definirMotivo] = useState('');
  const [enviando, definirEnviando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  const recusar = async () => {
    definirEnviando(true);

    try {
      await api.recusar(motivo.trim());
      definirAberto(false);
      await aoRecusar();
    } catch (causa) {
      definirErro(mensagemDoErro(causa));
    } finally {
      definirEnviando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => definirAberto(true)}
        className="text-tinta-3 hover:text-perigo-tinta mt-3 w-full text-center text-sm font-medium transition"
      >
        Não concordo — recusar assinatura
      </button>
      <Modal
        aberto={aberto}
        aoFechar={() => definirAberto(false)}
        titulo="Recusar a assinatura?"
        descricao="O documento será encerrado para todos, e quem enviou recebe o seu motivo."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => definirAberto(false)}>
              Voltar
            </Botao>
            <Botao
              variante="perigo"
              disabled={motivo.trim().length < 5}
              carregando={enviando}
              onClick={() => void recusar()}
            >
              Recusar
            </Botao>
          </>
        }
      >
        {erro && (
          <Alerta tom="perigo" className="mb-4">
            {erro}
          </Alerta>
        )}
        <Campo rotulo="Motivo" dica="Pelo menos 5 caracteres.">
          <AreaDeTexto
            value={motivo}
            maxLength={500}
            onChange={(e) => definirMotivo(e.target.value)}
            placeholder="Ex.: o valor da cláusula 4 não é o que combinamos."
          />
        </Campo>
      </Modal>
    </>
  );
}

function Linha({ rotulo, valor }: { readonly rotulo: string; readonly valor: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-tinta-3">{rotulo}</dt>
      <dd className="text-tinta text-right font-medium">{valor}</dd>
    </div>
  );
}
