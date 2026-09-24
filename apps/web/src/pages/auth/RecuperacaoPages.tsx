import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, KeyRound, Lock, Mail, MailCheck, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import { useSessao } from '@/app/providers/sessao-contexto';
import { Botao, estilosDeBotao } from '@/components/ui/Botao';
import { Campo, Entrada } from '@/components/ui/Campo';
import { Alerta } from '@/components/ui/Estados';
import { apiDeSessao } from '@/lib/api/sessao';
import { mensagemDoErro } from '@/lib/erros';
import { ForcaDaSenha, senhaAtendeRequisitos } from './ForcaDaSenha';
import { destinoSeguro } from '@/lib/navegacao';
import { MolduraDeAutenticacao } from './MolduraDeAutenticacao';

export function EsqueciSenhaPage() {
  const [enviadoPara, definirEnviadoPara] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const formulario = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: z.string().trim().email('Informe um e-mail válido.') })),
    defaultValues: { email: '' },
  });

  const enviar = formulario.handleSubmit(async ({ email }) => {
    definirErro(null);

    try {
      await apiDeSessao.esqueciSenha(email);
      definirEnviadoPara(email);
    } catch (causa) {
      definirErro(mensagemDoErro(causa));
    }
  });

  if (enviadoPara !== null) {
    return (
      <MolduraDeAutenticacao titulo="Confira seu e-mail">
        <div className="text-center">
          <span className="bg-sucesso-suave text-sucesso-tinta mx-auto flex size-16 items-center justify-center rounded-2xl">
            <MailCheck className="size-8" aria-hidden="true" />
          </span>
          {/* ⚠️ Mesma resposta exista ou não a conta: a tela não confirma quais e-mails têm cadastro. */}
          <p className="text-tinta-2 mt-6">
            Se houver uma conta para <strong className="text-tinta">{enviadoPara}</strong>, enviamos um link para
            criar uma nova senha. Ele vale por 1 hora.
          </p>
          <Link to="/entrar" className={`${estilosDeBotao('secundario', 'lg')} mt-8 w-full`}>
            Voltar para entrar
          </Link>
        </div>
      </MolduraDeAutenticacao>
    );
  }

  return (
    <MolduraDeAutenticacao
      titulo="Esqueceu a senha?"
      subtitulo="Informe o e-mail da conta. Enviaremos um link para criar uma nova."
      rodape={
        <Link to="/entrar" className="text-destaque inline-flex items-center gap-1.5 font-semibold hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" /> Voltar para entrar
        </Link>
      }
    >
      <form onSubmit={(e) => void enviar(e)} noValidate className="space-y-5">
        {erro && <Alerta tom="perigo">{erro}</Alerta>}
        <Campo rotulo="E-mail" erro={formulario.formState.errors.email?.message}>
          <Entrada type="email" autoComplete="email" placeholder="voce@empresa.com.br" icone={<Mail />} {...formulario.register('email')} />
        </Campo>
        <Botao type="submit" tamanho="lg" className="w-full" carregando={formulario.formState.isSubmitting}>
          Enviar link
        </Botao>
      </form>
    </MolduraDeAutenticacao>
  );
}

