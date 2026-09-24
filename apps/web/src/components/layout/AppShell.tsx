import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useSessao, usePerfil } from '@/app/providers/sessao-contexto';
import { Logo } from '@/components/marca/Logo';
import { estilosDeBotao } from '@/components/ui/Botao';
import { Avatar, BarraDeProgresso } from '@/components/ui/Diversos';
import { planoPorId } from '@/constants/planos';
import { useTema } from '@/hooks/useTema';
import { apiDaConta, apiDoPainel } from '@/lib/api/gestao';
import { ROTULO_DO_PAPEL, type Permissao } from '@/lib/api/sessao';
import { cn } from '@/lib/cn';
import { formatarRelativo } from '@/lib/formatadores';

interface ItemDoMenu {
  readonly para: string;
  readonly rotulo: string;
  readonly icone: typeof LayoutDashboard;
  readonly exige?: Permissao;
  readonly exato?: boolean;
}

const MENU: readonly ItemDoMenu[] = [
  { para: '/app', rotulo: 'Painel', icone: LayoutDashboard, exato: true },
  { para: '/app/documentos', rotulo: 'Documentos', icone: FileText },
  { para: '/app/equipe', rotulo: 'Equipe', icone: Users, exige: 'equipe.ver' },
  { para: '/app/auditoria', rotulo: 'Auditoria', icone: ScrollText, exige: 'auditoria.ver' },
  { para: '/app/configuracoes', rotulo: 'Configurações', icone: Settings },
];

/**
 * A casca de todas as telas autenticadas.
 *
 * ⚠️ O menu esconde o que a pessoa não pode acessar — mas isso é **conforto**, não
 * controle: a API recusa com 403 qualquer rota sem a permissão, digitada ou não.
 */
