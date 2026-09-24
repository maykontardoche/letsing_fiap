import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { z } from 'zod';
import { useSessao } from '@/app/providers/sessao-contexto';
import { Botao } from '@/components/ui/Botao';
import { Campo, Entrada } from '@/components/ui/Campo';
import { Alerta } from '@/components/ui/Estados';
import { apiDeSessao } from '@/lib/api/sessao';
import { mensagemDoErro } from '@/lib/erros';
import { destinoSeguro } from '@/lib/navegacao';
import { MolduraDeAutenticacao } from './MolduraDeAutenticacao';

const esquema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail.').email('Informe um e-mail válido.'),
  senha: z.string().min(1, 'Informe sua senha.'),
});

type Dados = z.infer<typeof esquema>;

export function EntrarPage() {
  const { estado, recarregar } = useSessao();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const [verSenha, definirVerSenha] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const destino = destinoSeguro(parametros.get('voltar'));

  const formulario = useForm<Dados>({ resolver: zodResolver(esquema), defaultValues: { email: '', senha: '' } });

  if (estado.situacao === 'autenticado') return <Navigate to={destino} replace />;
  if (estado.situacao === 'precisa-mfa') return <Navigate to={`/mfa?voltar=${encodeURIComponent(destino)}`} replace />;

  const enviar = formulario.handleSubmit(async (dados) => {
    definirErro(null);

    try {
      const { precisaMfa } = await apiDeSessao.entrar(dados);

      if (precisaMfa) {
        navegar(`/mfa?voltar=${encodeURIComponent(destino)}`, { replace: true });
        return;
      }

      await recarregar();
      navegar(destino, { replace: true });
    } catch (causa) {
      // ⚠️ A mensagem do servidor é ambígua de propósito ("e-mail ou senha") e é repassada sem reescrita.
      definirErro(mensagemDoErro(causa));
    }
  });

  const { errors, isSubmitting } = formulario.formState;

  return (
    <MolduraDeAutenticacao
      titulo="Bem-vindo de volta"
      subtitulo="Entre para acompanhar seus documentos e assinaturas."
      rodape={
        <>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="text-destaque font-semibold hover:underline">
            Crie grátis
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void enviar(e)} noValidate className="space-y-5">
        {erro && <Alerta tom="perigo">{erro}</Alerta>}

        <Campo rotulo="E-mail" erro={errors.email?.message}>
          <Entrada type="email" autoComplete="email" placeholder="voce@empresa.com.br" icone={<Mail />} {...formulario.register('email')} />
        </Campo>

        <Campo rotulo="Senha" erro={errors.senha?.message}>
          <Entrada
            type={verSenha ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Sua senha"
            icone={<Lock />}
            acessorio={
              <button
                type="button"
                onClick={() => definirVerSenha(!verSenha)}
                aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
                className="text-tinta-3 hover:text-tinta rounded-lg p-2"
              >
                {verSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
            {...formulario.register('senha')}
          />
        </Campo>

        <div className="flex justify-end">
          <Link to="/esqueci-senha" className="text-destaque text-sm font-medium hover:underline">
            Esqueci minha senha
          </Link>
        </div>

        <Botao type="submit" tamanho="lg" className="w-full" carregando={isSubmitting}>
          Entrar
        </Botao>

        <div className="border-linha bg-superficie-2/70 rounded-2xl border border-dashed p-4 text-sm">
          <p className="text-tinta font-semibold">Conta de demonstração</p>
          <p className="text-tinta-2 mt-1">
            <code className="font-mono text-xs">ana@aurora.dev</code> · senha{' '}
            <code className="font-mono text-xs">LetsSign@2026</code>
          </p>
          <button
            type="button"
            className="text-destaque mt-2 text-xs font-semibold hover:underline"
            onClick={() => {
              formulario.setValue('email', 'ana@aurora.dev');
              formulario.setValue('senha', 'LetsSign@2026');
            }}
          >
            Preencher automaticamente
          </button>
        </div>
      </form>
    </MolduraDeAutenticacao>
  );
}
