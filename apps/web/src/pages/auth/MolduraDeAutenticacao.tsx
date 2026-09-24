import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Fingerprint, Link2, QrCode, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/marca/Logo';

const DESTAQUES = [
  { icone: ShieldCheck, texto: 'Assinatura Ed25519 verificável por qualquer pessoa' },
  { icone: Fingerprint, texto: 'Identidade por rosto, voz e gestos — sem guardar biometria' },
  { icone: Link2, texto: 'Trilha de auditoria encadeada por hash, à prova de edição' },
  { icone: QrCode, texto: 'Validação pública por QR Code em todas as páginas' },
] as const;

interface Props {
  readonly titulo: string;
  readonly subtitulo?: ReactNode;
  readonly children: ReactNode;
  readonly rodape?: ReactNode;
}

/** A moldura das telas de entrada: painel de marca à esquerda, formulário à direita. */
export function MolduraDeAutenticacao({ titulo, subtitulo, children, rodape }: Props) {
  return (
    <div className="bg-fundo grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <aside className="bg-noite-950 relative isolate hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div aria-hidden="true" className="grade-de-fundo absolute inset-0 -z-10" />
        <div
          aria-hidden="true"
          className="bg-gradiente-marca absolute -top-40 -left-40 -z-10 size-[34rem] rounded-full opacity-30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -right-32 -bottom-32 -z-10 size-[28rem] rounded-full bg-[radial-gradient(closest-side,rgba(6,182,212,0.3),transparent)] blur-2xl"
        />

        <Link to="/" aria-label="LetsSign — início" className="w-fit">
          <Logo tom="claro" />
        </Link>

        <div className="max-w-md">
          <h2 className="text-4xl leading-tight font-extrabold">
            Contratos assinados com <span className="texto-gradiente">prova de identidade</span>.
          </h2>
          <ul className="mt-10 space-y-5">
            {DESTAQUES.map(({ icone: Icone, texto }) => (
              <li key={texto} className="flex items-start gap-3.5 text-white/75">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <Icone className="text-ciano-300 size-4.5" aria-hidden="true" />
                </span>
                <span className="pt-1.5 text-sm leading-relaxed">{texto}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Uma rubrica que se desenha — assinatura de marca do produto. */}
        <svg viewBox="0 0 420 90" className="w-80 opacity-60" aria-hidden="true">
          <path
            d="M8 62c18-4 26-40 40-40s6 38 20 38 16-46 30-46 6 40 20 40c10 0 14-24 24-24s8 18 18 18c14 0 18-30 32-30 10 0 6 22 16 22s18-14 30-16 18 0 32-2 30-6 44-10"
            fill="none"
            stroke="url(#rubrica)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="900"
            strokeDashoffset="900"
            style={{ animation: 'desenhar 3.2s ease-in-out 0.4s forwards' }}
          />
          <defs>
            <linearGradient id="rubrica" x1="0" x2="1">
              <stop offset="0" stopColor="#818cf8" />
              <stop offset="1" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <style>{'@keyframes desenhar { to { stroke-dashoffset: 0; } }'}</style>
        </svg>
      </aside>

      <main className="flex flex-col justify-center px-5 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" aria-label="LetsSign — início" className="mb-10 inline-block lg:hidden">
            <Logo />
          </Link>
          <h1 className="text-tinta text-3xl font-extrabold">{titulo}</h1>
          {subtitulo && <p className="text-tinta-2 mt-2">{subtitulo}</p>}
          <div className="mt-8">{children}</div>
          {rodape && <div className="text-tinta-2 mt-8 text-center text-sm">{rodape}</div>}
        </div>
      </main>
    </div>
  );
}
