import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Fingerprint, ScanFace, ShieldCheck } from 'lucide-react';
import { estilosDeBotao } from '@/components/ui/Botao';
import { DocumentoAnimado } from './DocumentoAnimado';

const SELOS = [
  { icone: ShieldCheck, texto: 'Lei 14.063/2020' },
  { icone: Fingerprint, texto: 'Ed25519 + SHA-256' },
  { icone: ScanFace, texto: 'Biometria sem sair do dispositivo' },
] as const;

export function Hero() {
  return (
    <section className="bg-noite-950 relative isolate overflow-hidden pt-32 pb-24 text-white lg:pt-40 lg:pb-32">
      {/* Luzes e grade de fundo — decoração, fora da árvore de acessibilidade. */}
      <div aria-hidden="true" className="grade-de-fundo absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="absolute -top-40 left-1/2 -z-10 h-[38rem] w-[70rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.35),transparent)] blur-2xl"
      />
      <div
        aria-hidden="true"
        className="absolute top-60 -right-40 -z-10 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(6,182,212,0.22),transparent)] blur-2xl"
      />

      <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 lg:grid-cols-[1.05fr_1fr] lg:px-8">
        <div>
          <motion.a
            href="#biometria"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pr-3 pl-1 text-xs font-medium text-white/80 backdrop-blur transition hover:border-white/30"
          >
            <span className="bg-gradiente-marca-texto rounded-full px-2 py-0.5 text-[11px] font-semibold text-white">
              Novo
            </span>
            Verificação por rosto, voz e gestos
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </motion.a>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="mt-6 text-4xl leading-[1.05] font-extrabold sm:text-5xl lg:text-6xl"
          >
            Assine documentos com a{' '}
            <span className="texto-gradiente">certeza de quem assinou</span>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-white/70"
          >
            O LetsSign combina verificação de identidade biométrica, assinatura criptográfica
            Ed25519 e uma trilha de auditoria à prova de adulteração. Cada documento sai com
            QR Code de validação pública — qualquer pessoa confere a autenticidade em segundos.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Link to="/cadastro" className={estilosDeBotao('claro', 'lg')}>
              Criar conta grátis
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link to="/validar" className={estilosDeBotao('vidro', 'lg')}>
              Validar um documento
            </Link>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/60"
          >
            {SELOS.map(({ icone: Icone, texto }) => (
              <li key={texto} className="flex items-center gap-2">
                <Icone className="size-4 text-ciano-300" aria-hidden="true" />
                {texto}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <DocumentoAnimado />
        </motion.div>
      </div>
    </section>
  );
}
