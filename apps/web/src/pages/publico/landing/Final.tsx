import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { Logo } from '@/components/marca/Logo';
import { estilosDeBotao } from '@/components/ui/Botao';

const PERGUNTAS = [
  {
    pergunta: 'A assinatura do LetsSign tem validade jurídica?',
    resposta:
      'Sim. A Lei 14.063/2020 e a MP 2.200-2/2001 reconhecem a assinatura eletrônica. O LetsSign produz assinatura eletrônica avançada: identifica o signatário de forma única, vincula a assinatura ao conteúdo (hash SHA-256) e detecta qualquer alteração posterior. Para os casos em que a lei exige assinatura qualificada com certificado ICP-Brasil, use um certificado digital.',
  },
  {
    pergunta: 'Minha foto, minha voz ou minha mão ficam guardadas?',
    resposta:
      'Não. O reconhecimento facial, a transcrição da voz e o reconhecimento de gestos rodam no seu navegador. O servidor recebe apenas o resultado — aprovado ou não e a pontuação —, que fica registrado na trilha de auditoria do documento.',
  },
  {
    pergunta: 'Quem assina precisa criar uma conta?',
    resposta:
      'Não. Cada signatário recebe um link único por e-mail. O link é uma credencial de uso pessoal: só o hash dele fica no banco, e ele expira junto com o prazo do documento.',
  },
  {
    pergunta: 'Como alguém confere se o documento é verdadeiro?',
    resposta:
      'Pelo QR Code ou pelo código impresso em todas as páginas, na página pública de validação. Também dá para arrastar o próprio PDF: o hash é calculado no navegador e comparado com o registrado. A página mostra quem assinou, quando, com quais verificações, e se o selo criptográfico e a trilha de auditoria estão íntegros.',
  },
  {
    pergunta: 'E se alguém editar o PDF depois de assinado?',
    resposta:
      'O hash muda, e a validação pública passa a dizer que o arquivo não corresponde a nenhum documento assinado. O selo Ed25519 cobre o hash exato do PDF emitido pela plataforma.',
  },
] as const;

export function Perguntas() {
  return (
    <section id="perguntas" className="scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-5 lg:px-8">
        <div className="text-center">
          <p className="text-destaque text-sm font-semibold tracking-wider uppercase">Dúvidas</p>
          <h2 className="text-tinta mt-3 text-3xl font-extrabold sm:text-4xl">Perguntas frequentes</h2>
        </div>

        {/* `<details>` nativo: acessível por teclado e leitor de tela sem nenhum JavaScript. */}
        <div className="mt-12 space-y-3">
          {PERGUNTAS.map(({ pergunta, resposta }) => (
            <details
              key={pergunta}
              className="group border-linha bg-superficie shadow-cartao rounded-2xl border px-6 py-5 open:shadow-elevada"
            >
              <summary className="text-tinta flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {pergunta}
                <ChevronDown
                  className="text-tinta-3 size-5 shrink-0 transition group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="text-tinta-2 mt-4 leading-relaxed">{resposta}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ChamadaFinal() {
  return (
    <section className="px-5 pb-24 sm:pb-32 lg:px-8">
      <div className="bg-gradiente-marca-texto relative isolate mx-auto max-w-5xl overflow-hidden rounded-[2rem] px-8 py-16 text-center text-white shadow-brilho sm:px-16">
        <div aria-hidden="true" className="grade-de-fundo absolute inset-0 -z-10 opacity-60" />
        <h2 className="text-3xl font-extrabold sm:text-4xl">Seu próximo contrato merece mais que um rabisco.</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
          Crie sua conta em menos de um minuto. Os 10 primeiros documentos do mês são por nossa conta.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/cadastro" className={estilosDeBotao('claro', 'lg')}>
            Criar conta grátis
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link to="/entrar" className={estilosDeBotao('vidro', 'lg')}>
            Já tenho conta
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Rodape() {
  return (
    <footer className="bg-noite-950 text-white/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="sm:col-span-2 lg:col-span-1">
          <Logo tom="claro" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            Assinatura eletrônica avançada com verificação de identidade biométrica e prova
            criptográfica.
          </p>
        </div>
        <nav aria-label="Produto">
          <p className="text-sm font-semibold text-white">Produto</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><a href="/#como-funciona" className="hover:text-white">Como funciona</a></li>
            <li><a href="/#biometria" className="hover:text-white">Biometria</a></li>
            <li><a href="/#planos" className="hover:text-white">Planos</a></li>
          </ul>
        </nav>
        <nav aria-label="Confiança">
          <p className="text-sm font-semibold text-white">Confiança</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/validar" className="hover:text-white">Validar documento</Link></li>
            <li><a href="/#seguranca" className="hover:text-white">Segurança</a></li>
            <li><a href="/#perguntas" className="hover:text-white">Perguntas frequentes</a></li>
          </ul>
        </nav>
        <nav aria-label="Conta">
          <p className="text-sm font-semibold text-white">Conta</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/entrar" className="hover:text-white">Entrar</Link></li>
            <li><Link to="/cadastro" className="hover:text-white">Criar conta</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-5 py-6 text-xs lg:px-8">
          © {new Date().getFullYear()} LetsSign · Projeto acadêmico FIAP · Feito com NestJS, React e
          criptografia de verdade.
        </p>
      </div>
    </footer>
  );
}
