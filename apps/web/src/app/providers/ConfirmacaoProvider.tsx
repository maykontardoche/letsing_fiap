import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Botao } from '@/components/ui/Botao';
import { Modal } from '@/components/ui/Modal';

export interface PedidoDeConfirmacao {
  readonly titulo: string;
  readonly mensagem: string;
  readonly confirmar?: string;
  readonly cancelar?: string;
  /** Ação destrutiva: botão vermelho. */
  readonly perigosa?: boolean;
}

type Confirmar = (pedido: PedidoDeConfirmacao) => Promise<boolean>;

const ContextoDeConfirmacao = createContext<Confirmar | null>(null);

/**
 * Modal de confirmação **global**, em 100% das ações destrutivas — cancelar
 * documento, remover signatário, revogar sessão, desativar membro.
 *
 * Substitui o `confirm()` nativo, que não segue o design system, não é
 * estilizável e é bloqueado em alguns navegadores embutidos.
 *
 * `const ok = await confirmar({...})` — a promessa resolve com a escolha.
 */
export function ConfirmacaoProvider({ children }: { readonly children: ReactNode }) {
  const [pedido, definirPedido] = useState<PedidoDeConfirmacao | null>(null);
  const resolver = useRef<((valor: boolean) => void) | null>(null);

  const confirmar = useCallback<Confirmar>(
    (novo) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        definirPedido(novo);
      }),
    [],
  );

  const responder = useCallback((valor: boolean) => {
    resolver.current?.(valor);
    resolver.current = null;
    definirPedido(null);
  }, []);

  const fechar = useCallback(() => responder(false), [responder]);

  return (
    <ContextoDeConfirmacao value={confirmar}>
      {children}
      <Modal
        aberto={pedido !== null}
        aoFechar={fechar}
        titulo={pedido?.titulo ?? ''}
        descricao={pedido?.mensagem}
        largura="estreita"
        rodape={
          <>
            <Botao variante="secundario" onClick={fechar}>
              {pedido?.cancelar ?? 'Voltar'}
            </Botao>
            <Botao
              variante={pedido?.perigosa ? 'perigo' : 'primario'}
              onClick={() => responder(true)}
            >
              {pedido?.confirmar ?? 'Confirmar'}
            </Botao>
          </>
        }
      />
    </ContextoDeConfirmacao>
  );
}

export function useConfirmacao(): Confirmar {
  const confirmar = useContext(ContextoDeConfirmacao);

  if (confirmar === null) throw new Error('useConfirmacao() fora do ConfirmacaoProvider.');

  return confirmar;
}
