import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  ScanFace,
  ShieldCheck,
} from 'lucide-react';
import { Botao } from '@/components/ui/Botao';
import { Alerta } from '@/components/ui/Estados';
import type { AcaoDeVivacidade, ApiDeAssinatura } from '@/lib/api/assinatura';
import { mensagemDoErro } from '@/lib/erros';
import { cn } from '@/lib/cn';
import { MENSAGEM_DA_CAMERA, useCamera } from './useCamera';

const MODELOS = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';
const TEMPO_LIMITE_MS = 60_000;
const QUADROS_PARA_CONFIRMAR = 3;

const ACOES: Record<AcaoDeVivacidade, { texto: string; icone: typeof Eye }> = {
  piscar: { texto: 'Pisque os olhos devagar', icone: Eye },
  virar_esquerda: { texto: 'Vire o rosto para a sua esquerda', icone: ArrowLeft },
  virar_direita: { texto: 'Vire o rosto para a sua direita', icone: ArrowRight },
};

interface Ponto {
  readonly x: number;
  readonly y: number;
}

const distancia = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * *Eye Aspect Ratio* (Soukupová & Čech, 2016): altura do olho sobre a largura.
 * Olho aberto fica perto de 0,3; fechado cai abaixo de 0,2. É o que detecta a piscada.
 */
function ear(olho: readonly Ponto[]): number {
  const [p0, p1, p2, p3, p4, p5] = olho as [Ponto, Ponto, Ponto, Ponto, Ponto, Ponto];

  return (distancia(p1, p5) + distancia(p2, p4)) / (2 * distancia(p0, p3));
}

/**
 * Onde o nariz está entre as duas bordas do rosto: 0,5 é de frente. Na imagem
 * crua (não espelhada) da câmera, virar para a **própria** esquerda leva o nariz
 * para a direita da imagem — o valor sobe.
 */
function giro(pontos: readonly Ponto[]): number {
  const bordaA = pontos[0];
  const bordaB = pontos[16];
  const nariz = pontos[30];

  return (nariz.x - bordaA.x) / (bordaB.x - bordaA.x);
}

type Fase = 'inicio' | 'preparando' | 'verificando' | 'enviando' | 'aprovada' | 'erro';

