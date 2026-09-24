import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Lock, Mail, User } from 'lucide-react';
import { z } from 'zod';
import { useSessao } from '@/app/providers/sessao-contexto';
import { Botao } from '@/components/ui/Botao';
import { Campo, Entrada, Seletor } from '@/components/ui/Campo';
import { Alerta } from '@/components/ui/Estados';
import { PLANOS } from '@/constants/planos';
import { apiDeSessao } from '@/lib/api/sessao';
import { mensagemDoErro } from '@/lib/erros';
import { ForcaDaSenha, senhaAtendeRequisitos } from './ForcaDaSenha';
import { MolduraDeAutenticacao } from './MolduraDeAutenticacao';

const esquema = z
  .object({
    nomeOrganizacao: z
      .string()
      .trim()
      .min(2, 'Informe o nome da empresa ou do escritório.')
      .max(120),
    nome: z.string().trim().min(2, 'Informe seu nome.').max(120),
    email: z.string().trim().email('Informe um e-mail válido.'),
    senha: z
      .string()
      .refine(senhaAtendeRequisitos, 'A senha ainda não atende a todos os requisitos.'),
    confirmacao: z.string(),
    plano: z.enum(['basico', 'profissional', 'empresarial']),
    termos: z.literal(true, { error: 'É preciso aceitar os termos para continuar.' }),
  })
  .refine((dados) => dados.senha === dados.confirmacao, {
    path: ['confirmacao'],
    message: 'As senhas não conferem.',
  });

type Dados = z.input<typeof esquema>;

export function CadastroPage() {
  const { estado, recarregar } = useSessao();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const [erro, definirErro] = useState<string | null>(null);
  const planoDaUrl = PLANOS.find((p) => p.id === parametros.get('plano'))?.id ?? 'basico';

  const formulario = useForm<Dados>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nomeOrganizacao: '',
      nome: '',
      email: '',
      senha: '',
      confirmacao: '',
      plano: planoDaUrl,
      termos: false as unknown as true,
    },
  });
  const senha = useWatch({ control: formulario.control, name: 'senha' });

  if (estado.situacao === 'autenticado') return <Navigate to="/app" replace />;

  const enviar = formulario.handleSubmit(async (dados) => {
    definirErro(null);

    try {
      await apiDeSessao.cadastrar({
        nomeOrganizacao: dados.nomeOrganizacao,
        nome: dados.nome,
        email: dados.email,
        senha: dados.senha,
        plano: dados.plano,
      });
      await recarregar();
      void navegar('/app?bem-vindo=1', { replace: true });
    } catch (causa) {
      definirErro(mensagemDoErro(causa));
    }
  });

  const { errors, isSubmitting } = formulario.formState;

  return (
    <MolduraDeAutenticacao
      titulo="Crie sua conta"
      subtitulo="Em menos de um minuto você envia o primeiro documento."
      rodape={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" className="text-destaque font-semibold hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void enviar(e)} noValidate className="space-y-5">
        {erro && <Alerta tom="perigo">{erro}</Alerta>}

        <Campo rotulo="Empresa ou escritório" erro={errors.nomeOrganizacao?.message}>
          <Entrada
            autoComplete="organization"
            placeholder="Aurora Tecnologia"
            icone={<Building2 />}
            {...formulario.register('nomeOrganizacao')}
          />
        </Campo>

        <div className="grid gap-5 sm:grid-cols-2">
          <Campo rotulo="Seu nome" erro={errors.nome?.message}>
            <Entrada
              autoComplete="name"
              placeholder="Ana Ribeiro"
              icone={<User />}
              {...formulario.register('nome')}
            />
          </Campo>
          <Campo rotulo="Plano" erro={errors.plano?.message}>
            <Seletor {...formulario.register('plano')}>
              {PLANOS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} — {p.preco}
                  {p.periodo ?? ''}
                </option>
              ))}
            </Seletor>
          </Campo>
        </div>

        <Campo rotulo="E-mail de trabalho" erro={errors.email?.message}>
          <Entrada
            type="email"
            autoComplete="email"
            placeholder="ana@empresa.com.br"
            icone={<Mail />}
            {...formulario.register('email')}
          />
        </Campo>

        <Campo rotulo="Senha" erro={errors.senha?.message}>
          <Entrada
            type="password"
            autoComplete="new-password"
            placeholder="Crie uma senha forte"
            icone={<Lock />}
            {...formulario.register('senha')}
          />
        </Campo>
        <ForcaDaSenha senha={senha} />

        <Campo rotulo="Confirme a senha" erro={errors.confirmacao?.message}>
          <Entrada
            type="password"
            autoComplete="new-password"
            placeholder="Repita a senha"
            icone={<Lock />}
            {...formulario.register('confirmacao')}
          />
        </Campo>

        <div>
          <label className="text-tinta-2 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="accent-brand-600 mt-0.5 size-4 rounded"
              {...formulario.register('termos')}
            />
            <span>
              Li e aceito os termos de uso e a política de privacidade. Entendo que as assinaturas
              coletadas têm validade jurídica nos termos da Lei 14.063/2020.
            </span>
          </label>
          {errors.termos && (
            <p className="text-perigo-tinta mt-1.5 text-xs font-medium">{errors.termos.message}</p>
          )}
        </div>

        <Botao type="submit" tamanho="lg" className="w-full" carregando={isSubmitting}>
          Criar conta
        </Botao>
      </form>
    </MolduraDeAutenticacao>
  );
}
