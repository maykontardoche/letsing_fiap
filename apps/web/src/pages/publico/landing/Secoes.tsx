import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Building2,
  EyeOff,
  FileSignature,
  FileUp,
  Fingerprint,
  Hand,
  KeyRound,
  Link2,
  Lock,
  Mic,
  QrCode,
  ScanFace,
  ServerCog,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { estilosDeBotao } from '@/components/ui/Botao';
import { cn } from '@/lib/cn';

/** Cabeçalho padrão de seção: sobretítulo, título e descrição. */
function Titulo({
  sobre,
  titulo,
  descricao,
  claro = false,
}: {
  readonly sobre: string;
  readonly titulo: ReactNode;
  readonly descricao: string;
  readonly claro?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p
        className={cn(
          'text-sm font-semibold tracking-wider uppercase',
          claro ? 'text-ciano-300' : 'text-destaque',
        )}
      >
        {sobre}
      </p>
      <h2
        className={cn(
          'mt-3 text-3xl font-extrabold sm:text-4xl',
          claro ? 'text-white' : 'text-tinta',
        )}
      >
        {titulo}
      </h2>
      <p className={cn('mt-4 text-lg', claro ? 'text-white/65' : 'text-tinta-2')}>{descricao}</p>
    </div>
  );
}

/** Aparece ao entrar na viewport — uma vez só, sem piscar ao rolar de volta. */
function Surgir({ children, atraso = 0, className }: { readonly children: ReactNode; readonly atraso?: number; readonly className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, delay: atraso, ease: [0.2, 0.8, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------

const NORMAS = [
  'Lei 14.063/2020',
  'MP 2.200-2/2001',
  'LGPD · Lei 13.709/2018',
  'RFC 8032 · Ed25519',
  'FIPS 180-4 · SHA-256',
  'WCAG 2.2 AA',
];

export function FaixaDeNormas() {
  return (
    <section aria-label="Normas e padrões" className="border-linha bg-superficie border-y">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-6 lg:px-8">
        {NORMAS.map((norma) => (
          <span key={norma} className="text-tinta-3 flex items-center gap-2 text-sm font-medium">
            <BadgeCheck className="text-destaque size-4" aria-hidden="true" />
            {norma}
          </span>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const PASSOS = [
  {
    icone: FileUp,
    titulo: 'Envie o PDF',
    texto: 'O arquivo recebe uma impressão digital SHA-256 no instante do upload. Qualquer alteração depois disso é detectável.',
  },
  {
    icone: UserPlus,
    titulo: 'Convide quem assina',
    texto: 'Defina a ordem, o prazo e o nível de verificação. Cada pessoa recebe um link único e intransferível por e-mail.',
  },
  {
    icone: ScanFace,
    titulo: 'Identidade comprovada',
    texto: 'Código por e-mail, rosto com prova de vida, voz e gestos — conforme o nível exigido pelo documento.',
  },
  {
    icone: FileSignature,
    titulo: 'Documento selado',
    texto: 'O PDF final ganha manifesto de assinaturas, QR Code de validação e o selo criptográfico da plataforma.',
  },
] as const;

export function ComoFunciona() {
  return (
    <section id="como-funciona" className="scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Titulo
          sobre="Como funciona"
          titulo="Do upload ao documento selado em quatro passos"
          descricao="Sem instalar nada, sem certificado físico. Quem assina só precisa de um navegador — no computador ou no celular."
        />

        <ol className="relative mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PASSOS.map(({ icone: Icone, titulo, texto }, indice) => (
            <Surgir key={titulo} atraso={indice * 0.08}>
              <li className="border-linha bg-superficie shadow-cartao group relative h-full rounded-[var(--radius-cartao)] border p-6 transition hover:-translate-y-1 hover:shadow-elevada">
                <span className="font-display text-tinta-3/40 absolute top-5 right-6 text-5xl font-extrabold">
                  {indice + 1}
                </span>
                <span className="bg-gradiente-marca-texto shadow-brilho flex size-12 items-center justify-center rounded-2xl text-white">
                  <Icone className="size-6" aria-hidden="true" />
                </span>
                <h3 className="text-tinta mt-5 text-lg font-bold">{titulo}</h3>
                <p className="text-tinta-2 mt-2 text-sm leading-relaxed">{texto}</p>
              </li>
            </Surgir>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const VERIFICACOES = [
  {
    icone: ScanFace,
    titulo: 'Rosto com prova de vida',
    texto: 'Detecção facial em tempo real com desafio aleatório: piscar, virar à esquerda, virar à direita. Foto impressa ou tela não passam.',
    cor: 'from-brand-500 to-violeta-600',
  },
  {
    icone: Mic,
    titulo: 'Desafio de voz',
    texto: 'O servidor sorteia palavras que só valem por cinco minutos. A pessoa fala, o navegador transcreve, o servidor confere.',
    cor: 'from-violeta-600 to-fuchsia-500',
  },
  {
    icone: Hand,
    titulo: 'Sequência de gestos',
    texto: 'Uma sequência de gestos com a mão, sorteada a cada tentativa e reconhecida por visão computacional (MediaPipe).',
    cor: 'from-ciano-500 to-brand-500',
  },
] as const;

export function Biometria() {
  return (
    <section
      id="biometria"
      className="bg-noite-950 relative isolate scroll-mt-16 overflow-hidden py-24 text-white sm:py-32"
    >
      <div aria-hidden="true" className="grade-de-fundo absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -z-10 h-[40rem] w-[60rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.25),transparent)]"
      />

      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Titulo
          claro
          sobre="Verificação de identidade"
          titulo={
            <>
              Três camadas de biometria. <span className="texto-gradiente">Zero biometria armazenada.</span>
            </>
          }
          descricao="A análise acontece no dispositivo de quem assina. Para o servidor vão só o resultado e a pontuação — nunca imagem, áudio ou vetor biométrico."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {VERIFICACOES.map(({ icone: Icone, titulo, texto, cor }, indice) => (
            <Surgir key={titulo} atraso={indice * 0.1}>
              <article className="group relative h-full overflow-hidden rounded-[var(--radius-cartao)] border border-white/10 bg-white/[0.04] p-7 backdrop-blur transition hover:border-white/25 hover:bg-white/[0.07]">
                <div
                  aria-hidden="true"
                  className={cn(
                    'absolute -top-16 -right-16 size-40 rounded-full bg-gradient-to-br opacity-25 blur-2xl transition group-hover:opacity-45',
                    cor,
                  )}
                />
                <span
                  className={cn(
                    'relative flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg',
                    cor,
                  )}
                >
                  <Icone className="size-6" aria-hidden="true" />
                </span>
                <h3 className="relative mt-6 text-xl font-bold">{titulo}</h3>
                <p className="relative mt-3 leading-relaxed text-white/65">{texto}</p>
              </article>
            </Surgir>
          ))}
        </div>

        <Surgir atraso={0.2}>
          <div className="mx-auto mt-10 flex max-w-3xl items-start gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-5">
            <EyeOff className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-emerald-50/80">
              <strong className="text-emerald-200">Privacidade por desenho (LGPD, art. 5º, II).</strong>{' '}
              Biometria é dado pessoal sensível. Por isso o processamento é local e o LetsSign
              guarda apenas a evidência do resultado — o que basta para a trilha de auditoria e
              não expõe ninguém num eventual vazamento.
            </p>
          </div>
        </Surgir>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const PILARES = [
  { icone: KeyRound, titulo: 'Assinatura Ed25519', texto: 'Cada assinatura é uma assinatura digital de curva elíptica sobre uma carga canônica. Chave pública publicada.' },
  { icone: Fingerprint, titulo: 'Integridade SHA-256', texto: 'Hash do original e do PDF final. Um byte alterado e a validação pública denuncia.' },
  { icone: Link2, titulo: 'Trilha encadeada', texto: 'Cada evento guarda o hash do anterior, como uma blockchain privada. Apagar ou editar quebra a cadeia.' },
  { icone: Lock, titulo: 'Dados cifrados', texto: 'CPF e segredos de MFA ficam em repouso com AES-256-GCM, cifra autenticada.' },
  { icone: Building2, titulo: 'Isolamento multiempresa', texto: 'Toda query é escopada pela organização no servidor, com teste de isolamento como gate da suíte.' },
  { icone: ServerCog, titulo: 'Sessão blindada', texto: 'Sessão server-side em Redis, cookie httpOnly, MFA TOTP, CSP rígida e limite de tentativas.' },
] as const;

export function Seguranca() {
  return (
    <section id="seguranca" className="scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Titulo
          sobre="Segurança de ponta a ponta"
          titulo="Engenharia de sistema financeiro, para qualquer contrato"
          descricao="Não é um PDF com uma imagem colada. É criptografia verificável, do upload ao download."
        />

        <div className="mt-16 grid gap-px overflow-hidden rounded-[var(--radius-cartao)] border border-linha bg-linha sm:grid-cols-2 lg:grid-cols-3">
          {PILARES.map(({ icone: Icone, titulo, texto }, indice) => (
            <Surgir key={titulo} atraso={(indice % 3) * 0.06} className="bg-superficie">
              <div className="group h-full p-7 transition hover:bg-superficie-2">
                <Icone className="text-destaque size-7 transition group-hover:scale-110" aria-hidden="true" />
                <h3 className="text-tinta mt-5 font-bold">{titulo}</h3>
                <p className="text-tinta-2 mt-2 text-sm leading-relaxed">{texto}</p>
              </div>
            </Surgir>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function ValidacaoPublica() {
  return (
    <section className="pb-24 sm:pb-32">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Surgir>
          <div className="bg-noite-900 relative isolate overflow-hidden rounded-[2rem] px-8 py-14 text-white sm:px-14 lg:flex lg:items-center lg:gap-14">
            <div aria-hidden="true" className="bg-gradiente-marca absolute -top-24 -right-24 -z-10 size-80 rounded-full opacity-40 blur-3xl" />
            <div className="lg:flex-1">
              <p className="text-ciano-300 text-sm font-semibold tracking-wider uppercase">Validação pública</p>
              <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
                Recebeu um documento? Confira se é autêntico.
              </h2>
              <p className="mt-4 max-w-xl text-lg text-white/65">
                Aponte a câmera para o QR Code, digite o código impresso no rodapé ou simplesmente
                arraste o PDF. O hash é calculado no seu navegador — o arquivo não é enviado.
              </p>
              <Link to="/validar" className={cn(estilosDeBotao('claro', 'lg'), 'mt-8')}>
                Validar documento
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-12 grid shrink-0 grid-cols-2 gap-3 lg:mt-0 lg:w-80">
              {[
                { icone: QrCode, texto: 'QR Code' },
                { icone: Fingerprint, texto: 'Hash do arquivo' },
                { icone: ShieldCheck, texto: 'Selo Ed25519' },
                { icone: Blocks, texto: 'Trilha íntegra' },
              ].map(({ icone: Icone, texto }) => (
                <div key={texto} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur">
                  <Icone className="text-ciano-300 mx-auto size-7" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium text-white/80">{texto}</p>
                </div>
              ))}
            </div>
          </div>
        </Surgir>
      </div>
    </section>
  );
}
