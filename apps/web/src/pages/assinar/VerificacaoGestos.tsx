import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Hand, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Botao } from '@/components/ui/Botao';
import { Alerta } from '@/components/ui/Estados';
import type { ApiDeAssinatura, Gesto } from '@/lib/api/assinatura';
import { mensagemDoErro } from '@/lib/erros';
import { cn } from '@/lib/cn';
import { GESTOS } from './gestos';
import { MENSAGEM_DA_CAMERA, useCamera } from './useCamera';

const VERSAO_DO_MEDIAPIPE = '0.10.35';
const MODELO =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
/** Quadros seguidos com o gesto certo para aceitá-lo — evita aceitar um gesto de passagem. */
const QUADROS_PARA_ACEITAR = 10;
const CONFIANCA_MINIMA = 0.6;
const TEMPO_LIMITE_MS = 90_000;

type Fase = 'inicio' | 'preparando' | 'reconhecendo' | 'enviando' | 'aprovada' | 'erro';

export function VerificacaoGestos({
  api,
  aoAprovar,
}: {
  readonly api: ApiDeAssinatura;
  readonly aoAprovar: () => void;
}) {
  const {
    video: refDoVideo,
    estado: estadoDaCamera,
    ligar: ligarCamera,
    desligar: desligarCamera,
  } = useCamera();
  const [fase, definirFase] = useState<Fase>('inicio');
  const [sequencia, definirSequencia] = useState<Gesto[]>([]);
  const [indice, definirIndice] = useState(0);
  const [segurando, definirSegurando] = useState(0);
  const [visto, definirVisto] = useState<{ gesto: string; confianca: number } | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const ativo = useRef(false);

  useEffect(() => () => void (ativo.current = false), []);

  const comecar = async () => {
    definirErro(null);
    definirFase('preparando');
    definirIndice(0);

    try {
      const [desafio, visao] = await Promise.all([
        api.iniciarGestos(),
        import('@mediapipe/tasks-vision'),
      ]);
      const arquivos = await visao.FilesetResolver.forVisionTasks(
        `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSAO_DO_MEDIAPIPE}/wasm`,
      );
      const reconhecedor = await visao.GestureRecognizer.createFromOptions(arquivos, {
        baseOptions: { modelAssetPath: MODELO, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 1,
      });

      if (!(await ligarCamera())) {
        reconhecedor.close();
        definirFase('erro');
        return;
      }

      definirSequencia(desafio.sequencia);
      definirFase('reconhecendo');
      ativo.current = true;

      const resultado = await reconhecer(reconhecedor, desafio.sequencia);

      ativo.current = false;
      reconhecedor.close();
      desligarCamera();

      if (resultado === null) return;

      definirFase('enviando');
      await api.concluirGestos(desafio.desafio, resultado.gestos, resultado.confiancas);
      definirFase('aprovada');
      window.setTimeout(aoAprovar, 900);
    } catch (causa) {
      ativo.current = false;
      desligarCamera();
      definirErro(mensagemDoErro(causa));
      definirFase('erro');
    }
  };

  const reconhecer = (
    reconhecedor: {
      recognizeForVideo: (
        video: HTMLVideoElement,
        instante: number,
      ) => { gestures: { categoryName: string; score: number }[][] };
    },
    pedida: Gesto[],
  ) =>
    new Promise<{ gestos: Gesto[]; confiancas: number[] } | null>((resolver) => {
      const video = refDoVideo.current as HTMLVideoElement;
      const inicio = performance.now();
      const gestos: Gesto[] = [];
      const confiancas: number[] = [];
      let seguidos: number[] = [];
      let ultimoQuadro = -1;

      const passo = () => {
        if (!ativo.current) return resolver(null);

        if (performance.now() - inicio > TEMPO_LIMITE_MS) {
          definirErro('O tempo acabou. Deixe a mão inteira visível, com boa luz, e tente de novo.');
          definirFase('erro');
          return resolver(null);
        }

        if (video.currentTime !== ultimoQuadro) {
          ultimoQuadro = video.currentTime;

          const categoria = reconhecedor.recognizeForVideo(video, performance.now())
            .gestures[0]?.[0];
          const esperado = pedida[gestos.length];

          definirVisto(
            categoria && categoria.categoryName !== 'None'
              ? { gesto: categoria.categoryName, confianca: categoria.score }
              : null,
          );

          if (categoria?.categoryName === esperado && categoria.score >= CONFIANCA_MINIMA) {
            seguidos.push(categoria.score);
          } else {
            seguidos = seguidos.slice(0, Math.max(0, seguidos.length - 2));
          }

          definirSegurando(Math.min(1, seguidos.length / QUADROS_PARA_ACEITAR));

          if (seguidos.length >= QUADROS_PARA_ACEITAR) {
            gestos.push(esperado);
            confiancas.push(
              Math.round((seguidos.reduce((a, b) => a + b, 0) / seguidos.length) * 1000) / 1000,
            );
            seguidos = [];
            definirIndice(gestos.length);
            definirSegurando(0);

            if (gestos.length === pedida.length) return resolver({ gestos, confiancas });
          }
        }

        requestAnimationFrame(passo);
      };

      requestAnimationFrame(passo);
    });

  const atual = sequencia[indice];

  return (
    <div className="space-y-5">
      {sequencia.length > 0 && (
        <ol className="grid grid-cols-3 gap-3" aria-label="Sequência de gestos">
          {sequencia.map((gesto, i) => {
            const { rotulo, icone: Icone } = GESTOS[gesto];
            const feito = i < indice;
            const agora = i === indice && fase === 'reconhecendo';

            return (
              <li
                key={gesto}
                aria-current={agora ? 'step' : undefined}
                className={cn(
                  'relative flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition-all',
                  feito
                    ? 'border-sucesso bg-sucesso-suave'
                    : agora
                      ? 'border-destaque bg-destaque-suave scale-105 shadow-brilho'
                      : 'border-linha bg-superficie opacity-70',
                )}
              >
                <span className="text-tinta-3 absolute top-2 left-3 text-xs font-bold numeros">
                  {i + 1}
                </span>
                {feito ? (
                  <CheckCircle2 className="text-sucesso-tinta size-9" aria-hidden="true" />
                ) : (
                  <Icone className={cn('size-9', agora ? 'text-destaque' : 'text-tinta-2')} />
                )}
                <span className="text-tinta text-xs font-semibold leading-tight">{rotulo}</span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="bg-noite-900 relative mx-auto aspect-[4/3] w-full max-w-lg overflow-hidden rounded-3xl">
        <video
          ref={refDoVideo}
          muted
          playsInline
          className={cn(
            'size-full -scale-x-100 object-cover',
            fase === 'reconhecendo' ? 'opacity-100' : 'opacity-0',
          )}
        />

        {fase === 'reconhecendo' && atual && (
          <>
            <div className="absolute inset-x-0 top-0 flex justify-between p-3 text-xs font-semibold text-white">
              <span className="rounded-full bg-black/50 px-2.5 py-1 backdrop-blur">
                {visto
                  ? `Vendo: ${GESTOS[visto.gesto as Gesto]?.rotulo ?? visto.gesto} · ${Math.round(visto.confianca * 100)}%`
                  : 'Mostre a mão inteira'}
              </span>
            </div>
            <div
              className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/60 px-4 py-3 text-white backdrop-blur"
              aria-live="assertive"
            >
              <p className="text-center text-base font-semibold">Faça: {GESTOS[atual].rotulo}</p>
              <p className="mt-0.5 text-center text-xs text-white/70">
                {GESTOS[atual].dica} — segure por um instante
              </p>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-150"
                  style={{ width: `${segurando * 100}%` }}
                />
              </div>
            </div>
          </>
        )}

        {fase !== 'reconhecendo' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
            {fase === 'inicio' && (
              <>
                <span className="bg-gradiente-marca flex size-20 items-center justify-center rounded-3xl shadow-brilho">
                  <Hand className="size-10" aria-hidden="true" />
                </span>
                <p className="max-w-xs text-sm text-white/75">
                  Vamos sortear três gestos. Faça cada um diante da câmera e segure até a barra
                  encher.
                </p>
              </>
            )}
            {(fase === 'preparando' || fase === 'enviando') && (
              <>
                <Loader2 className="size-10 animate-spin text-brand-300" aria-hidden="true" />
                <p className="text-sm text-white/75">
                  {fase === 'preparando'
                    ? 'Carregando o reconhecimento de gestos…'
                    : 'Registrando a verificação…'}
                </p>
              </>
            )}
            {fase === 'aprovada' && (
              <>
                <CheckCircle2 className="size-16 text-emerald-400" aria-hidden="true" />
                <p className="text-lg font-semibold">Gestos confirmados</p>
              </>
            )}
            {fase === 'erro' && <Camera className="size-12 text-white/40" aria-hidden="true" />}
          </div>
        )}
      </div>

      {erro && <Alerta tom="perigo">{erro}</Alerta>}
      {(estadoDaCamera === 'negada' || estadoDaCamera === 'indisponivel') && (
        <Alerta tom="alerta">{MENSAGEM_DA_CAMERA[estadoDaCamera]}</Alerta>
      )}

      {(fase === 'inicio' || fase === 'erro') && (
        <div className="flex flex-col items-center gap-3">
          <Botao
            tamanho="lg"
            icone={
              fase === 'erro' ? <RefreshCw className="size-4" /> : <Camera className="size-4" />
            }
            onClick={() => void comecar()}
          >
            {fase === 'erro' ? 'Tentar de novo' : 'Ligar a câmera e começar'}
          </Botao>
          <p className="text-tinta-3 flex items-center gap-1.5 text-center text-xs">
            <ShieldCheck className="size-3.5" aria-hidden="true" /> O reconhecimento roda no seu
            dispositivo (MediaPipe). Nada da câmera é enviado.
          </p>
        </div>
      )}
    </div>
  );
}
