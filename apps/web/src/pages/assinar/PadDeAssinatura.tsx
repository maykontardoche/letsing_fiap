import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from 'react';
import { Eraser, PenLine, Type } from 'lucide-react';
import { Abas } from '@/components/ui/Diversos';
import { cn } from '@/lib/cn';

export interface RubricaExportada {
  readonly tipo: 'desenhada' | 'digitada';
  readonly imagem: string;
}

export interface ControleDoPad {
  /** PNG recortado nas bordas do traço, ou `null` se não há nada desenhado/digitado. */
  exportar: () => Promise<RubricaExportada | null>;
}

const LARGURA = 640;
const ALTURA = 220;
const COR = '#1e1b5a';

/**
 * Captura a rubrica — desenhada (mouse, dedo, caneta) ou digitada em fonte manuscrita.
 *
 * O traço é suavizado com curvas quadráticas pelos pontos médios e tem espessura
 * que varia com a velocidade: devagar engrossa, rápido afina — como caneta de verdade.
 * A exportação recorta o PNG nas bordas do desenho, com fundo transparente, para
 * ele assentar bem sobre o manifesto do PDF.
 */
export const PadDeAssinatura = forwardRef<ControleDoPad, { readonly nome: string; readonly aoMudar?: (preenchido: boolean) => void }>(function PadDeAssinatura(
  { nome, aoMudar },
  ref,
) {
  const [modo, definirModo] = useState<'desenhada' | 'digitada'>('desenhada');
  const [texto, definirTexto] = useState(nome);
  const [temTraco, definirTemTraco] = useState(false);
  const tela = useRef<HTMLCanvasElement>(null);
  const pontos = useRef<{ x: number; y: number; t: number }[]>([]);
  const espessura = useRef(3);

  useEffect(() => {
    aoMudar?.(modo === 'desenhada' ? temTraco : texto.trim().length >= 2);
  }, [modo, temTraco, texto, aoMudar]);

  useEffect(() => {
    const canvas = tela.current;

    if (!canvas) return;

    const escala = window.devicePixelRatio || 1;

    canvas.width = LARGURA * escala;
    canvas.height = ALTURA * escala;
    canvas.getContext('2d')?.scale(escala, escala);
    // O canvas nasce vazio a cada troca de modo — o estado precisa acompanhar.
    definirTemTraco(false);
  }, [modo]);

  const coordenada = (evento: PointerEvent<HTMLCanvasElement>) => {
    const caixa = (evento.target as HTMLCanvasElement).getBoundingClientRect();

    return {
      x: ((evento.clientX - caixa.left) / caixa.width) * LARGURA,
      y: ((evento.clientY - caixa.top) / caixa.height) * ALTURA,
      t: performance.now(),
    };
  };

  const aoPressionar = (evento: PointerEvent<HTMLCanvasElement>) => {
    evento.currentTarget.setPointerCapture(evento.pointerId);
    pontos.current = [coordenada(evento)];
  };

  const aoMover = (evento: PointerEvent<HTMLCanvasElement>) => {
    if (pontos.current.length === 0) return;

    const contexto = tela.current?.getContext('2d');
    const novo = coordenada(evento);
    const anterior = pontos.current[pontos.current.length - 1] as { x: number; y: number; t: number };

    if (!contexto) return;

    const velocidade = Math.hypot(novo.x - anterior.x, novo.y - anterior.y) / Math.max(1, novo.t - anterior.t);
    const alvo = Math.max(1.4, Math.min(4.2, 4.4 - velocidade * 1.6)) * (evento.pressure > 0 && evento.pointerType === 'pen' ? 0.6 + evento.pressure : 1);

    espessura.current = espessura.current * 0.7 + alvo * 0.3;
    pontos.current.push(novo);

    const [a, b] = pontos.current.slice(-3) as [typeof novo, typeof novo, typeof novo | undefined];

    contexto.strokeStyle = COR;
    contexto.lineCap = 'round';
    contexto.lineJoin = 'round';
    contexto.lineWidth = espessura.current;
    contexto.beginPath();

    if (b === undefined || pontos.current.length < 3) {
      contexto.moveTo(anterior.x, anterior.y);
      contexto.lineTo(novo.x, novo.y);
    } else {
      contexto.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
      contexto.quadraticCurveTo(b.x, b.y, (b.x + novo.x) / 2, (b.y + novo.y) / 2);
    }

    contexto.stroke();
    if (!temTraco) definirTemTraco(true);
  };

  const aoSoltar = () => {
    pontos.current = [];
  };

  const limpar = () => {
    const canvas = tela.current;

    canvas?.getContext('2d')?.clearRect(0, 0, LARGURA, ALTURA);
    definirTemTraco(false);
  };

  useImperativeHandle(ref, () => ({
    exportar: async () => {
      if (modo === 'desenhada') {
        return temTraco && tela.current ? { tipo: 'desenhada', imagem: recortar(tela.current) } : null;
      }

      if (texto.trim().length < 2) return null;

      await document.fonts.load('72px Caveat');

      const canvas = document.createElement('canvas');
      const contexto = canvas.getContext('2d') as CanvasRenderingContext2D;

      canvas.width = LARGURA * 2;
      canvas.height = ALTURA * 2;
      contexto.scale(2, 2);
      contexto.fillStyle = COR;
      contexto.font = `700 ${texto.length > 26 ? 44 : 64}px Caveat, 'Segoe Script', cursive`;
      contexto.textBaseline = 'middle';
      contexto.textAlign = 'center';
      contexto.fillText(texto.trim(), LARGURA / 2, ALTURA / 2, LARGURA - 20);

      return { tipo: 'digitada', imagem: recortar(canvas) };
    },
  }));

  return (
    <div className="space-y-3">
      <Abas
        rotulo="Como assinar"
        ativa={modo}
        aoMudar={definirModo}
        abas={[
          { id: 'desenhada', rotulo: 'Desenhar', icone: <PenLine /> },
          { id: 'digitada', rotulo: 'Digitar', icone: <Type /> },
        ]}
      />

      {modo === 'desenhada' ? (
        <div className="border-linha-forte bg-superficie relative overflow-hidden rounded-2xl border-2 border-dashed">
          <canvas
            ref={tela}
            onPointerDown={aoPressionar}
            onPointerMove={aoMover}
            onPointerUp={aoSoltar}
            onPointerCancel={aoSoltar}
            aria-label="Área para desenhar a assinatura"
            role="img"
            className="aspect-[640/220] w-full cursor-crosshair touch-none bg-white"
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-10 bottom-10 border-b border-slate-300" />
          {!temTraco && (
            <p aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
              Desenhe sua assinatura aqui
            </p>
          )}
          {temTraco && (
            <button type="button" onClick={limpar} className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-600 shadow hover:text-slate-900">
              <Eraser className="size-3.5" aria-hidden="true" /> Limpar
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="sr-only" htmlFor="nome-da-assinatura">Nome para a assinatura</label>
          <input
            id="nome-da-assinatura"
            value={texto}
            maxLength={60}
            onChange={(e) => definirTexto(e.target.value)}
            className="border-linha bg-superficie text-tinta focus:border-destaque focus:ring-destaque/15 h-11 w-full rounded-xl border px-3.5 text-sm focus:ring-4 focus:outline-none"
          />
          <div className="flex aspect-[640/220] items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6">
            <span className={cn('font-assinatura truncate font-bold text-[#1e1b5a]', texto.length > 26 ? 'text-4xl' : 'text-6xl')}>{texto || 'Seu nome'}</span>
          </div>
        </div>
      )}
    </div>
  );
});

/** Recorta o canvas nas bordas do que foi desenhado (pixels não transparentes), com margem. */
function recortar(canvas: HTMLCanvasElement): string {
  const contexto = canvas.getContext('2d') as CanvasRenderingContext2D;
  const { width, height } = canvas;
  const dados = contexto.getImageData(0, 0, width, height).data;
  let [minX, minY, maxX, maxY] = [width, height, 0, 0];

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if ((dados[(y * width + x) * 4 + 3] ?? 0) > 10) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const margem = 12;
  const recorte = document.createElement('canvas');
  const larguraFinal = Math.max(1, maxX - minX + margem * 2);
  const alturaFinal = Math.max(1, maxY - minY + margem * 2);
  // Limita a 900px de largura: a rubrica não precisa de mais que isso no PDF.
  const escala = Math.min(1, 900 / larguraFinal);

  recorte.width = Math.round(larguraFinal * escala);
  recorte.height = Math.round(alturaFinal * escala);
  recorte
    .getContext('2d')
    ?.drawImage(canvas, minX - margem, minY - margem, larguraFinal, alturaFinal, 0, 0, recorte.width, recorte.height);

  return recorte.toDataURL('image/png');
}
