import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarClock,
  Check,
  ListOrdered,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePerfil } from '@/app/providers/sessao-contexto';
import { useConfirmacao } from '@/app/providers/ConfirmacaoProvider';
import { CabecalhoDaPagina } from '@/components/layout/CabecalhoDaPagina';
import { VisualizadorDePdf } from '@/components/pdf/VisualizadorDePdf';
import { Botao } from '@/components/ui/Botao';
import { Cartao, CabecalhoDoCartao } from '@/components/ui/Cartao';
import { Campo, Entrada } from '@/components/ui/Campo';
import { Avatar } from '@/components/ui/Diversos';
import { Alerta, Carregando, EstadoDeErro, Esqueleto } from '@/components/ui/Estados';
import { NIVEIS, VERIFICACAO } from '@/constants/status';
import {
  apiDeDocumentos,
  type DetalheDoDocumento,
  type NivelDeVerificacao,
} from '@/lib/api/documentos';
import { mensagemDoErro } from '@/lib/erros';
import { cn } from '@/lib/cn';
import { formatarData, mascararCpf } from '@/lib/formatadores';
import { EtapasDoEnvio } from './EtapasDoEnvio';

interface Linha {
  readonly chave: string;
  nome: string;
  email: string;
  cpf: string;
}

const novaLinha = (dados: Partial<Linha> = {}): Linha => ({
  chave: crypto.randomUUID(),
  nome: '',
  email: '',
  cpf: '',
  ...dados,
});

export function PrepararDocumentoPage() {
  const { uuid = '' } = useParams();
  const [parametros, definirParametros] = useSearchParams();
  const etapa = (Number(parametros.get('etapa')) || 2) as 2 | 3 | 4;
  const consulta = useQuery({
    queryKey: ['documento', uuid],
    queryFn: () => apiDeDocumentos.detalhe(uuid),
  });

  const irPara = (proxima: 2 | 3 | 4) => definirParametros({ etapa: String(proxima) });

  if (consulta.isPending) {
    return (
      <Carregando>
        <Esqueleto className="mb-6 h-10 w-72" />
        <Esqueleto className="h-96 rounded-[var(--radius-cartao)]" />
      </Carregando>
    );
  }

  if (consulta.isError)
    return (
      <Cartao>
        <EstadoDeErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />
      </Cartao>
    );

  const documento = consulta.data;

  // Depois de enviado, não há o que preparar: o lugar é o detalhe.
  if (documento.status !== 'rascunho') return <Navigate to={`/app/documentos/${uuid}`} replace />;

  return (
    <>
      <CabecalhoDaPagina
        titulo={documento.titulo}
        descricao={<span className="font-mono text-sm">{documento.codigo} · rascunho</span>}
        trilha={[
          { rotulo: 'Documentos', para: '/app/documentos' },
          { rotulo: documento.titulo, para: `/app/documentos/${uuid}` },
          { rotulo: 'Preparar' },
        ]}
      />
      <EtapasDoEnvio atual={etapa} />

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div>
          {etapa === 2 && <EtapaSignatarios documento={documento} aoAvancar={() => irPara(3)} />}
          {etapa === 3 && (
            <EtapaConfiguracao
              documento={documento}
              aoVoltar={() => irPara(2)}
              aoAvancar={() => irPara(4)}
            />
          )}
          {etapa === 4 && <EtapaRevisao documento={documento} aoVoltar={() => irPara(3)} />}
        </div>
        <div className="hidden xl:block">
          <VisualizadorDePdf
            arquivo={apiDeDocumentos.urlDoArquivo(uuid, 'original')}
            alturaMaxima="calc(100dvh - 18rem)"
          />
        </div>
      </div>
    </>
  );
}

