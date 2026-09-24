import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, FileWarning, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { Esqueleto } from '@/components/ui/Estados';
import { cn } from '@/lib/cn';

// O worker do pdf.js roda fora da thread principal: renderizar um PDF grande não trava a tela.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/**
 * Glifos desenhados como caminhos vetoriais, com as fontes-padrão servidas pelo
 * próprio SPA (plugin em `vite.config.ts`).
 *
 * ⚠️ O react-pdf cria o canvas opaco (`alpha: false`); nele, o `fillText` do Chromium
 * usa antisserrilhado subpixel e o texto sai com franjas vermelhas. `disableFontFace`
 * troca o `fillText` por caminhos — tons de cinza, fiel ao PDF.
 * ⚠️ Fora do componente: o react-pdf recarrega o documento se `options` mudar de identidade.
 */
const OPCOES_DO_PDF = {
  standardFontDataUrl: '/pdfjs/standard_fonts/',
  disableFontFace: true,
} as const;

interface Props {
  /** URL da API (mesma origem via proxy — o cookie de sessão vai junto) ou `File` local. */
  readonly arquivo: string | File;
  readonly className?: string;
  /** Altura máxima da área de leitura. */
  readonly alturaMaxima?: string;
}

/**
 * Visualizador de PDF com rolagem contínua, navegação e zoom.
 *
 * ⚠️ Camadas de texto e anotação desligadas: o objetivo é **ler** o documento
 * antes de assinar, e elas dobram o custo de render sem ganho para isso.
 */
export function VisualizadorDePdf({ arquivo, className, alturaMaxima = '75dvh' }: Props) {
  const area = useRef<HTMLDivElement>(null);
  const [largura, definirLargura] = useState(600);
  const [paginas, definirPaginas] = useState(0);
  const [atual, definirAtual] = useState(1);
  const [zoom, definirZoom] = useState(1);
  const [falhou, definirFalhou] = useState(false);

  useEffect(() => {
    const elemento = area.current;

    if (!elemento) return undefined;

    const observador = new ResizeObserver(([entrada]) =>
      definirLargura(Math.max(260, (entrada?.contentRect.width ?? 600) - 32)),
    );

    observador.observe(elemento);

    return () => observador.disconnect();
  }, []);

  const irPara = (pagina: number) => {
    const alvo = area.current?.querySelector<HTMLElement>(`[data-pagina="${pagina}"]`);

    alvo?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    definirAtual(pagina);
  };

  const aoRolar = () => {
    const elemento = area.current;

    if (!elemento) return;

    const topo = elemento.scrollTop + 80;
    const blocos = [...elemento.querySelectorAll<HTMLElement>('[data-pagina]')];
    const visivel = blocos.filter((b) => b.offsetTop <= topo).pop();

    if (visivel) definirAtual(Number(visivel.dataset.pagina));
  };

  if (falhou) {
    return (
      <div
        className={cn(
          'border-linha bg-superficie-2 flex flex-col items-center justify-center gap-3 rounded-2xl border p-10 text-center',
          className,
        )}
      >
        <FileWarning className="text-tinta-3 size-8" aria-hidden="true" />
        <p className="text-tinta-2 text-sm">Não foi possível exibir o PDF aqui.</p>
        {typeof arquivo === 'string' && (
          <a
            href={arquivo}
            target="_blank"
            rel="noreferrer"
            className="text-destaque text-sm font-semibold hover:underline"
          >
            Abrir em outra aba
          </a>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border-linha bg-superficie-3/60 overflow-hidden rounded-2xl border',
        className,
      )}
    >
      <div className="border-linha bg-superficie flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-1">
          <BotaoDaBarra
            rotulo="Página anterior"
            desabilitado={atual <= 1}
            aoClicar={() => irPara(atual - 1)}
          >
            <ChevronLeft />
          </BotaoDaBarra>
          <span
            className="text-tinta-2 min-w-20 text-center text-xs font-medium numeros"
            aria-live="polite"
          >
            {paginas === 0 ? '—' : `${atual} de ${paginas}`}
          </span>
          <BotaoDaBarra
            rotulo="Próxima página"
            desabilitado={atual >= paginas}
            aoClicar={() => irPara(atual + 1)}
          >
            <ChevronRight />
          </BotaoDaBarra>
        </div>
        <div className="flex items-center gap-1">
          <BotaoDaBarra
            rotulo="Diminuir zoom"
            desabilitado={zoom <= 0.6}
            aoClicar={() => definirZoom((z) => Math.max(0.6, z - 0.2))}
          >
            <ZoomOut />
          </BotaoDaBarra>
          <span className="text-tinta-3 w-11 text-center text-xs numeros">
            {Math.round(zoom * 100)}%
          </span>
          <BotaoDaBarra
            rotulo="Aumentar zoom"
            desabilitado={zoom >= 2}
            aoClicar={() => definirZoom((z) => Math.min(2, z + 0.2))}
          >
            <ZoomIn />
          </BotaoDaBarra>
          <BotaoDaBarra
            rotulo="Ajustar à largura"
            desabilitado={zoom === 1}
            aoClicar={() => definirZoom(1)}
          >
            <Maximize2 />
          </BotaoDaBarra>
        </div>
      </div>

      <div
        ref={area}
        onScroll={aoRolar}
        className="rolagem-fina overflow-auto p-4"
        style={{ maxHeight: alturaMaxima }}
      >
        <Document
          file={arquivo}
          options={OPCOES_DO_PDF}
          onLoadSuccess={({ numPages }) => definirPaginas(numPages)}
          onLoadError={() => definirFalhou(true)}
          loading={<Esqueleto className="mx-auto aspect-[1/1.414] w-full max-w-2xl rounded-lg" />}
          className="flex flex-col items-center gap-4"
        >
          {Array.from({ length: paginas }, (_, i) => (
            <div
              key={i}
              data-pagina={i + 1}
              className="shadow-elevada overflow-hidden rounded-md bg-white"
            >
              <Page
                pageNumber={i + 1}
                width={largura * zoom}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={<Esqueleto className="aspect-[1/1.414]" />}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}

function BotaoDaBarra({
  rotulo,
  desabilitado,
  aoClicar,
  children,
}: {
  readonly rotulo: string;
  readonly desabilitado: boolean;
  readonly aoClicar: () => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      disabled={desabilitado}
      onClick={aoClicar}
      className="text-tinta-2 hover:bg-superficie-2 hover:text-tinta rounded-lg p-1.5 transition disabled:opacity-35 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}