const esquemaDaNovaSenha = z
  .object({
    senha: z.string().refine(senhaAtendeRequisitos, 'A senha ainda não atende a todos os requisitos.'),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, { path: ['confirmacao'], message: 'As senhas não conferem.' });

/** Serve à redefinição **e** ao aceite de convite de equipe — os dois definem senha por token. */
export function RedefinirSenhaPage() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token') ?? '';
  const ehConvite = parametros.get('convite') === '1';
  const [concluido, definirConcluido] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const formulario = useForm<z.infer<typeof esquemaDaNovaSenha>>({
    resolver: zodResolver(esquemaDaNovaSenha),
    defaultValues: { senha: '', confirmacao: '' },
  });

  const enviar = formulario.handleSubmit(async ({ senha }) => {
    definirErro(null);

    try {
      await apiDeSessao.redefinirSenha({ token, senha });
      definirConcluido(true);
    } catch (causa) {
      definirErro(mensagemDoErro(causa));
    }
  });

  if (token.length < 20) {
    return (
      <MolduraDeAutenticacao titulo="Link incompleto">
        <Alerta tom="alerta">
          O endereço parece ter sido cortado. Abra o link direto do e-mail, ou peça um novo.
        </Alerta>
        <Link to="/esqueci-senha" className={`${estilosDeBotao('primario', 'lg')} mt-6 w-full`}>
          Pedir novo link
        </Link>
      </MolduraDeAutenticacao>
    );
  }

  if (concluido) {
    return (
      <MolduraDeAutenticacao titulo={ehConvite ? 'Tudo pronto!' : 'Senha alterada'}>
        <div className="text-center">
          <span className="bg-sucesso-suave text-sucesso-tinta mx-auto flex size-16 items-center justify-center rounded-2xl">
            <ShieldCheck className="size-8" aria-hidden="true" />
          </span>
          <p className="text-tinta-2 mt-6">
            {ehConvite
              ? 'Sua senha foi definida. Entre para começar a usar o LetsSign com a sua equipe.'
              : 'Sua nova senha já vale. Por segurança, todas as sessões antigas foram encerradas.'}
          </p>
          <Link to="/entrar" className={`${estilosDeBotao('primario', 'lg')} mt-8 w-full`}>
            Entrar
          </Link>
        </div>
      </MolduraDeAutenticacao>
    );
  }

  const senha = formulario.watch('senha');

  return (
    <MolduraDeAutenticacao
      titulo={ehConvite ? 'Aceite o convite' : 'Crie uma nova senha'}
      subtitulo={ehConvite ? 'Defina a senha da sua conta para entrar na equipe.' : 'Escolha uma senha que você não use em outro lugar.'}
    >
      <form onSubmit={(e) => void enviar(e)} noValidate className="space-y-5">
        {erro && <Alerta tom="perigo">{erro}</Alerta>}
        <Campo rotulo="Nova senha" erro={formulario.formState.errors.senha?.message}>
          <Entrada type="password" autoComplete="new-password" icone={<Lock />} {...formulario.register('senha')} />
        </Campo>
        <ForcaDaSenha senha={senha} />
        <Campo rotulo="Confirme a nova senha" erro={formulario.formState.errors.confirmacao?.message}>
          <Entrada type="password" autoComplete="new-password" icone={<Lock />} {...formulario.register('confirmacao')} />
        </Campo>
        <Botao type="submit" tamanho="lg" className="w-full" carregando={formulario.formState.isSubmitting}>
          {ehConvite ? 'Definir senha e continuar' : 'Salvar nova senha'}
        </Botao>
      </form>
    </MolduraDeAutenticacao>
  );
}

export function MfaPage() {
  const { recarregar, sair } = useSessao();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const [usarRecuperacao, definirUsarRecuperacao] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const formulario = useForm<{ codigo: string }>({ defaultValues: { codigo: '' } });

  const enviar = formulario.handleSubmit(async ({ codigo }) => {
    definirErro(null);

    try {
      await apiDeSessao.desafioMfa(codigo.trim());
      await recarregar();
      navegar(destinoSeguro(parametros.get('voltar')), { replace: true });
    } catch (causa) {
      definirErro(mensagemDoErro(causa));
      formulario.setValue('codigo', '');
    }
  });

  return (
    <MolduraDeAutenticacao
      titulo="Verificação em duas etapas"
      subtitulo={
        usarRecuperacao
          ? 'Digite um dos seus códigos de recuperação (formato XXXX-XXXX). Cada um vale uma única vez.'
          : 'Abra o app autenticador e digite o código de 6 dígitos do LetsSign.'
      }
      rodape={
        <button type="button" onClick={() => void sair().then(() => navegar('/entrar'))} className="text-destaque font-semibold hover:underline">
          Entrar com outra conta
        </button>
      }
    >
      <form onSubmit={(e) => void enviar(e)} noValidate className="space-y-5">
        {erro && <Alerta tom="perigo">{erro}</Alerta>}
        <Campo rotulo={usarRecuperacao ? 'Código de recuperação' : 'Código do app'}>
          <Entrada
            inputMode={usarRecuperacao ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            maxLength={usarRecuperacao ? 9 : 6}
            placeholder={usarRecuperacao ? 'ABCD-EF23' : '000000'}
            icone={<KeyRound />}
            className="font-mono text-lg tracking-[0.4em]"
            {...formulario.register('codigo', { required: true })}
          />
        </Campo>
        <Botao type="submit" tamanho="lg" className="w-full" carregando={formulario.formState.isSubmitting}>
          Confirmar
        </Botao>
        <button
          type="button"
          onClick={() => {
            definirUsarRecuperacao(!usarRecuperacao);
            formulario.reset();
          }}
          className="text-tinta-2 hover:text-tinta w-full text-center text-sm font-medium"
        >
          {usarRecuperacao ? 'Usar o código do app' : 'Perdi o celular — usar código de recuperação'}
        </button>
      </form>
    </MolduraDeAutenticacao>
  );
}
