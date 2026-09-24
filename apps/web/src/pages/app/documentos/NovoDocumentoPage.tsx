import { useCallback, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Fingerprint, Lock, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { CabecalhoDaPagina } from '@/components/layout/CabecalhoDaPagina';
import { Botao } from '@/components/ui/Botao';
import { Cartao } from '@/components/ui/Cartao';
import { AreaDeTexto, Campo, Entrada } from '@/components/ui/Campo';
import { Alerta } from '@/components/ui/Estados';
import { VisualizadorDePdf } from '@/components/pdf/VisualizadorDePdf';
import { apiDeDocumentos } from '@/lib/api/documentos';
import { mensagemDoErro } from '@/lib/erros';
import { cn } from '@/lib/cn';
import { formatarBytes } from '@/lib/formatadores';
import { EtapasDoEnvio } from './EtapasDoEnvio';

const LIMITE_EM_BYTES = 20 * 1024 * 1024;

/** SHA-256 no navegador — mostrado antes do envio: é a "impressão digital" que o servidor vai registrar. */
async function sha256DoArquivo(arquivo: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await arquivo.arrayBuffer());

  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function tituloDoArquivo(nome: string): string {
  const base = nome
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function NovoDocumentoPage() {
  const navegar = useNavigate();
  const clienteDeQuery = useQueryClient();
  const [arquivo, definirArquivo] = useState<File | null>(null);
  const [hash, definirHash] = useState<string | null>(null);
  const [titulo, definirTitulo] = useState('');
  const [mensagem, definirMensagem] = useState('');
  const [arrastando, definirArrastando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  const escolher = useCallback(async (escolhido: File | undefined) => {
    definirErro(null);

    if (!escolhido) return;

    if (escolhido.type !== 'application/pdf' && !escolhido.name.toLowerCase().endsWith('.pdf')) {
      definirErro('Envie um arquivo PDF.');
      return;
    }

    if (escolhido.size > LIMITE_EM_BYTES) {
      definirErro('O PDF pode ter até 20 MB.');
      return;
    }

    definirArquivo(escolhido);
    definirTitulo((atual) => atual || tituloDoArquivo(escolhido.name));
    definirHash(null);
    definirHash(await sha256DoArquivo(escolhido));
  }, []);

  const envio = useMutation({
    mutationFn: () =>
      apiDeDocumentos.criar({
        arquivo: arquivo as File,
        titulo: titulo.trim(),
        mensagem: mensagem.trim() || undefined,
      }),
    onSuccess: async (documento) => {
      await clienteDeQuery.invalidateQueries({ queryKey: ['documentos'] });
      toast.success('Arquivo recebido e registrado com hash SHA-256.');
      void navegar(`/app/documentos/${documento.uuid}/preparar`, { replace: true });
    },
    onError: (causa) => definirErro(mensagemDoErro(causa)),
  });

  const aoSoltar = (evento: DragEvent) => {
    evento.preventDefault();
    definirArrastando(false);
    void escolher(evento.dataTransfer.files[0]);
  };

  return (
    <>
      <CabecalhoDaPagina
        titulo="Novo documento"
        descricao="Envie o PDF que será assinado. Ele recebe uma impressão digital criptográfica no momento do upload."
        trilha={[{ rotulo: 'Documentos', para: '/app/documentos' }, { rotulo: 'Novo' }]}
      />
      <EtapasDoEnvio atual={1} />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Cartao>
          {erro && (
            <Alerta tom="perigo" className="mb-5">
              {erro}
            </Alerta>
          )}

          {arquivo === null ? (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                definirArrastando(true);
              }}
              onDragLeave={() => definirArrastando(false)}
              onDrop={aoSoltar}
              className={cn(
                'group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition',
                arrastando
                  ? 'border-destaque bg-destaque-suave'
                  : 'border-linha-forte hover:border-destaque hover:bg-superficie-2',
              )}
            >
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => void escolher(e.target.files?.[0])}
              />
              <span className="bg-gradiente-marca-texto shadow-brilho flex size-16 items-center justify-center rounded-2xl text-white transition group-hover:scale-105">
                <UploadCloud className="size-8" aria-hidden="true" />
              </span>
              <p className="text-tinta mt-6 text-lg font-semibold">Arraste o PDF para cá</p>
              <p className="text-tinta-2 mt-1 text-sm">
                ou <span className="text-destaque font-semibold">escolha no computador</span> · até
                20 MB
              </p>
            </label>
          ) : (
            <div className="space-y-5">
              <div className="border-linha bg-superficie-2/60 flex items-center gap-4 rounded-2xl border p-4">
                <span className="bg-destaque-suave text-destaque flex size-12 items-center justify-center rounded-xl">
                  <FileText className="size-6" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-tinta truncate font-semibold">{arquivo.name}</p>
                  <p className="text-tinta-3 text-xs">{formatarBytes(arquivo.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    definirArquivo(null);
                    definirHash(null);
                  }}
                  aria-label="Remover arquivo"
                  className="text-tinta-3 hover:bg-superficie-3 hover:text-tinta rounded-lg p-2"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="border-destaque/20 bg-destaque-suave/60 rounded-2xl border p-4">
                <p className="text-destaque-tinta flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                  <Fingerprint className="size-4" aria-hidden="true" /> Impressão digital SHA-256
                </p>
                <p className="text-destaque-tinta mt-2 font-mono text-xs break-all">
                  {hash ?? 'calculando…'}
                </p>
                <p className="text-tinta-2 mt-2 text-xs">
                  Calculada no seu navegador. Se um único byte do arquivo mudar depois, este código
                  muda — e a validação denuncia.
                </p>
              </div>

              <Campo
                rotulo="Título do documento"
                dica="É o que quem assina vê no e-mail e na tela de assinatura."
              >
                <Entrada
                  value={titulo}
                  maxLength={160}
                  onChange={(e) => definirTitulo(e.target.value)}
                />
              </Campo>
              <Campo rotulo="Mensagem para quem assina" opcional>
                <AreaDeTexto
                  value={mensagem}
                  maxLength={1000}
                  placeholder="Ex.: Olá! Segue o contrato revisado conforme combinamos."
                  onChange={(e) => definirMensagem(e.target.value)}
                />
              </Campo>

              <div className="flex justify-end">
                <Botao
                  tamanho="lg"
                  carregando={envio.isPending}
                  disabled={titulo.trim().length < 3}
                  onClick={() => envio.mutate()}
                >
                  Continuar para signatários
                </Botao>
              </div>
            </div>
          )}

          <p className="text-tinta-3 mt-6 flex items-center gap-2 text-xs">
            <Lock className="size-3.5" aria-hidden="true" />O arquivo fica em armazenamento privado.
            Não existe link público para ele.
          </p>
        </Cartao>

        <div>
          {arquivo ? (
            <VisualizadorDePdf arquivo={arquivo} alturaMaxima="70dvh" />
          ) : (
            <PrevisaoVazia />
          )}
        </div>
      </div>
    </>
  );
}

function PrevisaoVazia() {
  return (
    <div className="border-linha text-tinta-3 flex h-full min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center text-sm">
      <FileText className="mb-3 size-10 opacity-40" aria-hidden="true" />A pré-visualização do PDF
      aparece aqui.
    </div>
  );
}