export function VerificacaoFacial({
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
  const [erro, definirErro] = useState<string | null>(null);
  const [acoes, definirAcoes] = useState<AcaoDeVivacidade[]>([]);
  const [indice, definirIndice] = useState(0);
  const [rostoVisivel, definirRostoVisivel] = useState(false);
  const [confianca, definirConfianca] = useState(0);
  const ativo = useRef(false);

  useEffect(() => () => void (ativo.current = false), []);

  const comecar = async () => {
    definirErro(null);
    definirFase('preparando');
    definirIndice(0);

    try {
      const [desafio, faceapi] = await Promise.all([
        api.iniciarFacial(),
        import('@vladmandic/face-api'),
      ]);

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODELOS),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODELOS),
      ]);

      if (!(await ligarCamera())) {
        definirFase('erro');
        return;
      }

      definirAcoes(desafio.acoes);
      definirFase('verificando');
      ativo.current = true;

      const medicao = await analisar(faceapi, desafio.acoes);

      ativo.current = false;
      desligarCamera();

      if (medicao === null) return;

      definirFase('enviando');
      await api.concluirFacial(desafio.desafio, medicao);
      definirFase('aprovada');
      window.setTimeout(aoAprovar, 900);
    } catch (causa) {
      ativo.current = false;
      desligarCamera();
      definirErro(mensagemDoErro(causa));
      definirFase('erro');
    }
  };

  /** O laço de análise. Devolve a medição quando todas as ações são cumpridas. */
  const analisar = async (
    faceapi: typeof import('@vladmandic/face-api'),
    pedidas: AcaoDeVivacidade[],
  ) => {
    const video = refDoVideo.current as HTMLVideoElement;
    const opcoes = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 });
    const inicio = Date.now();
    const cumpridas: AcaoDeVivacidade[] = [];
    let quadros = 0;
    let comRosto = 0;
    let multiplos = 0;
    let somaDeConfianca = 0;
    let seguidos = 0;
    let olhoFechado = false;
    let earAberto = 0.28;
    let neutroDesdeAUltima = true;

    while (ativo.current && cumpridas.length < pedidas.length) {
      if (Date.now() - inicio > TEMPO_LIMITE_MS) {
        definirErro(
          'O tempo acabou antes de concluir as ações. Procure um lugar bem iluminado e tente de novo.',
        );
        definirFase('erro');
        return null;
      }

      const deteccoes = await faceapi.detectAllFaces(video, opcoes).withFaceLandmarks();

      quadros += 1;

      if (deteccoes.length > 1) multiplos += 1;

      const unica = deteccoes.length === 1 ? deteccoes[0] : undefined;

      definirRostoVisivel(unica !== undefined);

      if (unica) {
        comRosto += 1;
        somaDeConfianca += unica.detection.score;
        definirConfianca(unica.detection.score);

        const pontos = unica.landmarks.positions;
        const abertura = (ear(pontos.slice(36, 42)) + ear(pontos.slice(42, 48))) / 2;
        const posicao = giro(pontos);
        const acao = pedidas[cumpridas.length];

        earAberto = Math.max(earAberto * 0.98, abertura);

        // Antes de cada nova ação, a pessoa precisa voltar a olhar de frente —
        // senão, "virar à esquerda" logo depois de "virar à esquerda" passaria sem movimento.
        if (!neutroDesdeAUltima && posicao > 0.4 && posicao < 0.6) neutroDesdeAUltima = true;

        let cumpriu = false;

        if (acao === 'piscar') {
          if (abertura < earAberto * 0.7) olhoFechado = true;
          else if (olhoFechado && abertura > earAberto * 0.85) cumpriu = true;
        } else if (neutroDesdeAUltima) {
          cumpriu = acao === 'virar_esquerda' ? posicao > 0.64 : posicao < 0.36;
        }

        seguidos = cumpriu ? (acao === 'piscar' ? QUADROS_PARA_CONFIRMAR : seguidos + 1) : 0;

        if (seguidos >= QUADROS_PARA_CONFIRMAR) {
          cumpridas.push(acao);
          definirIndice(cumpridas.length);
          seguidos = 0;
          olhoFechado = false;
          neutroDesdeAUltima = false;
        }
      }

      await new Promise((resolver) => window.setTimeout(resolver, 60));
    }

    // Alguns quadros a mais garantem a amostra mínima que o servidor exige.
    while (ativo.current && quadros < 12) {
      const extra = await faceapi.detectAllFaces(video, opcoes);

      quadros += 1;
      if (extra.length === 1) {
        comRosto += 1;
        somaDeConfianca += extra[0]?.score ?? 0;
      }
    }

    return {
      acoes: cumpridas,
      quadrosAnalisados: quadros,
      quadrosComRosto: comRosto,
      confiancaMedia: comRosto === 0 ? 0 : Math.round((somaDeConfianca / comRosto) * 1000) / 1000,
      rostosMultiplos: multiplos > 5,
    };
  };

  const acaoAtual = acoes[indice];

  return (
    <div className="space-y-5">
      <div className="bg-noite-900 relative mx-auto aspect-[4/3] w-full max-w-lg overflow-hidden rounded-3xl">
        {/* Espelhado só na exibição — a análise usa a imagem crua. */}
        <video
          ref={refDoVideo}
          muted
          playsInline
          className={cn(
            'size-full -scale-x-100 object-cover transition-opacity',
            fase === 'verificando' ? 'opacity-100' : 'opacity-0',
          )}
        />

        {fase === 'verificando' && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <div
                className={cn(
                  'h-[72%] w-[52%] rounded-[50%] border-4 transition-colors duration-300',
                  rostoVisivel
                    ? 'border-emerald-400 shadow-[0_0_0_9999px_rgba(5,7,15,0.45)]'
                    : 'border-white/50 shadow-[0_0_0_9999px_rgba(5,7,15,0.6)]',
                )}
              />
            </div>
            <div className="absolute inset-x-0 top-0 flex justify-between p-3 text-xs font-semibold text-white">
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 backdrop-blur',
                  rostoVisivel ? 'bg-emerald-500/70' : 'bg-black/50',
                )}
              >
                {rostoVisivel
                  ? `Rosto detectado · ${Math.round(confianca * 100)}%`
                  : 'Posicione o rosto no oval'}
              </span>
              <span className="rounded-full bg-black/50 px-2.5 py-1 backdrop-blur">
                {Math.min(indice + 1, acoes.length)}/{acoes.length}
              </span>
            </div>
            {acaoAtual && (
              <div
                className="absolute inset-x-4 bottom-4 flex items-center justify-center gap-3 rounded-2xl bg-black/60 px-4 py-3 text-white backdrop-blur"
                aria-live="assertive"
              >
                {(() => {
                  const { texto, icone: Icone } = ACOES[acaoAtual];

                  return (
                    <>
                      <Icone className="size-6 animate-pulso-suave" aria-hidden="true" />
                      <span className="text-base font-semibold">{texto}</span>
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}

        {fase !== 'verificando' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
            {fase === 'inicio' && (
              <>
                <span className="bg-gradiente-marca flex size-20 items-center justify-center rounded-3xl shadow-brilho">
                  <ScanFace className="size-10" aria-hidden="true" />
                </span>
                <p className="max-w-xs text-sm text-white/75">
                  Vamos pedir duas ações aleatórias para provar que é você, ao vivo, na frente da
                  câmera.
                </p>
              </>
            )}
            {(fase === 'preparando' || fase === 'enviando') && (
              <>
                <Loader2 className="size-10 animate-spin text-brand-300" aria-hidden="true" />
                <p className="text-sm text-white/75">
                  {fase === 'preparando'
                    ? 'Carregando o reconhecimento facial…'
                    : 'Registrando a verificação…'}
                </p>
              </>
            )}
            {fase === 'aprovada' && (
              <>
                <CheckCircle2 className="size-16 text-emerald-400" aria-hidden="true" />
                <p className="text-lg font-semibold">Identidade confirmada</p>
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
            <ShieldCheck className="size-3.5" aria-hidden="true" /> A análise acontece no seu
            dispositivo. Nenhuma imagem é enviada ou guardada.
          </p>
        </div>
      )}
    </div>
  );
}
