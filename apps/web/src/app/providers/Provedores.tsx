import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { useTema } from '@/hooks/useTema';
import { ErroDaApi } from '@/lib/erros';
import { ConfirmacaoProvider } from './ConfirmacaoProvider';
import { SessaoProvider } from './SessaoProvider';

/**
 * Os provedores globais, numa ordem só:
 *
 * Query → Sessão (lê `/me` pela Query) → Confirmação (modal global) → Toaster.
 */
export function Provedores({ children }: { readonly children: ReactNode }) {
  const [clienteDeQuery] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // ⚠️ 4xx é resposta, não falha de rede: repetir só atrasa a tela de erro.
            retry: (tentativas, erro) =>
              !(erro instanceof ErroDaApi && erro.status < 500) && tentativas < 2,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={clienteDeQuery}>
      <SessaoProvider>
        <ConfirmacaoProvider>
          {children}
          <Notificador />
        </ConfirmacaoProvider>
      </SessaoProvider>
    </QueryClientProvider>
  );
}

function Notificador() {
  const { tema } = useTema();

  return (
    <Toaster
      theme={tema === 'escuro' ? 'dark' : 'light'}
      position="top-right"
      richColors
      closeButton
      toastOptions={{ className: 'font-sans' }}
    />
  );
}
