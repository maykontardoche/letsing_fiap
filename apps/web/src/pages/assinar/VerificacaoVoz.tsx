import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Mic, MicOff, RefreshCw } from 'lucide-react';
import { Botao } from '@/components/ui/Botao';
import { Alerta } from '@/components/ui/Estados';
import type { ApiDeAssinatura } from '@/lib/api/assinatura';
import { mensagemDoErro } from '@/lib/erros';
import { cn } from '@/lib/cn';

/** O mínimo da Web Speech API que usamos — o lib.dom do TypeScript não a declara em todos os navegadores. */
interface ResultadoDeFala {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}

interface ReconhecedorDeFala {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((evento: { results: ArrayLike<ResultadoDeFala> }) => void) | null;
  onerror: ((evento: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type Construtor = new () => ReconhecedorDeFala;

function construtorDaFala(): Construtor | null {
  const janela = window as unknown as {
    SpeechRecognition?: Construtor;
    webkitSpeechRecognition?: Construtor;
  };

  return janela.SpeechRecognition ?? janela.webkitSpeechRecognition ?? null;
}

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ');

const junto = (texto: string) => normalizar(texto).replace(/\s/g, '');

function todasDitas(texto: string, palavras: readonly string[]): boolean {
  return palavras.every((palavra) => junto(texto).includes(junto(palavra)));
}

const ERROS_DE_FALA: Record<string, string> = {
  'not-allowed':
    'O acesso ao microfone foi negado. Permita o microfone na barra de endereço e tente de novo.',
  'no-speech': 'Não ouvimos nada. Fale perto do microfone e tente de novo.',
  'audio-capture': 'Nenhum microfone encontrado.',
  network: 'O reconhecimento de voz precisa de internet. Verifique a conexão.',
};

export function VerificacaoVoz({
  api,
  aoAprovar,
}: {
  readonly api: ApiDeAssinatura;
  readonly aoAprovar: () => void;
}) {
  const Reconhecedor = construtorDaFala();
  const [desafio, definirDesafio] = useState<{ id: string; palavras: string[] } | null>(null);
  const [ouvindo, definirOuvindo] = useState(false);
  const [transcricao, definirTranscricao] = useState('');
  const [enviando, definirEnviando] = useState(false);
  const [aprovada, definirAprovada] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const reconhecedor = useRef<ReconhecedorDeFala | null>(null);
  const final = useRef('');

  useEffect(() => () => reconhecedor.current?.abort(), []);

  if (Reconhecedor === null) {
    return (
      <Alerta tom="alerta" titulo="Seu navegador não reconhece voz">
        O desafio de voz usa o reconhecimento de fala do navegador, disponível no Google Chrome e no
        Microsoft Edge. Abra este mesmo link num deles para continuar.
      </Alerta>
    );
  }

  const obterDesafio = async () => {
    definirErro(null);

    try {
      const novo = await api.iniciarVoz();

      definirDesafio({ id: novo.desafio, palavras: novo.palavras });
      definirTranscricao('');
    } catch (causa) {
      definirErro(mensagemDoErro(causa));
    }
  };

  const enviar = async (texto: string) => {
    if (!desafio) return;

    definirEnviando(true);

    try {
      await api.concluirVoz(desafio.id, texto);
      definirAprovada(true);
      window.setTimeout(aoAprovar, 900);
    } catch (causa) {
      definirErro(mensagemDoErro(causa));
    } finally {
      definirEnviando(false);
    }
  };

  const ouvir = () => {
    definirErro(null);
    definirTranscricao('');
    final.current = '';

    const novo = new Reconhecedor();

    novo.lang = 'pt-BR';
    novo.interimResults = true;
    novo.continuous = true;
    novo.maxAlternatives = 1;
    novo.onresult = (evento) => {
      let parcial = '';
      let definitivo = '';

      for (const resultado of Array.from(evento.results)) {
        if (resultado.isFinal) definitivo += `${resultado[0].transcript} `;
        else parcial += resultado[0].transcript;
      }

      final.current = definitivo;
      definirTranscricao(`${definitivo}${parcial}`.trim());

      // Já disse tudo? Não precisa esperar o silêncio. (Quem confere de verdade é o servidor.)
      if (desafio && todasDitas(definitivo, desafio.palavras)) novo.stop();
    };
    novo.onerror = (evento) => {
      if (evento.error !== 'aborted')
        definirErro(
          ERROS_DE_FALA[evento.error] ?? 'O reconhecimento de voz falhou. Tente de novo.',
        );
    };
    novo.onend = () => {
      definirOuvindo(false);

      if (final.current.trim().length > 0) void enviar(final.current.trim());
    };

    reconhecedor.current = novo;
    novo.start();
    definirOuvindo(true);
  };

  return (
    <div className="space-y-5">
      {desafio === null ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="bg-gradiente-marca flex size-20 items-center justify-center rounded-3xl text-white shadow-brilho">
            <Mic className="size-10" aria-hidden="true" />
          </span>
          <p className="text-tinta-2 max-w-sm text-sm">
            Vamos sortear três palavras. Fale todas em voz alta — em qualquer ordem — quando o
            microfone ligar.
          </p>
          <Botao tamanho="lg" onClick={() => void obterDesafio()}>
            Sortear palavras
          </Botao>
        </div>
      ) : (
        <>
          <div>
            <p className="text-tinta-3 mb-3 text-center text-xs font-semibold tracking-wide uppercase">
              Fale estas palavras
            </p>
            <ul className="flex flex-wrap justify-center gap-3">
              {desafio.palavras.map((palavra) => {
                const dita = todasDitas(transcricao, [palavra]);

                return (
                  <li
                    key={palavra}
                    className={cn(
                      'font-display rounded-2xl border-2 px-5 py-3 text-xl font-bold transition-all duration-300',
                      dita
                        ? 'border-sucesso bg-sucesso-suave text-sucesso-tinta scale-105'
                        : 'border-linha bg-superficie text-tinta',
                    )}
                  >
                    {dita && (
                      <CheckCircle2
                        className="mr-1.5 inline size-5 align-[-3px]"
                        aria-hidden="true"
                      />
                    )}
                    {palavra}
                  </li>
                );
              })}
            </ul>
          </div>

          <div
            className="border-linha bg-superficie-2/60 flex min-h-20 items-center justify-center rounded-2xl border p-4 text-center"
            aria-live="polite"
          >
            {ouvindo ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-8 items-end gap-1" aria-hidden="true">
                  {Array.from({ length: 7 }, (_, i) => (
                    <span
                      key={i}
                      className="bg-destaque w-1.5 rounded-full"
                      style={{
                        height: '100%',
                        animation: `pulso-suave ${0.6 + (i % 3) * 0.2}s ease-in-out ${i * 0.08}s infinite`,
                      }}
                    />
                  ))}
                </div>
                <p className="text-tinta text-sm">{transcricao || 'Ouvindo… pode falar.'}</p>
              </div>
            ) : (
              <p className="text-tinta-3 text-sm">
                {transcricao ? `Você disse: “${transcricao}”` : 'O que você falar aparece aqui.'}
              </p>
            )}
          </div>

          {erro && <Alerta tom="perigo">{erro}</Alerta>}

          <div className="flex flex-wrap justify-center gap-2">
            {aprovada ? (
              <p className="text-sucesso-tinta flex items-center gap-2 font-semibold">
                <CheckCircle2 className="size-5" /> Voz confirmada
              </p>
            ) : enviando ? (
              <p className="text-tinta-2 flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" /> Conferindo…
              </p>
            ) : ouvindo ? (
              <Botao
                variante="secundario"
                icone={<MicOff className="size-4" />}
                onClick={() => reconhecedor.current?.stop()}
              >
                Terminei de falar
              </Botao>
            ) : (
              <>
                <Botao tamanho="lg" icone={<Mic className="size-4" />} onClick={ouvir}>
                  {transcricao ? 'Falar de novo' : 'Ligar o microfone'}
                </Botao>
                <Botao
                  variante="fantasma"
                  icone={<RefreshCw className="size-4" />}
                  onClick={() => void obterDesafio()}
                >
                  Outras palavras
                </Botao>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
