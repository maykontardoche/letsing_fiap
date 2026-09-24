import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** A API do LetsSign. ⚠️ 3020, não 3000 — as portas fogem do padrão de propósito. */
const API_LOCAL = 'http://localhost:3020';

/** 5190, para não colidir com outros projetos na mesma máquina. */
const PORTA_DEV = 5190;

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    exclude: ['@mediapipe/tasks-vision'],
  },
});
