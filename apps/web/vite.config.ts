import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/** A API do LetsSign. ⚠️ 3020, não 3000 — as portas fogem do padrão de propósito. */
const API_LOCAL = 'http://localhost:3020';

/** 5190, para não colidir com outros projetos na mesma máquina. */
const PORTA_DEV = 5190;

/** Onde o SPA publica as fontes-padrão do PDF. Espelhado em `VisualizadorDePdf`. */
const ROTA_FONTES_PDF = '/pdfjs/standard_fonts/';

/**
 * Publica as fontes-padrão do pdf.js (Times, Helvetica, Courier…) na mesma origem.
 *
 * ⚠️ Sem elas, o pdf.js desenha o texto com `fillText` e fonte do sistema num canvas
 * opaco — o Chromium aplica antisserrilhado subpixel e o texto sai com franjas
 * vermelhas. Com elas, os glifos viram caminhos vetoriais, fiéis ao PDF.
 */
function fontesDoPdf(): Plugin {
  const pasta = join(
    dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')),
    'standard_fonts',
  );
  const arquivos = readdirSync(pasta).filter((nome) => /\.(pfb|ttf)$/.test(nome));

  return {
    name: 'letssign:fontes-do-pdf',
    configureServer(servidor) {
      servidor.middlewares.use(ROTA_FONTES_PDF, (req, res, next) => {
        const nome = decodeURIComponent((req.url ?? '').replace(/^\//, '').split('?')[0] ?? '');

        if (!arquivos.includes(nome)) return next();

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.end(readFileSync(join(pasta, nome)));
      });
    },
    generateBundle() {
      for (const nome of arquivos) {
        this.emitFile({
          type: 'asset',
          fileName: `${ROTA_FONTES_PDF.slice(1)}${nome}`,
          source: readFileSync(join(pasta, nome)),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), fontesDoPdf()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: PORTA_DEV,
    strictPort: true,
    // `/api` é servido pela API em outra porta. O proxy evita CORS em
    // desenvolvimento e deixa a URL da API relativa, igual à de produção.
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY ?? API_LOCAL, changeOrigin: false },
    },
  },
  preview: { port: PORTA_DEV },
  build: {
    target: 'es2022',
    // As bibliotecas de visão computacional são carregadas sob demanda, só na
    // etapa de verificação — ficam em chunks próprios, fora do bundle inicial.
    chunkSizeWarningLimit: 1600,
  },
  optimizeDeps: {
    // ⚠️ Pré-otimizadas de antemão: sem isto, o Vite as descobriria no primeiro
    // `import()` dinâmico e RECARREGARIA a página — no meio da verificação facial.
    include: ['@vladmandic/face-api', 'react-pdf', 'chart.js', 'react-chartjs-2'],
    // O MediaPipe carrega WebAssembly próprio e não pode ser reempacotado.
    exclude: ['@mediapipe/tasks-vision'],
  },
});
