import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Check,
  Copy,
  KeyRound,
  Laptop,
  Monitor,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmacao } from '@/app/providers/ConfirmacaoProvider';
import { usePerfil, usePode, useSessao } from '@/app/providers/sessao-contexto';
import { CabecalhoDaPagina } from '@/components/layout/CabecalhoDaPagina';
import { Botao } from '@/components/ui/Botao';
import { Cartao, CabecalhoDoCartao } from '@/components/ui/Cartao';
import { Campo, Entrada } from '@/components/ui/Campo';
import { Abas, Avatar, BarraDeProgresso } from '@/components/ui/Diversos';
import { Alerta, EstadoDeErro, Esqueleto } from '@/components/ui/Estados';
import { Etiqueta } from '@/components/ui/Etiqueta';
import { Modal } from '@/components/ui/Modal';
import { PLANOS, type IdDoPlano } from '@/constants/planos';
import { apiDaConta, type SessaoAtiva } from '@/lib/api/gestao';
import { ROTULO_DO_PAPEL } from '@/lib/api/sessao';
import { mensagemDoErro } from '@/lib/erros';
import { cn } from '@/lib/cn';
import { formatarData, formatarRelativo } from '@/lib/formatadores';
import { ForcaDaSenha, senhaAtendeRequisitos } from '@/pages/auth/ForcaDaSenha';

type Aba = 'perfil' | 'seguranca' | 'sessoes' | 'organizacao';
const ABAS: readonly Aba[] = ['perfil', 'seguranca', 'sessoes', 'organizacao'];

export function ConfiguracoesPage() {
  const [parametros, definirParametros] = useSearchParams();
  const pedida = parametros.get('aba') as Aba | null;
  const aba: Aba = pedida && ABAS.includes(pedida) ? pedida : 'perfil';

  return (
    <>
      <CabecalhoDaPagina
        titulo="Configurações"
        descricao="Sua conta, sua segurança e a sua organização."
      />
      <div className="mb-6">
        <Abas
          rotulo="Seções das configurações"
          ativa={aba}
          aoMudar={(id) => definirParametros({ aba: id }, { replace: true })}
          abas={[
            { id: 'perfil', rotulo: 'Perfil', icone: <User /> },
            { id: 'seguranca', rotulo: 'Segurança', icone: <ShieldCheck /> },
            { id: 'sessoes', rotulo: 'Sessões', icone: <Laptop /> },
            { id: 'organizacao', rotulo: 'Organização e plano', icone: <Building2 /> },
          ]}
        />
      </div>
      {aba === 'perfil' && <Perfil />}
      {aba === 'seguranca' && <Seguranca />}
      {aba === 'sessoes' && <Sessoes />}
      {aba === 'organizacao' && <Organizacao />}
    </>
  );
}

function Perfil() {
  const perfil = usePerfil();
  const { recarregar } = useSessao();
  const [nome, definirNome] = useState(perfil.nome);
  const salvar = useMutation({
    mutationFn: () => apiDaConta.atualizarPerfil(nome.trim()),
    onSuccess: async () => {
      await recarregar();
      toast.success('Perfil atualizado.');
    },
    onError: (e) => toast.error(mensagemDoErro(e)),
  });

  return (
    <Cartao className="max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Avatar nome={perfil.nome} tamanho="lg" />
        <div>
          <p className="text-tinta text-lg font-bold">{perfil.nome}</p>
          <p className="text-tinta-3 text-sm">
            {perfil.email} · {ROTULO_DO_PAPEL[perfil.papel]}
          </p>
        </div>
      </div>
      <div className="space-y-4">
        <Campo rotulo="Nome completo">
          <Entrada value={nome} maxLength={120} onChange={(e) => definirNome(e.target.value)} />
        </Campo>
        <Campo rotulo="E-mail" dica="O e-mail identifica a conta e não pode ser alterado aqui.">
          <Entrada value={perfil.email} disabled />
        </Campo>
      </div>
      <div className="mt-6 flex justify-end">
        <Botao
          disabled={nome.trim().length < 2 || nome.trim() === perfil.nome}
          carregando={salvar.isPending}
          onClick={() => salvar.mutate()}
        >
          Salvar
        </Botao>
      </div>
    </Cartao>
  );
}

function Seguranca() {
  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      <TrocaDeSenha />
      <Mfa />
    </div>
  );
}