function EtapaSignatarios({
  documento,
  aoAvancar,
}: {
  readonly documento: DetalheDoDocumento;
  readonly aoAvancar: () => void;
}) {
  const perfil = usePerfil();
  const clienteDeQuery = useQueryClient();
  const [linhas, definirLinhas] = useState<Linha[]>(() =>
    documento.signatarios.length > 0
      ? documento.signatarios.map((s) => novaLinha({ nome: s.nome, email: s.email }))
      : [novaLinha()],
  );
  const [erro, definirErro] = useState<string | null>(null);

  const salvar = useMutation({
    mutationFn: () =>
      apiDeDocumentos.definirSignatarios(
        documento.uuid,
        linhas.map((l) => ({
          nome: l.nome.trim(),
          email: l.email.trim().toLowerCase(),
          ...(l.cpf.trim() ? { cpf: l.cpf } : {}),
        })),
      ),
    onSuccess: (atualizado) => {
      clienteDeQuery.setQueryData(['documento', documento.uuid], atualizado);
      aoAvancar();
    },
    onError: (causa) => definirErro(mensagemDoErro(causa)),
  });

  const atualizar = (chave: string, campo: 'nome' | 'email' | 'cpf', valor: string) =>
    definirLinhas((atuais) =>
      atuais.map((l) =>
        l.chave === chave ? { ...l, [campo]: campo === 'cpf' ? mascararCpf(valor) : valor } : l,
      ),
    );

  const mover = (indice: number, direcao: -1 | 1) =>
    definirLinhas((atuais) => {
      const copia = [...atuais];
      const alvo = indice + direcao;

      [copia[indice], copia[alvo]] = [copia[alvo], copia[indice]];

      return copia;
    });

  const incluirEu = () => {
    if (linhas.some((l) => l.email.toLowerCase() === perfil.email)) return;

    definirLinhas((atuais) => [
      ...atuais.filter((l) => l.nome || l.email),
      novaLinha({ nome: perfil.nome, email: perfil.email }),
    ]);
  };

  const validas = linhas.every(
    (l) => l.nome.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(l.email.trim()),
  );

  return (
    <Cartao>
      <CabecalhoDoCartao
        titulo="Quem vai assinar?"
        descricao="A ordem da lista é a ordem de assinatura, quando ela for sequencial."
        acoes={
          <Botao
            variante="secundario"
            tamanho="sm"
            icone={<UserPlus className="size-4" />}
            onClick={incluirEu}
          >
            Incluir eu
          </Botao>
        }
      />

      {erro && (
        <Alerta tom="perigo" className="mb-5">
          {erro}
        </Alerta>
      )}

      <ol className="space-y-3">
        {linhas.map((linha, indice) => (
          <li
            key={linha.chave}
            className="border-linha bg-superficie-2/40 animate-surgir rounded-2xl border p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-tinta-2 flex items-center gap-2.5 text-sm font-semibold">
                <span className="bg-destaque-suave text-destaque-tinta flex size-6 items-center justify-center rounded-full text-xs numeros">
                  {indice + 1}
                </span>
                {linha.nome.trim() ? <Avatar nome={linha.nome} tamanho="sm" /> : null}
                {linha.nome.trim() || `Signatário ${indice + 1}`}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Mover para cima"
                  disabled={indice === 0}
                  onClick={() => mover(indice, -1)}
                  className="text-tinta-3 hover:bg-superficie-3 hover:text-tinta rounded-lg p-1.5 disabled:opacity-30"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Mover para baixo"
                  disabled={indice === linhas.length - 1}
                  onClick={() => mover(indice, 1)}
                  className="text-tinta-3 hover:bg-superficie-3 hover:text-tinta rounded-lg p-1.5 disabled:opacity-30"
                >
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Remover ${linha.nome || 'signatário'}`}
                  disabled={linhas.length === 1}
                  onClick={() =>
                    definirLinhas((atuais) => atuais.filter((l) => l.chave !== linha.chave))
                  }
                  className="text-tinta-3 hover:bg-perigo-suave hover:text-perigo-tinta rounded-lg p-1.5 disabled:opacity-30"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr_0.8fr]">
              <Campo rotulo="Nome completo">
                <Entrada
                  value={linha.nome}
                  autoComplete="off"
                  placeholder="Maria da Silva"
                  onChange={(e) => atualizar(linha.chave, 'nome', e.target.value)}
                />
              </Campo>
              <Campo rotulo="E-mail">
                <Entrada
                  type="email"
                  value={linha.email}
                  autoComplete="off"
                  placeholder="maria@empresa.com"
                  onChange={(e) => atualizar(linha.chave, 'email', e.target.value)}
                />
              </Campo>
              <Campo rotulo="CPF" opcional>
                <Entrada
                  inputMode="numeric"
                  value={linha.cpf}
                  placeholder="000.000.000-00"
                  onChange={(e) => atualizar(linha.chave, 'cpf', e.target.value)}
                />
              </Campo>
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        disabled={linhas.length >= 20}
        onClick={() => definirLinhas((atuais) => [...atuais, novaLinha()])}
        className="border-linha-forte text-tinta-2 hover:border-destaque hover:text-destaque mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-3 text-sm font-semibold transition disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden="true" /> Adicionar signatário
      </button>

      <p className="text-tinta-3 mt-4 text-xs">
        O CPF é cifrado (AES-256-GCM) antes de ser gravado; só os dois últimos dígitos aparecem no
        manifesto.
      </p>

      <div className="mt-6 flex justify-between">
        <Link
          to="/app/documentos"
          className="text-tinta-2 hover:text-tinta inline-flex items-center gap-1.5 text-sm font-medium"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Salvar e sair
        </Link>
        <Botao
          tamanho="lg"
          disabled={!validas}
          carregando={salvar.isPending}
          onClick={() => salvar.mutate()}
        >
          Continuar
        </Botao>
      </div>
    </Cartao>
  );
}

function EtapaConfiguracao({
  documento,
  aoVoltar,
  aoAvancar,
}: {
  readonly documento: DetalheDoDocumento;
  readonly aoVoltar: () => void;
  readonly aoAvancar: () => void;
}) {
  const clienteDeQuery = useQueryClient();
  const [nivel, definirNivel] = useState<NivelDeVerificacao>(documento.nivelVerificacao);
  const [sequencial, definirSequencial] = useState(documento.ordemSequencial);
  const [prazo, definirPrazo] = useState(documento.prazo ? documento.prazo.slice(0, 10) : '');
  const [erro, definirErro] = useState<string | null>(null);
  // Inicializador preguiçoso: ler o relógio no corpo do render o tornaria impuro.
  const [amanha] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));

  const salvar = useMutation({
    mutationFn: () =>
      apiDeDocumentos.atualizar(documento.uuid, {
        nivelVerificacao: nivel,
        ordemSequencial: sequencial,
        // Fim do dia em Brasília: "prazo dia 30" quer dizer "até o fim do dia 30".
        prazo: prazo ? new Date(`${prazo}T23:59:00-03:00`).toISOString() : null,
      }),
    onSuccess: (atualizado) => {
      clienteDeQuery.setQueryData(['documento', documento.uuid], atualizado);
      aoAvancar();
    },
    onError: (causa) => definirErro(mensagemDoErro(causa)),
  });

  return (
    <Cartao>
      <CabecalhoDoCartao
        titulo="Como comprovar a identidade?"
        descricao="Quanto mais alto o nível, mais forte a prova de que foi a própria pessoa que assinou."
      />
      {erro && (
        <Alerta tom="perigo" className="mb-5">
          {erro}
        </Alerta>
      )}

      <div role="radiogroup" aria-label="Nível de verificação" className="grid gap-3">
        {(Object.keys(NIVEIS) as NivelDeVerificacao[]).map((id) => {
          const opcao = NIVEIS[id];
          const selecionado = nivel === id;

          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selecionado}
              onClick={() => definirNivel(id)}
              className={cn(
                'flex items-start gap-4 rounded-2xl border-2 p-4 text-left transition',
                selecionado
                  ? 'border-destaque bg-destaque-suave/60 shadow-brilho'
                  : 'border-linha hover:border-linha-forte',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                  selecionado ? 'border-destaque bg-destaque text-white' : 'border-linha-forte',
                )}
              >
                {selecionado && <Check className="size-3" strokeWidth={3} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-tinta flex items-center gap-2 font-semibold">
                  {opcao.rotulo}
                  {id === 'completo' && (
                    <span className="bg-gradiente-marca-texto rounded-full px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                      Máxima
                    </span>
                  )}
                </span>
                <span className="text-tinta-2 mt-0.5 block text-sm">{opcao.descricao}</span>
                <span className="mt-3 flex flex-wrap gap-2">
                  {opcao.verificacoes.map((tipo) => {
                    const { curto, icone: Icone } = VERIFICACAO[tipo];

                    return (
                      <span
                        key={tipo}
                        className="bg-superficie border-linha text-tinta-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                      >
                        <Icone className="text-destaque size-3.5" aria-hidden="true" /> {curto}
                      </span>
                    );
                  })}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-linha mt-6 grid gap-5 border-t pt-6 sm:grid-cols-2">
        <div className="border-linha hover:border-linha-forte flex items-start gap-3 rounded-2xl border p-4 transition">
          <input
            id="ordem-sequencial"
            type="checkbox"
            aria-describedby="ordem-sequencial-dica"
            className="accent-brand-600 mt-1 size-4 cursor-pointer"
            checked={sequencial}
            onChange={(e) => definirSequencial(e.target.checked)}
          />
          <div>
            <label
              htmlFor="ordem-sequencial"
              className="text-tinta flex cursor-pointer items-center gap-2 text-sm font-semibold"
            >
              <ListOrdered className="text-destaque size-4" aria-hidden="true" /> Assinatura em
              ordem
            </label>
            <p id="ordem-sequencial-dica" className="text-tinta-2 mt-1 text-xs">
              Cada pessoa só recebe o convite depois que a anterior assinar. Desmarcado, todos
              assinam em paralelo.
            </p>
          </div>
        </div>
        <Campo
          rotulo="Prazo para assinar"
          opcional
          dica="Depois dele, o documento expira e os links deixam de valer."
        >
          <Entrada
            type="date"
            min={amanha}
            value={prazo}
            icone={<CalendarClock />}
            onChange={(e) => definirPrazo(e.target.value)}
          />
        </Campo>
      </div>

      <div className="mt-6 flex justify-between">
        <Botao variante="fantasma" icone={<ArrowLeft className="size-4" />} onClick={aoVoltar}>
          Voltar
        </Botao>
        <Botao tamanho="lg" carregando={salvar.isPending} onClick={() => salvar.mutate()}>
          Revisar
        </Botao>
      </div>
    </Cartao>
  );
}

function EtapaRevisao({
  documento,
  aoVoltar,
}: {
  readonly documento: DetalheDoDocumento;
  readonly aoVoltar: () => void;
}) {
  const navegar = useNavigate();
  const confirmar = useConfirmacao();
  const clienteDeQuery = useQueryClient();
  const [erro, definirErro] = useState<string | null>(null);
  const nivel = NIVEIS[documento.nivelVerificacao];

  useEffect(() => window.scrollTo({ top: 0 }), []);

  const enviar = useMutation({
    mutationFn: () => apiDeDocumentos.enviar(documento.uuid),
    onSuccess: async () => {
      await Promise.all([
        clienteDeQuery.invalidateQueries({ queryKey: ['documentos'] }),
        clienteDeQuery.invalidateQueries({ queryKey: ['documento', documento.uuid] }),
        clienteDeQuery.invalidateQueries({ queryKey: ['painel'] }),
      ]);
      toast.success('Documento enviado! Os convites estão a caminho.');
      void navegar(`/app/documentos/${documento.uuid}`, { replace: true });
    },
    onError: (causa) => definirErro(mensagemDoErro(causa)),
  });

  const aoEnviar = async () => {
    const ok = await confirmar({
      titulo: 'Enviar para assinatura?',
      mensagem: `${documento.signatarios.length === 1 ? '1 pessoa vai' : `${documento.signatarios.length} pessoas vão`} receber o convite por e-mail. Depois do envio o documento não pode mais ser alterado — só cancelado.`,
      confirmar: 'Enviar agora',
    });

    if (ok) enviar.mutate();
  };

  return (
    <Cartao>
      <CabecalhoDoCartao
        titulo="Tudo certo?"
        descricao="Confira antes de enviar. Depois disso, o conteúdo fica travado pelo hash."
      />
      {erro && (
        <Alerta tom="perigo" className="mb-5">
          {erro}
        </Alerta>
      )}

      <dl className="border-linha divide-linha divide-y rounded-2xl border">
        <Resumo icone={<Users />} rotulo="Signatários">
          <ol className="space-y-2">
            {documento.signatarios.map((s) => (
              <li key={s.uuid} className="flex items-center gap-2.5">
                <span className="text-tinta-3 w-4 text-xs numeros">{s.ordem}.</span>
                <Avatar nome={s.nome} tamanho="sm" />
                <span className="min-w-0">
                  <span className="text-tinta block truncate text-sm font-medium">{s.nome}</span>
                  <span className="text-tinta-3 block truncate text-xs">{s.email}</span>
                </span>
              </li>
            ))}
          </ol>
        </Resumo>
        <Resumo icone={<ShieldCheck />} rotulo="Verificação">
          <p className="text-tinta text-sm font-medium">{nivel.rotulo}</p>
          <p className="text-tinta-3 text-xs">
            {nivel.verificacoes.map((t) => VERIFICACAO[t].curto).join(' · ')}
          </p>
        </Resumo>
        <Resumo icone={<ListOrdered />} rotulo="Ordem">
          <p className="text-tinta text-sm">
            {documento.ordemSequencial
              ? 'Sequencial — um de cada vez'
              : 'Paralela — todos ao mesmo tempo'}
          </p>
        </Resumo>
        <Resumo icone={<CalendarClock />} rotulo="Prazo">
          <p className="text-tinta text-sm">
            {documento.prazo ? formatarData(documento.prazo) : 'Sem prazo (links valem 30 dias)'}
          </p>
        </Resumo>
      </dl>

      <div className="mt-6 flex justify-between">
        <Botao variante="fantasma" icone={<ArrowLeft className="size-4" />} onClick={aoVoltar}>
          Voltar
        </Botao>
        <Botao
          tamanho="lg"
          icone={<Send className="size-4" />}
          carregando={enviar.isPending}
          onClick={() => void aoEnviar()}
        >
          Enviar para assinatura
        </Botao>
      </div>
    </Cartao>
  );
}

function Resumo({
  icone,
  rotulo,
  children,
}: {
  readonly icone: ReactElement;
  readonly rotulo: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-4 p-4">
      <dt className="text-tinta-3 flex items-center gap-2 text-sm [&_svg]:size-4">
        {icone}
        {rotulo}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
