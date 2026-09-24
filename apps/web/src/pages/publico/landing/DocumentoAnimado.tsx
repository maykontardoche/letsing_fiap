import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, FileText, Hand, Loader2, Mic, ScanFace, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';

const ETAPAS = [
  { icone: ScanFace, rotulo: 'Reconhecimento facial', detalhe: 'Prova de vida · piscar e virar' },
  { icone: Mic, rotulo: 'Desafio de voz', detalhe: '"girassol · cometa · aurora"' },
  { icone: Hand, rotulo: 'Sequência de gestos', detalhe: 'Mão aberta → Joinha → Paz' },
] as const;

/** Duração de cada etapa da demonstração, em ms. */
const RITMO = 1400;

/**
 * A ilustração do hero: um contrato passando pelas verificações e recebendo a
 * assinatura. É decoração — por isso `aria-hidden` no conjunto e um texto
 * alternativo único para leitor de tela.
 */
export function DocumentoAnimado() {
  const [passo, definirPasso] = useState(0);

  useEffect(() => {
    const intervalo = window.setInterval(
      () => definirPasso((atual) => (atual + 1) % (ETAPAS.length + 3)),
      RITMO,
    );

    return () => window.clearInterval(intervalo);
  }, []);

  const assinado = passo >= ETAPAS.length;

  return (
    <div className="relative mx-auto w-full max-w-lg">
      <p className="sr-only">
        Ilustração: um contrato passa por reconhecimento facial, voz e gestos, e recebe uma
        assinatura com selo criptográfico.
      </p>

      <div aria-hidden="true" className="animate-flutuar">
        {/* Brilho atrás do cartão */}
        <div className="bg-gradiente-marca absolute -inset-4 rounded-[2rem] opacity-40 blur-3xl" />

        <div className="relative rounded-[1.75rem] border border-white/10 bg-white/[0.06] p-2 shadow-2xl backdrop-blur-xl">
          <div className="rounded-[1.4rem] bg-white p-6 text-noite-900 sm:p-7">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="bg-brand-50 text-brand-600 flex size-10 items-center justify-center rounded-xl">
                  <FileText className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Contrato de Prestação de Serviços</p>
                  <p className="font-mono text-[11px] text-slate-500">LS-7F3K-9Q2M · 4 páginas</p>
                </div>
              </div>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-500',
                  assinado ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800',
                )}
              >
                {assinado ? 'Concluído' : 'Em andamento'}
              </span>
            </div>

            {/* Linhas de "texto" do contrato */}
            <div className="mt-6 space-y-2">
              {[100, 94, 97, 72].map((largura, indice) => (
                <div
                  key={indice}
                  className="h-2 rounded-full bg-slate-100"
                  style={{ width: `${largura}%` }}
                />
              ))}
            </div>

            <ul className="mt-6 space-y-2.5">
              {ETAPAS.map(({ icone: Icone, rotulo, detalhe }, indice) => {
                const concluida = passo > indice;
                const ativa = passo === indice;

                return (
                  <li
                    key={rotulo}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-500',
                      concluida && 'border-emerald-200 bg-emerald-50/60',
                      ativa && 'border-brand-200 bg-brand-50/70',
                      !concluida && !ativa && 'border-slate-100',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-8 items-center justify-center rounded-lg transition-colors',
                        concluida
                          ? 'bg-emerald-500 text-white'
                          : ativa
                            ? 'bg-brand-600 text-white'
                            : 'bg-slate-100 text-slate-400',
                      )}
                    >
                      <Icone className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">{rotulo}</p>
                      <p className="truncate text-[11px] text-slate-500">{detalhe}</p>
                    </div>
                    {concluida ? (
                      <CheckCircle2 className="size-5 text-emerald-500" />
                    ) : ativa ? (
                      <Loader2 className="text-brand-500 size-5 animate-spin" />
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {/* A assinatura sendo desenhada */}
            <div className="mt-6 flex items-end justify-between gap-4 border-t border-dashed border-slate-200 pt-4">
              <div className="flex-1">
                <svg viewBox="0 0 240 70" className="h-14 w-full">
                  <motion.path
                    d="M6 48c14-4 20-30 30-30s4 28 14 28 12-34 22-34 4 30 14 30c8 0 10-18 18-18s6 14 14 14c10 0 14-22 24-22 8 0 4 16 12 16s14-10 22-12 14 0 24-2"
                    fill="none"
                    stroke="#312e81"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={false}
                    animate={{ pathLength: assinado ? 1 : 0, opacity: assinado ? 1 : 0.15 }}
                    transition={{ duration: assinado ? 1.2 : 0.3, ease: 'easeInOut' }}
                  />
                </svg>
                <p className="mt-1 text-[11px] text-slate-500">Mariana Albuquerque · CPF •••.•••.•••-42</p>
              </div>
              <motion.div
                animate={{ scale: assinado ? 1 : 0.85, opacity: assinado ? 1 : 0.35 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50"
              >
                <MiniQr />
              </motion.div>
            </div>
          </div>
        </div>

        {/* Cartão flutuante do selo criptográfico */}
        <motion.div
          animate={{ opacity: assinado ? 1 : 0, y: assinado ? 0 : 10 }}
          transition={{ duration: 0.5 }}
          className="bg-noite-900/90 absolute -bottom-6 -left-4 flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 shadow-2xl backdrop-blur-xl sm:-left-10"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-white">Selo Ed25519 válido</p>
            <p className="font-mono text-[10px] text-white/50">sha256 · 9f2c…e41a</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/** Um QR decorativo determinístico — não codifica nada, só dá a forma. */
function MiniQr() {
  const celulas = [
    '1110111', '1010101', '1110111', '0001000', '1011101', '0110110', '1101011',
  ];

  return (
    <svg viewBox="0 0 7 7" className="size-11" shapeRendering="crispEdges">
      {celulas.flatMap((linha, y) =>
        [...linha].map((valor, x) =>
          valor === '1' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0a0e1c" /> : null,
        ),
      )}
    </svg>
  );
}