function TrocaDeSenha() {
  const [atual, definirAtual] = useState('');
  const [nova, definirNova] = useState('');
  const trocar = useMutation({
    mutationFn: () => apiDaConta.trocarSenha({ senhaAtual: atual, novaSenha: nova }),
    onSuccess: () => {
      definirAtual('');
      definirNova('');
      toast.success('Senha alterada. As outras sessões foram encerradas.');
    },
    onError: (e) => toast.error(mensagemDoErro(e)),
  });

  return (
    <Cartao>
      <CabecalhoDoCartao
        titulo="Senha"
        descricao="Trocar a senha encerra todas as outras sessões abertas."
      />
      <div className="space-y-4">
        <Campo rotulo="Senha atual">
          <Entrada
            type="password"
            autoComplete="current-password"
            value={atual}
            onChange={(e) => definirAtual(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Nova senha">
          <Entrada
            type="password"
            autoComplete="new-password"
            value={nova}
            onChange={(e) => definirNova(e.target.value)}
          />
        </Campo>
        <ForcaDaSenha senha={nova} />
      </div>
      <div className="mt-6 flex justify-end">
        <Botao
          disabled={!atual || !senhaAtendeRequisitos(nova)}
          carregando={trocar.isPending}
          onClick={() => trocar.mutate()}
        >
          Alterar senha
        </Botao>
      </div>
    </Cartao>
  );
}

function Mfa() {
  const perfil = usePerfil();
  const { recarregar } = useSessao();
  const [configuracao, definirConfiguracao] = useState<{ qrCode: string; segredo: string } | null>(
    null,
  );
  const [codigo, definirCodigo] = useState('');
  const [codigosDeRecuperacao, definirCodigosDeRecuperacao] = useState<string[] | null>(null);
  const [desativando, definirDesativando] = useState(false);
  const [senha, definirSenha] = useState('');

  const iniciar = useMutation({
    mutationFn: apiDaConta.iniciarMfa,
    onSuccess: definirConfiguracao,
    onError: (e) => toast.error(mensagemDoErro(e)),
  });
  const confirmar = useMutation({
    mutationFn: () => apiDaConta.confirmarMfa(codigo.replace(/\D/g, '')),
    onSuccess: async (resposta) => {
      definirConfiguracao(null);
      definirCodigo('');
      definirCodigosDeRecuperacao(resposta.codigosDeRecuperacao);
      await recarregar();
    },
    onError: (e) => toast.error(mensagemDoErro(e)),
  });
  const desativar = useMutation({
    mutationFn: () => apiDaConta.desativarMfa(senha),
    onSuccess: async () => {
      definirDesativando(false);
      definirSenha('');
      await recarregar();
      toast.success('Verificação em duas etapas desativada.');
    },
    onError: (e) => toast.error(mensagemDoErro(e)),
  });

  return (
    <Cartao>
      <CabecalhoDoCartao
        titulo="Verificação em duas etapas"
        descricao="Além da senha, um código do app autenticador (Google Authenticator, Microsoft Authenticator, 1Password…)."
        acoes={
          perfil.mfaAtivo ? (
            <Etiqueta tom="sucesso" icone={<ShieldCheck />}>
              Ativa
            </Etiqueta>
          ) : (
            <Etiqueta tom="alerta" icone={<ShieldOff />}>
              Inativa
            </Etiqueta>
          )
        }
      />

      {codigosDeRecuperacao ? (
        <div className="space-y-4">
          <Alerta tom="alerta" titulo="Guarde estes códigos agora">
            Eles só aparecem uma vez. Cada um permite entrar uma única vez se você perder o celular.
          </Alerta>
          <ul className="bg-superficie-2 grid grid-cols-2 gap-2 rounded-2xl p-4 font-mono text-sm">
            {codigosDeRecuperacao.map((c) => (
              <li key={c} className="text-tinta text-center">
                {c}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Botao
              variante="secundario"
              icone={<Copy className="size-4" />}
              onClick={() =>
                void navigator.clipboard
                  .writeText(codigosDeRecuperacao.join('\n'))
                  .then(() => toast.success('Códigos copiados.'))
              }
            >
              Copiar
            </Botao>
            <Botao
              icone={<Check className="size-4" />}
              onClick={() => definirCodigosDeRecuperacao(null)}
            >
              Já guardei
            </Botao>
          </div>
        </div>
      ) : configuracao ? (
        <div className="space-y-4">
          <p className="text-tinta-2 text-sm">1. Escaneie o QR Code no app autenticador.</p>
          <img
            src={configuracao.qrCode}
            alt="QR Code para configurar o app autenticador"
            className="border-linha mx-auto size-48 rounded-2xl border bg-white p-2"
          />
          <p className="text-tinta-3 text-center text-xs">
            Sem câmera? Digite a chave:{' '}
            <code className="text-tinta font-mono break-all">{configuracao.segredo}</code>
          </p>
          <Campo rotulo="2. Digite o código de 6 dígitos que o app mostra">
            <Entrada
              inputMode="numeric"
              maxLength={7}
              value={codigo}
              onChange={(e) => definirCodigo(e.target.value)}
              className="font-mono text-lg tracking-[0.4em]"
              placeholder="000000"
            />
          </Campo>
          <div className="flex justify-end gap-2">
            <Botao variante="fantasma" onClick={() => definirConfiguracao(null)}>
              Cancelar
            </Botao>
            <Botao
              disabled={codigo.replace(/\D/g, '').length !== 6}
              carregando={confirmar.isPending}
              onClick={() => confirmar.mutate()}
            >
              Ativar
            </Botao>
          </div>
        </div>
      ) : perfil.mfaAtivo ? (
        <div className="space-y-4">
          <p className="text-tinta-2 text-sm">
            A cada login, pediremos o código do app. Isso vale por sessão — não existe "lembrar este
            dispositivo".
          </p>
          <Botao
            variante="secundario"
            icone={<ShieldOff className="size-4" />}
            onClick={() => definirDesativando(true)}
          >
            Desativar
          </Botao>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-tinta-2 text-sm">
            Com ela, alguém que descubra sua senha ainda não consegue entrar nem enviar documentos
            em seu nome.
          </p>
          <Botao
            icone={<KeyRound className="size-4" />}
            carregando={iniciar.isPending}
            onClick={() => iniciar.mutate()}
          >
            Configurar
          </Botao>
        </div>
      )}

      <Modal
        aberto={desativando}
        aoFechar={() => definirDesativando(false)}
        titulo="Desativar a verificação em duas etapas?"
        descricao="Sua conta volta a depender só da senha. Confirme com a sua senha atual."
        largura="estreita"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => definirDesativando(false)}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              disabled={!senha}
              carregando={desativar.isPending}
              onClick={() => desativar.mutate()}
            >
              Desativar
            </Botao>
          </>
        }
      >
        <Campo rotulo="Senha">
          <Entrada
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => definirSenha(e.target.value)}
          />
        </Campo>
      </Modal>
    </Cartao>
  );
}

function descreverNavegador(userAgent: string | null): { rotulo: string; celular: boolean } {
  if (!userAgent) return { rotulo: 'Navegador desconhecido', celular: false };

  const celular = /Mobile|Android|iPhone/i.test(userAgent);
  const navegador = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Navegador';
  const sistema = /Windows/.test(userAgent)
    ? 'Windows'
    : /Mac OS/.test(userAgent)
      ? 'macOS'
      : /Android/.test(userAgent)
        ? 'Android'
        : /iPhone|iPad/.test(userAgent)
          ? 'iOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : '';

  return { rotulo: `${navegador}${sistema ? ` · ${sistema}` : ''}`, celular };
}

function Sessoes() {
  const clienteDeQuery = useQueryClient();
  const confirmar = useConfirmacao();
  const consulta = useQuery({ queryKey: ['sessoes'], queryFn: apiDaConta.sessoes });
  const revogar = useMutation({
    mutationFn: (uuid: string) => apiDaConta.revogarSessao(uuid),
    onSuccess: async () => {
      await clienteDeQuery.invalidateQueries({ queryKey: ['sessoes'] });
      toast.success('Sessão encerrada.');
    },
    onError: (e) => toast.error(mensagemDoErro(e)),
  });

  const encerrar = async (sessao: SessaoAtiva) => {
    if (
      await confirmar({
        titulo: 'Encerrar esta sessão?',
        mensagem: 'Quem estiver usando esse navegador precisará entrar de novo.',
        confirmar: 'Encerrar',
        perigosa: true,
      })
    ) {
      revogar.mutate(sessao.uuid);
    }
  };

  return (
    <Cartao className="max-w-3xl">
      <CabecalhoDoCartao
        titulo="Sessões ativas"
        descricao="Onde a sua conta está conectada agora. Encerre qualquer uma que você não reconheça."
      />
      {consulta.isPending && <Esqueleto className="h-32" />}
      {consulta.isError && (
        <EstadoDeErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />
      )}
      <ul className="divide-linha divide-y">
        {consulta.data?.map((sessao) => {
          const { rotulo, celular } = descreverNavegador(sessao.userAgent);
          const Icone = celular ? Smartphone : Monitor;

          return (
            <li key={sessao.uuid} className="flex items-center gap-4 py-4">
              <span
                className={cn(
                  'flex size-10 items-center justify-center rounded-xl',
                  sessao.atual
                    ? 'bg-sucesso-suave text-sucesso-tinta'
                    : 'bg-superficie-2 text-tinta-2',
                )}
              >
                <Icone className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-tinta flex items-center gap-2 text-sm font-semibold">
                  {rotulo} {sessao.atual && <Etiqueta tom="sucesso">Esta sessão</Etiqueta>}
                </p>
                <p className="text-tinta-3 text-xs">
                  IP {sessao.ip ?? '—'} · entrou {formatarRelativo(sessao.criadaEm)} · ativa{' '}
                  {formatarRelativo(sessao.ultimaAtividadeEm)}
                </p>
              </div>
              {!sessao.atual && (
                <Botao variante="secundario" tamanho="sm" onClick={() => void encerrar(sessao)}>
                  Encerrar
                </Botao>
              )}
            </li>
          );
        })}
      </ul>
    </Cartao>
  );
}

function Organizacao() {
  const podeGerenciar = usePode('organizacao.gerenciar');
  const { recarregar } = useSessao();
  const clienteDeQuery = useQueryClient();
  const consulta = useQuery({ queryKey: ['organizacao'], queryFn: apiDaConta.organizacao });
  const [nome, definirNome] = useState<string | null>(null);

  const atualizar = useMutation({
    mutationFn: (dados: { nome?: string; plano?: IdDoPlano }) =>
      apiDaConta.atualizarOrganizacao(dados),
    onSuccess: async (organizacao) => {
      clienteDeQuery.setQueryData(['organizacao'], organizacao);
      await Promise.all([recarregar(), clienteDeQuery.invalidateQueries({ queryKey: ['painel'] })]);
      definirNome(null);
      toast.success('Organização atualizada.');
    },
    onError: (e) => toast.error(mensagemDoErro(e)),
  });

  if (consulta.isPending)
    return <Esqueleto className="h-80 max-w-4xl rounded-[var(--radius-cartao)]" />;
  if (consulta.isError)
    return (
      <Cartao>
        <EstadoDeErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />
      </Cartao>
    );

  const org = consulta.data;
  const nomeEmEdicao = nome ?? org.nome;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao>
          <CabecalhoDoCartao
            titulo="Dados da organização"
            descricao={`Criada em ${formatarData(org.criadoEm)}`}
          />
          <Campo
            rotulo="Nome"
            dica={
              podeGerenciar
                ? 'Aparece nos convites e no manifesto de assinaturas.'
                : 'Só o proprietário altera.'
            }
          >
            <Entrada
              value={nomeEmEdicao}
              disabled={!podeGerenciar}
              maxLength={120}
              onChange={(e) => definirNome(e.target.value)}
            />
          </Campo>
          {podeGerenciar && (
            <div className="mt-5 flex justify-end">
              <Botao
                disabled={nomeEmEdicao.trim().length < 2 || nomeEmEdicao.trim() === org.nome}
                carregando={atualizar.isPending}
                onClick={() => atualizar.mutate({ nome: nomeEmEdicao.trim() })}
              >
                Salvar
              </Botao>
            </div>
          )}
        </Cartao>

        <Cartao>
          <CabecalhoDoCartao titulo="Uso deste mês" />
          <div className="space-y-5">
            <Uso
              rotulo="Documentos enviados"
              usado={org.uso.enviadosNoMes}
              limite={org.uso.limiteDeEnvios}
            />
            <Uso
              rotulo="Pessoas na equipe"
              usado={org.uso.membros}
              limite={org.uso.limiteDeMembros}
            />
          </div>
        </Cartao>
      </div>

      <Cartao>
        <CabecalhoDoCartao
          titulo="Plano"
          descricao="Projeto acadêmico: a troca de plano é simulada, sem cobrança."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {PLANOS.map((plano) => {
            const atual = plano.id === org.plano;

            return (
              <div
                key={plano.id}
                className={cn(
                  'flex flex-col rounded-2xl border-2 p-5',
                  atual ? 'border-destaque bg-destaque-suave/50' : 'border-linha',
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-tinta font-bold">{plano.nome}</p>
                  {atual && <Etiqueta tom="info">Atual</Etiqueta>}
                </div>
                <p className="font-display text-tinta mt-2 text-2xl font-extrabold">
                  {plano.preco}
                  <span className="text-tinta-3 text-sm font-medium">{plano.periodo}</span>
                </p>
                <p className="text-tinta-3 mt-1 flex-1 text-xs">
                  {plano.enviosPorMes === null
                    ? 'Envios ilimitados'
                    : `${plano.enviosPorMes} envios por mês`}
                </p>
                {podeGerenciar && !atual && (
                  <Botao
                    variante="secundario"
                    tamanho="sm"
                    className="mt-4"
                    carregando={atualizar.isPending}
                    onClick={() => atualizar.mutate({ plano: plano.id })}
                  >
                    Mudar para {plano.nome}
                  </Botao>
                )}
              </div>
            );
          })}
        </div>
      </Cartao>
    </div>
  );
}

function Uso({
  rotulo,
  usado,
  limite,
}: {
  readonly rotulo: string;
  readonly usado: number;
  readonly limite: number | null;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-tinta-2">{rotulo}</span>
        <span className="text-tinta font-semibold numeros">
          {limite === null ? `${usado} · ilimitado` : `${usado} de ${limite}`}
        </span>
      </div>
      <BarraDeProgresso valor={limite === null ? 0.08 : usado / limite} rotulo={rotulo} />
    </div>
  );
}
