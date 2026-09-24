import { useState } from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ConfirmacaoProvider, useConfirmacao } from '@/app/providers/ConfirmacaoProvider';
import { Campo, Entrada } from '@/components/ui/Campo';
import { EtiquetaDoDocumento } from '@/components/ui/EtiquetaDeStatus';
import { useFiltrosNaUrl } from '@/hooks/useFiltrosNaUrl';
import { ForcaDaSenha } from '@/pages/auth/ForcaDaSenha';

describe('<Campo>', () => {
  it('liga rótulo, controle e mensagem de erro por id e aria', () => {
    render(
      <Campo rotulo="E-mail" erro="Informe um e-mail válido.">
        <Entrada />
      </Campo>,
    );

    const campo = screen.getByLabelText('E-mail');

    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription('Informe um e-mail válido.');
  });
});

describe('<EtiquetaDoDocumento>', () => {
  it('status nunca só por cor: tem rótulo legível', () => {
    render(<EtiquetaDoDocumento status="em_andamento" />);

    expect(screen.getByText('Em andamento')).toBeInTheDocument();
  });
});

describe('<ForcaDaSenha>', () => {
  it('anuncia cada requisito atendido e pendente', () => {
    render(<ForcaDaSenha senha="abc" />);

    expect(screen.getByText(/Uma letra minúscula/)).toHaveTextContent('atendido');
    expect(screen.getByText(/Pelo menos 10 caracteres/)).toHaveTextContent('pendente');
  });

  it('não aparece com a senha vazia', () => {
    const { container } = render(<ForcaDaSenha senha="" />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe('modal de confirmação global', () => {
  function Gatilho() {
    const confirmar = useConfirmacao();
    const [resposta, definirResposta] = useState('nenhuma');

    return (
      <>
        <button
          type="button"
          onClick={() =>
            void confirmar({
              titulo: 'Excluir?',
              mensagem: 'Não dá para desfazer.',
              perigosa: true,
              confirmar: 'Excluir',
            }).then((ok) => definirResposta(String(ok)))
          }
        >
          abrir
        </button>
        <p>resposta: {resposta}</p>
      </>
    );
  }

  it('resolve true ao confirmar e false ao voltar ou apertar Esc', async () => {
    const usuario = userEvent.setup();

    render(
      <ConfirmacaoProvider>
        <Gatilho />
      </ConfirmacaoProvider>,
    );

    await usuario.click(screen.getByText('abrir'));
    expect(screen.getByRole('dialog', { name: 'Excluir?' })).toHaveAccessibleDescription(
      'Não dá para desfazer.',
    );
    await usuario.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(screen.getByText('resposta: true')).toBeInTheDocument();

    await usuario.click(screen.getByText('abrir'));
    await usuario.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByText('resposta: false')).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('filtros na URL', () => {
  const opcoes = {
    statusValidos: ['rascunho', 'concluido'],
    ordenacoesValidas: ['criadoEm', 'titulo'],
  };

  function montar(url: string) {
    return renderHook(() => ({ ...useFiltrosNaUrl(opcoes), local: useLocation() }), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>,
    });
  }

  it('⚠️ URL é entrada do usuário: valor inválido cai no padrão, nunca derruba a tela', () => {
    const { result } = montar('/x?status=hackeado&ordenar=senha&dir=lado&pagina=-3');

    expect(result.current.filtros).toEqual({
      q: '',
      status: null,
      ordenar: 'criadoEm',
      dir: 'desc',
      pagina: 1,
    });
  });

  it('lê os valores válidos', () => {
    const { result } = montar('/x?q=nda&status=concluido&ordenar=titulo&dir=asc&pagina=3');

    expect(result.current.filtros).toEqual({
      q: 'nda',
      status: 'concluido',
      ordenar: 'titulo',
      dir: 'asc',
      pagina: 3,
    });
  });

  it('filtrar volta para a página 1; mudar de página mantém o filtro', () => {
    const { result } = montar('/x?status=concluido&pagina=4');

    act(() => result.current.mudar({ q: 'contrato' }));
    expect(result.current.local.search).toBe('?q=contrato&status=concluido');

    act(() => result.current.mudar({ pagina: 2 }));
    expect(result.current.local.search).toBe('?q=contrato&status=concluido&pagina=2');
  });
});