export function AppShell() {
  const perfil = usePerfil();
  const local = useLocation();
  // O menu móvel lembra EM QUE PÁGINA foi aberto: ao navegar, o caminho muda e ele
  // fecha sozinho — sem efeito para "reagir" à navegação.
  const [menuAbertoEm, definirMenuAbertoEm] = useState<string | null>(null);
  const menuAberto = menuAbertoEm === local.pathname;
  const definirMenuAberto = (aberto: boolean) =>
    definirMenuAbertoEm(aberto ? local.pathname : null);
  const itens = MENU.filter(
    (item) => item.exige === undefined || perfil.permissoes.includes(item.exige),
  );

  const barra = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link to="/app" aria-label="LetsSign — painel">
          <Logo />
        </Link>
      </div>

      {perfil.permissoes.includes('documentos.criar') && (
        <div className="px-4 pt-2 pb-4">
          <Link
            to="/app/documentos/novo"
            className={cn(estilosDeBotao('primario', 'md'), 'w-full')}
          >
            <Plus className="size-4" aria-hidden="true" />
            Novo documento
          </Link>
        </div>
      )}

      <nav aria-label="Menu principal" className="flex-1 space-y-1 px-3">
        {itens.map(({ para, rotulo, icone: Icone, exato }) => (
          <NavLink
            key={para}
            to={para}
            end={exato}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-destaque-suave text-destaque-tinta'
                  : 'text-tinta-2 hover:bg-superficie-2 hover:text-tinta',
              )
            }
          >
            <Icone className="size-[18px] shrink-0" aria-hidden="true" />
            {rotulo}
          </NavLink>
        ))}
      </nav>

      <CartaoDaCota />
    </div>
  );

  return (
    <div className="bg-fundo flex min-h-dvh">
      <aside className="border-linha bg-superficie sticky top-0 hidden h-dvh w-64 shrink-0 border-r lg:block">
        {barra}
      </aside>

      {menuAberto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            aria-hidden="true"
            className="animate-surgir absolute inset-0 bg-noite-950/50 backdrop-blur-sm"
            onClick={() => definirMenuAberto(false)}
          />
          <aside
            className="bg-superficie animate-surgir absolute inset-y-0 left-0 w-72 shadow-elevada"
            aria-label="Menu"
          >
            <button
              type="button"
              onClick={() => definirMenuAberto(false)}
              aria-label="Fechar menu"
              className="text-tinta-3 hover:bg-superficie-2 absolute top-4 right-3 rounded-lg p-2"
            >
              <X className="size-5" />
            </button>
            {barra}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Cabecalho aoAbrirMenu={() => definirMenuAberto(true)} />
        <main
          id="conteudo"
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function CartaoDaCota() {
  const { data } = useQuery({
    queryKey: ['painel'],
    queryFn: apiDoPainel.resumo,
    staleTime: 60_000,
  });

  if (data === undefined) return <div className="h-4" />;

  const plano = planoPorId(data.cota.plano);

  return (
    <div className="border-linha bg-superficie-2/60 m-4 rounded-2xl border p-4">
      <div className="flex items-center justify-between">
        <p className="text-tinta text-sm font-semibold">Plano {plano.nome}</p>
        <ShieldCheck className="text-destaque size-4" aria-hidden="true" />
      </div>
      {data.cota.limite === null ? (
        <p className="text-tinta-3 mt-1 text-xs">
          Envios ilimitados · {data.cota.usados} neste mês
        </p>
      ) : (
        <>
          <p className="text-tinta-3 mt-1 text-xs numeros">
            {data.cota.usados} de {data.cota.limite} envios neste mês
          </p>
          <BarraDeProgresso
            className="mt-2.5"
            valor={data.cota.usados / data.cota.limite}
            rotulo="Uso da cota mensal"
          />
        </>
      )}
    </div>
  );
}

function Cabecalho({ aoAbrirMenu }: { readonly aoAbrirMenu: () => void }) {
  const navegar = useNavigate();
  const { tema, alternar } = useTema();
  const [busca, definirBusca] = useState('');

  const buscar = (evento: FormEvent) => {
    evento.preventDefault();
    void navegar(`/app/documentos${busca.trim() ? `?q=${encodeURIComponent(busca.trim())}` : ''}`);
  };

  return (
    <header className="border-linha bg-superficie/80 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={aoAbrirMenu}
        aria-label="Abrir menu"
        className="text-tinta-2 hover:bg-superficie-2 rounded-lg p-2 lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <form onSubmit={buscar} role="search" className="relative hidden max-w-md flex-1 sm:block">
        <Search
          className="text-tinta-3 pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          type="search"
          value={busca}
          onChange={(e) => definirBusca(e.target.value)}
          placeholder="Buscar documentos, códigos ou signatários…"
          aria-label="Buscar documentos"
          className="border-linha bg-superficie-2/70 text-tinta placeholder:text-tinta-3 focus:border-destaque focus:bg-superficie focus:ring-destaque/15 h-10 w-full rounded-xl border pr-3 pl-10 text-sm transition focus:ring-4 focus:outline-none"
        />
      </form>

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={alternar}
          aria-label={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}
          className="text-tinta-2 hover:bg-superficie-2 hover:text-tinta rounded-xl p-2.5 transition"
        >
          {tema === 'escuro' ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>
        <Sino />
        <MenuDoUsuario />
      </div>
    </header>
  );
}

/** Abre/fecha um menu suspenso com clique fora e `Esc`. */
function useSuspenso() {
  const [aberto, definirAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return undefined;

    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) definirAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && definirAberto(false);

    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);

    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  return { aberto, definirAberto, raiz };
}

function Sino() {
  const { aberto, definirAberto, raiz } = useSuspenso();
  const clienteDeQuery = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notificacoes'],
    queryFn: apiDaConta.notificacoes,
    refetchInterval: 30_000,
  });
  const naoLidas = data?.naoLidas ?? 0;

  const abrir = () => {
    definirAberto(!aberto);

    if (!aberto && naoLidas > 0) {
      void apiDaConta
        .marcarLidas()
        .then(() => clienteDeQuery.invalidateQueries({ queryKey: ['notificacoes'] }));
    }
  };

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={abrir}
        aria-expanded={aberto}
        aria-label={naoLidas > 0 ? `Notificações: ${naoLidas} não lidas` : 'Notificações'}
        className="text-tinta-2 hover:bg-superficie-2 hover:text-tinta relative rounded-xl p-2.5 transition"
      >
        <Bell className="size-5" />
        {naoLidas > 0 && (
          <span className="bg-perigo absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold text-white">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="border-linha bg-superficie shadow-elevada animate-surgir absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border">
          <p className="border-linha text-tinta border-b px-4 py-3 text-sm font-semibold">
            Notificações
          </p>
          <ul className="rolagem-fina max-h-96 overflow-y-auto">
            {(data?.itens.length ?? 0) === 0 && (
              <li className="text-tinta-3 px-4 py-10 text-center text-sm">Nada novo por aqui.</li>
            )}
            {data?.itens.map((n) => (
              <li key={n.id} className="border-linha border-b last:border-0">
                <Link
                  to={n.link ?? '/app'}
                  onClick={() => definirAberto(false)}
                  className="hover:bg-superficie-2 flex gap-3 px-4 py-3 transition"
                >
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      n.lida ? 'bg-transparent' : 'bg-destaque',
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="text-tinta block text-sm font-medium">{n.titulo}</span>
                    <span className="text-tinta-2 block text-sm">{n.mensagem}</span>
                    <span className="text-tinta-3 mt-0.5 block text-xs">
                      {formatarRelativo(n.criadaEm)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MenuDoUsuario() {
  const perfil = usePerfil();
  const { sair } = useSessao();
  const navegar = useNavigate();
  const { aberto, definirAberto, raiz } = useSuspenso();

  return (
    <div ref={raiz} className="relative ml-1">
      <button
        type="button"
        onClick={() => definirAberto(!aberto)}
        aria-expanded={aberto}
        aria-label="Menu da conta"
        className="hover:bg-superficie-2 flex items-center gap-2.5 rounded-xl py-1.5 pr-2 pl-1.5 transition"
      >
        <Avatar nome={perfil.nome} tamanho="sm" />
        <span className="hidden text-left md:block">
          <span className="text-tinta block max-w-40 truncate text-sm leading-tight font-semibold">
            {perfil.nome}
          </span>
          <span className="text-tinta-3 block max-w-40 truncate text-xs leading-tight">
            {perfil.organizacao.nome}
          </span>
        </span>
        <ChevronDown className="text-tinta-3 hidden size-4 md:block" aria-hidden="true" />
      </button>

      {aberto && (
        <div className="border-linha bg-superficie shadow-elevada animate-surgir absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border p-1.5">
          <div className="px-3 py-2.5">
            <p className="text-tinta truncate text-sm font-semibold">{perfil.nome}</p>
            <p className="text-tinta-3 truncate text-xs">{perfil.email}</p>
            <p className="text-destaque-tinta mt-1.5 text-xs font-medium">
              {ROTULO_DO_PAPEL[perfil.papel]}
            </p>
          </div>
          <div className="border-linha my-1 border-t" />
          <Link
            to="/app/configuracoes"
            onClick={() => definirAberto(false)}
            className="text-tinta-2 hover:bg-superficie-2 hover:text-tinta flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm"
          >
            <Settings className="size-4" aria-hidden="true" /> Configurações
          </Link>
          <button
            type="button"
            onClick={() => void sair().then(() => navegar('/entrar', { replace: true }))}
            className="text-perigo-tinta hover:bg-perigo-suave flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm"
          >
            <LogOut className="size-4" aria-hidden="true" /> Sair
          </button>
        </div>
      )}
    </div>
  );
}
