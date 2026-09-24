import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { CheckCircle2, Loader2, Mail, RotateCw } from 'lucide-react';
import { Botao } from '@/components/ui/Botao';
import { Alerta } from '@/components/ui/Estados';
import type { ApiDeAssinatura } from '@/lib/api/assinatura';
import { mensagemDoErro } from '@/lib/erros';
import { cn } from '@/lib/cn';

const DIGITOS = 6;
const ESPERA_PARA_REENVIAR = 30;

export function VerificacaoCodigo({
  api,
  emailMascarado,
  aoAprovar,
}: {
  readonly api: ApiDeAssinatura;
  readonly emailMascarado: string;
  readonly aoAprovar: () => void;
}) {
  const [desafio, definirDesafio] = useState<string | null>(null);
  const [digitos, definirDigitos] = useState<string[]>(Array.from({ length: DIGITOS }, () => ''));
  const [erro, definirErro] = useState<string | null>(null);
  const [enviando, definirEnviando] = useState(false);
  const [conferindo, definirConferindo] = useState(false);
  const [aprovada, definirAprovada] = useState(false);
  const [espera, definirEspera] = useState(0);
  const caixas = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (espera <= 0) return undefined;

    const relogio = window.setTimeout(() => definirEspera((s) => s - 1), 1000);

    return () => window.clearTimeout(relogio);
  }, [espera]);

  const pedirCodigo = async () => {
    definirErro(null);
    definirEnviando(true);

    try {
      const resposta = await api.iniciarCodigo();

      definirDesafio(resposta.desafio);
      definirDigitos(Array.from({ length: DIGITOS }, () => ''));
      definirEspera(ESPERA_PARA_REENVIAR);
      window.setTimeout(() => caixas.current[0]?.focus(), 50);
    } catch (causa) {
      definirErro(mensagemDoErro(causa));
    } finally {
      definirEnviando(false);
    }
  };

  const conferir = async (codigo: string) => {
    if (!desafio) return;

    definirConferindo(true);
    definirErro(null);

    try {
      await api.concluirCodigo(desafio, codigo);
      definirAprovada(true);
      window.setTimeout(aoAprovar, 700);
    } catch (causa) {
      definirErro(mensagemDoErro(causa));
      definirDigitos(Array.from({ length: DIGITOS }, () => ''));
      caixas.current[0]?.focus();
    } finally {
      definirConferindo(false);
    }
  };

  const preencher = (indice: number, valor: string) => {
    const limpos = valor.replace(/\D/g, '');

    if (limpos.length === 0) {
      definirDigitos((atuais) => atuais.map((d, i) => (i === indice ? '' : d)));
      return;
    }

    const novos = [...digitos];

    for (const [deslocamento, caractere] of [...limpos].entries()) {
      if (indice + deslocamento < DIGITOS) novos[indice + deslocamento] = caractere;
    }

    definirDigitos(novos);
    caixas.current[Math.min(DIGITOS - 1, indice + limpos.length)]?.focus();

    if (novos.every((d) => d !== '')) void conferir(novos.join(''));
  };

  const aoTeclar = (indice: number, evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Backspace' && digitos[indice] === '' && indice > 0)
      caixas.current[indice - 1]?.focus();
    if (evento.key === 'ArrowLeft' && indice > 0) caixas.current[indice - 1]?.focus();
    if (evento.key === 'ArrowRight' && indice < DIGITOS - 1) caixas.current[indice + 1]?.focus();
  };

  const aoColar = (evento: ClipboardEvent<HTMLInputElement>) => {
    evento.preventDefault();
    preencher(0, evento.clipboardData.getData('text'));
  };

  if (desafio === null) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="bg-gradiente-marca flex size-20 items-center justify-center rounded-3xl text-white shadow-brilho">
          <Mail className="size-10" aria-hidden="true" />
        </span>
        <p className="text-tinta-2 max-w-sm text-sm">
          Vamos enviar um código de 6 dígitos para{' '}
          <strong className="text-tinta">{emailMascarado}</strong>. Ele prova que o e-mail é seu.
        </p>
        {erro && <Alerta tom="perigo">{erro}</Alerta>}
        <Botao tamanho="lg" carregando={enviando} onClick={() => void pedirCodigo()}>
          Enviar código
        </Botao>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <p className="text-tinta-2 text-sm">
        Digite o código enviado para <strong className="text-tinta">{emailMascarado}</strong>
      </p>

      <fieldset className="flex gap-2 sm:gap-3" disabled={conferindo || aprovada}>
        <legend className="sr-only">Código de verificação de 6 dígitos</legend>
        {digitos.map((digito, i) => (
          <input
            key={i}
            ref={(el) => {
              caixas.current[i] = el;
            }}
            value={digito}
            onChange={(e) => preencher(i, e.target.value)}
            onKeyDown={(e) => aoTeclar(i, e)}
            onPaste={aoColar}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={DIGITOS}
            aria-label={`Dígito ${i + 1}`}
            className={cn(
              'font-display border-linha bg-superficie text-tinta focus:border-destaque focus:ring-destaque/15 size-12 rounded-xl border-2 text-center text-2xl font-bold transition focus:ring-4 focus:outline-none sm:size-14',
              aprovada && 'border-sucesso bg-sucesso-suave text-sucesso-tinta',
            )}
          />
        ))}
      </fieldset>

      <div className="min-h-6" aria-live="polite">
        {conferindo && (
          <p className="text-tinta-2 flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Conferindo…
          </p>
        )}
        {aprovada && (
          <p className="text-sucesso-tinta flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-5" /> E-mail confirmado
          </p>
        )}
      </div>

      {erro && (
        <Alerta tom="perigo" className="w-full text-left">
          {erro}
        </Alerta>
      )}

      {!aprovada && (
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<RotateCw className="size-3.5" />}
          disabled={espera > 0 || enviando}
          onClick={() => void pedirCodigo()}
        >
          {espera > 0 ? `Reenviar em ${espera}s` : 'Reenviar código'}
        </Botao>
      )}

      <p className="text-tinta-3 text-xs">
        Não chegou? Confira a caixa de spam. Em desenvolvimento, os e-mails ficam no Mailpit
        (localhost:8035).
      </p>
    </div>
  );
}
