import type { Response } from 'express';

/**
 * Resposta de PDF privado.
 *
 * ⚠️ `no-store`: é documento de alguém, e cache de proxy intermediário o serviria
 * à próxima pessoa. `nosniff` impede o navegador de "adivinhar" outro tipo.
 */
export function enviarPdf(resposta: Response, conteudo: Buffer, nome: string, baixar: boolean): void {
  resposta.set({
    'Content-Type': 'application/pdf',
    'Content-Length': String(conteudo.length),
    'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename="${nome.replace(/[^\w.-]/g, '_')}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  resposta.end(conteudo);
}
