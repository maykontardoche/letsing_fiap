import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/marca/Logo';
import { estilosDeBotao } from '@/components/ui/Botao';
import { cn } from '@/lib/cn';

const LINKS = [
  { rotulo: 'Como funciona', href: '/#como-funciona' },
  { rotulo: 'Biometria', href: '/#biometria' },
  { rotulo: 'Segurança', href: '/#seguranca' },
  { rotulo: 'Planos', href: '/#planos' },
] as const;

interface Props {
  /** `escuro`: sobre o hero da landing. `claro`: páginas públicas de fundo claro. */
  readonly sobre?: 'escuro' | 'claro';
}

/**
 * Cabeçalho das páginas públicas. Fica transparente sobre o hero e ganha fundo
 * com desfoque ao rolar — o conteúdo nunca passa por baixo de texto ilegível.
 */
export function NavegacaoPublica({ sobre = 'escuro' }: Props) {
  const [rolou, definirRolou] = useState(false);
  const [aberto, definirAberto] = useState(false);

  useEffect(() => {
    const aoRolar = () => definirRolou(window.scrollY > 12);

    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });

    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  const escuro = sobre === 'escuro';

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-all duration-300',
        rolou || aberto
          ? escuro
            ? 'border-b border-white/10 bg-noite-950/80 backdrop-blur-xl'
            : 'border-linha bg-superficie/85 border-b backdrop-blur-xl'
          : 'bg-transparent',
      )}
    >
      <nav
        aria-label="Principal"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 lg:px-8"
      >
        <Link to="/" aria-label="LetsSign — início">
          <Logo tom={escuro ? 'claro' : 'padrao'} />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition',
                  escuro ? 'text-white/70 hover:text-white' : 'text-tinta-2 hover:text-tinta',
                )}
              >
                {link.rotulo}
              </a>
            </li>
          ))}
          <li>
            <NavLink
              to="/validar"
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition',
                escuro ? 'text-white/70 hover:text-white' : 'text-tinta-2 hover:text-tinta',
              )}
            >
              Validar documento
            </NavLink>
          </li>
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <Link to="/entrar" className={estilosDeBotao(escuro ? 'vidro' : 'fantasma', 'md')}>
            Entrar
          </Link>
          <Link to="/cadastro" className={estilosDeBotao(escuro ? 'claro' : 'primario', 'md')}>
            Começar grátis
          </Link>
        </div>

        <button
          type="button"
          className={cn('rounded-lg p-2 md:hidden', escuro ? 'text-white' : 'text-tinta')}
          aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={aberto}
          onClick={() => definirAberto(!aberto)}
        >
          {aberto ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </nav>

      {aberto && (
        <div className="border-t border-white/10 px-5 pb-6 md:hidden">
          <ul className="flex flex-col gap-1 pt-3">
            {[...LINKS, { rotulo: 'Validar documento', href: '/validar' }].map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => definirAberto(false)}
                  className={cn(
                    'block rounded-lg px-3 py-2.5 text-base font-medium',
                    escuro ? 'text-white/80' : 'text-tinta-2',
                  )}
                >
                  {link.rotulo}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link to="/entrar" className={estilosDeBotao(escuro ? 'vidro' : 'secundario')}>
              Entrar
            </Link>
            <Link to="/cadastro" className={estilosDeBotao(escuro ? 'claro' : 'primario')}>
              Começar grátis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
