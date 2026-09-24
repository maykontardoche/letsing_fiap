import { deflateSync } from 'node:zlib';

/**
 * Gera uma **rubrica manuscrita** em PNG, sem depender de canvas nativo — para o
 * seed ter manifestos com assinatura desenhada de verdade.
 *
 * O traço é uma soma de senoides com fase derivada do nome (a mesma pessoa tem
 * sempre a mesma rubrica), rasterizado com pincel circular e anti-aliasing
 * simples, e codificado num PNG RGBA mínimo (IHDR + IDAT + IEND).
 */
const LARGURA = 360;
const ALTURA = 120;

function semente(texto: string): () => number {
  let estado = [...texto].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 2166136261);

  return () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 0xffffffff;
  };
}

export function rubricaPng(nome: string): Buffer {
  const aleatorio = semente(nome);
  const alfa = new Float32Array(LARGURA * ALTURA);
  const harmonicos = Array.from({ length: 4 }, (_, i) => ({ amp: 10 + aleatorio() * 16, freq: 0.03 + i * 0.022 + aleatorio() * 0.02, fase: aleatorio() * Math.PI * 2 }));
  const inclinacao = -0.08 + aleatorio() * 0.06;

  const pincel = (cx: number, cy: number, raio: number) => {
    for (let y = Math.floor(cy - raio - 1); y <= cy + raio + 1; y += 1) {
      for (let x = Math.floor(cx - raio - 1); x <= cx + raio + 1; x += 1) {
        if (x < 0 || y < 0 || x >= LARGURA || y >= ALTURA) continue;

        const d = Math.hypot(x - cx, y - cy);
        const cobertura = Math.max(0, Math.min(1, raio + 0.5 - d));
        const i = y * LARGURA + x;

        alfa[i] = Math.max(alfa[i] ?? 0, cobertura);
      }
    }
  };

  for (let t = 18; t < LARGURA - 18; t += 0.35) {
    const onda = harmonicos.reduce((soma, h) => soma + h.amp * Math.sin(t * h.freq + h.fase), 0);
    const laco = 14 * Math.sin(t * 0.11) * Math.exp(-((t - LARGURA * 0.3) ** 2) / 4000);
    const y = ALTURA / 2 + onda * 0.9 + laco + (t - LARGURA / 2) * inclinacao;
    const pressao = 1.1 + 0.9 * Math.abs(Math.sin(t * 0.045));

    pincel(t, y, pressao);
  }

  // Sublinhado curto, gesto comum em rubrica.
  for (let t = 40; t < LARGURA * 0.62; t += 0.5) pincel(t, ALTURA - 20 + Math.sin(t * 0.05) * 2, 0.9);

  const linhas = Buffer.alloc((LARGURA * 4 + 1) * ALTURA);

  for (let y = 0; y < ALTURA; y += 1) {
    const base = y * (LARGURA * 4 + 1);

    linhas[base] = 0; // filtro "None"

    for (let x = 0; x < LARGURA; x += 1) {
      const o = base + 1 + x * 4;

      linhas[o] = 30;
      linhas[o + 1] = 27;
      linhas[o + 2] = 90;
      linhas[o + 3] = Math.round((alfa[y * LARGURA + x] ?? 0) * 255);
    }
  }

  const ihdr = Buffer.alloc(13);

  ihdr.writeUInt32BE(LARGURA, 0);
  ihdr.writeUInt32BE(ALTURA, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(linhas)),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

export function rubricaDataUrl(nome: string): string {
  return `data:image/png;base64,${rubricaPng(nome).toString('base64')}`;
}

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;

  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;

  return c >>> 0;
});

function crc32(dados: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of dados) crc = (TABELA_CRC[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);

  return (crc ^ 0xffffffff) >>> 0;
}

function bloco(tipo: string, dados: Buffer): Buffer {
  const tamanho = Buffer.alloc(4);
  const cabecalho = Buffer.from(tipo, 'ascii');
  const crc = Buffer.alloc(4);

  tamanho.writeUInt32BE(dados.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([cabecalho, dados])), 0);

  return Buffer.concat([tamanho, cabecalho, dados, crc]);
}
