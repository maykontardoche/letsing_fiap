import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Mail, MailPlus, ShieldCheck, UserCheck, UserPlus, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirmacao } from '@/app/providers/ConfirmacaoProvider';
import { usePerfil, usePode } from '@/app/providers/sessao-contexto';
import { CabecalhoDaPagina } from '@/components/layout/CabecalhoDaPagina';
import { Botao } from '@/components/ui/Botao';
import { Cartao } from '@/components/ui/Cartao';
import { Campo, Entrada, Seletor } from '@/components/ui/Campo';
import { Avatar } from '@/components/ui/Diversos';
import { Alerta, Carregando, EstadoDeErro, EstadoVazio, Esqueleto } from '@/components/ui/Estados';
import { Etiqueta } from '@/components/ui/Etiqueta';
import { Modal } from '@/components/ui/Modal';
import { apiDaEquipe, type Membro } from '@/lib/api/gestao';
import { ROTULO_DO_PAPEL, type Papel } from '@/lib/api/sessao';
import { mensagemDoErro } from '@/lib/erros';
import { formatarRelativo } from '@/lib/formatadores';

const DESCRICAO_DO_PAPEL: Record<Papel, string> = {
  proprietario: 'Tudo, inclusive plano e dados da organização.',
  administrador: 'Tudo sobre documentos, equipe e auditoria.',
  membro: 'Cria e acompanha os próprios documentos.',
  auditor: 'Só leitura: documentos, equipe e trilha de auditoria.',
};

export function EquipePage() {
  const perfil = usePerfil();
  const podeGerenciar = usePode('equipe.gerenciar');
  const clienteDeQuery = useQueryClient();
  const confirmar = useConfirmacao();
  const [convidando, definirConvidando] = useState(false);
  const consulta = useQuery({ queryKey: ['equipe'], queryFn: apiDaEquipe.listar });

  const atualizar = useMutation({
    mutationFn: ({ uuid, dados }: { uuid: string; dados: { papel?: Papel; ativo?: boolean } }) => apiDaEquipe.atualizar(uuid, dados),
    onSuccess: async () => {
      await clienteDeQuery.invalidateQueries({ queryKey: ['equipe'] });
      toast.success('Equipe atualizada.');
    },
    onError: (e) => toast.error(mensagemDoErro(e)),
  });

  const reenviar = useMutation({
    mutationFn: (uuid: string) => apiDaEquipe.reenviarConvite(uuid),
    onSuccess: () => toast.success('Convite reenviado.'),
    onError: (e) => toast.error(mensagemDoErro(e)),
  });

  const alternarAtivo = async (membro: Membro) => {
    const ok = await confirmar(
      membro.ativo
        ? { titulo: `Desativar ${membro.nome}?`, mensagem: 'A pessoa perde o acesso imediatamente e todas as sessões abertas são encerradas. Os documentos dela continuam na organização.', confirmar: 'Desativar', perigosa: true }
        : { titulo: `Reativar ${membro.nome}?`, mensagem: 'A pessoa volta a poder entrar com a senha que já tinha.', confirmar: 'Reativar' },
    );

    if (ok) atualizar.mutate({ uuid: membro.uuid, dados: { ativo: !membro.ativo } });
  };

  const ativos = consulta.data?.filter((m) => m.ativo).length ?? 0;

  return (
    <>
      <CabecalhoDaPagina
        titulo="Equipe"
        descricao="Quem da organização usa o LetsSign, e o que cada pessoa pode fazer."
        acoes={podeGerenciar && <Botao icone={<UserPlus className="size-4" />} onClick={() => definirConvidando(true)}>Convidar pessoa</Botao>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {(Object.keys(ROTULO_DO_PAPEL) as Papel[]).map((papel) => (
          <Cartao key={papel} className="p-4 sm:p-4">
            <p className="text-tinta-3 text-xs font-semibold tracking-wide uppercase">{ROTULO_DO_PAPEL[papel]}</p>
            <p className="font-display text-tinta mt-1 text-2xl font-extrabold numeros">{consulta.data?.filter((m) => m.papel === papel && m.ativo).length ?? '—'}</p>
            <p className="text-tinta-3 mt-1 text-xs">{DESCRICAO_DO_PAPEL[papel]}</p>
          </Cartao>
        ))}
      </div>

      <Cartao semPreenchimento>
        {consulta.isPending && (
          <Carregando>
            <div className="divide-linha divide-y">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center gap-4 p-5">
                  <Esqueleto className="size-9 rounded-full" />
                  <Esqueleto className="h-4 flex-1" />
                </div>
              ))}
            </div>
          </Carregando>
        )}
        {consulta.isError && <EstadoDeErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} />}
        {consulta.data?.length === 0 && <EstadoVazio icone={<Users />} titulo="Só você por aqui" descricao="Convide colegas para enviar e acompanhar documentos juntos." />}
        {consulta.data && consulta.data.length > 0 && (
          <>
            <p className="border-linha text-tinta-3 border-b px-5 py-3 text-sm">{ativos} pessoa(s) ativa(s)</p>
            <ul className="divide-linha divide-y">
              {consulta.data.map((membro) => {
                const souEu = membro.email === perfil.email;

                return (
                  <li key={membro.uuid} className={membro.ativo ? 'flex flex-col gap-4 p-5 sm:flex-row sm:items-center' : 'flex flex-col gap-4 p-5 opacity-60 sm:flex-row sm:items-center'}>
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                      <Avatar nome={membro.nome} />
                      <div className="min-w-0">
                        <p className="text-tinta flex flex-wrap items-center gap-2 font-semibold">
                          {membro.nome}
                          {souEu && <Etiqueta tom="info">Você</Etiqueta>}
                          {membro.convitePendente && <Etiqueta tom="alerta" icone={<Clock3 />}>Convite pendente</Etiqueta>}
                          {!membro.ativo && <Etiqueta tom="neutro" icone={<UserX />}>Desativado</Etiqueta>}
                          {membro.mfaAtivo && <Etiqueta tom="sucesso" icone={<ShieldCheck />}>MFA</Etiqueta>}
                        </p>
                        <p className="text-tinta-3 flex items-center gap-1.5 truncate text-sm">
                          <Mail className="size-3.5 shrink-0" aria-hidden="true" /> {membro.email}
                        </p>
                        <p className="text-tinta-3 text-xs">
                          {membro.ultimoAcessoEm ? `Último acesso ${formatarRelativo(membro.ultimoAcessoEm)}` : 'Nunca entrou'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {podeGerenciar && !souEu ? (
                        <>
                          <label className="sr-only" htmlFor={`papel-${membro.uuid}`}>Papel de {membro.nome}</label>
                          <Seletor
                            id={`papel-${membro.uuid}`}
                            className="h-9 w-44"
                            value={membro.papel}
                            disabled={!membro.ativo || atualizar.isPending || (membro.papel === 'proprietario' && perfil.papel !== 'proprietario')}
                            onChange={(e) => atualizar.mutate({ uuid: membro.uuid, dados: { papel: e.target.value as Papel } })}
                          >
                            {(Object.keys(ROTULO_DO_PAPEL) as Papel[])
                              .filter((p) => p !== 'proprietario' || perfil.papel === 'proprietario' || membro.papel === 'proprietario')
                              .map((p) => (
                                <option key={p} value={p}>{ROTULO_DO_PAPEL[p]}</option>
                              ))}
                          </Seletor>
                          {membro.convitePendente && membro.ativo && (
                            <Botao variante="fantasma" tamanho="sm" icone={<MailPlus className="size-4" />} onClick={() => reenviar.mutate(membro.uuid)} aria-label={`Reenviar convite para ${membro.nome}`}>
                              <span className="hidden lg:inline">Reenviar</span>
                            </Botao>
                          )}
                          <Botao
                            variante="fantasma"
                            tamanho="sm"
                            icone={membro.ativo ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                            onClick={() => void alternarAtivo(membro)}
                            aria-label={membro.ativo ? `Desativar ${membro.nome}` : `Reativar ${membro.nome}`}
                          >
                            <span className="hidden lg:inline">{membro.ativo ? 'Desativar' : 'Reativar'}</span>
                          </Botao>
                        </>
                      ) : (
                        <Etiqueta tom="neutro">{ROTULO_DO_PAPEL[membro.papel]}</Etiqueta>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Cartao>

      <ModalDeConvite aberto={convidando} aoFechar={() => definirConvidando(false)} podeProprietario={perfil.papel === 'proprietario'} />
    </>
  );
}

function ModalDeConvite({ aberto, aoFechar, podeProprietario }: { readonly aberto: boolean; readonly aoFechar: () => void; readonly podeProprietario: boolean }) {
  const clienteDeQuery = useQueryClient();
  const [nome, definirNome] = useState('');
  const [email, definirEmail] = useState('');
  const [papel, definirPapel] = useState<Papel>('membro');
  const [erro, definirErro] = useState<string | null>(null);

  const convidar = useMutation({
    mutationFn: () => apiDaEquipe.convidar({ nome: nome.trim(), email: email.trim().toLowerCase(), papel }),
    onSuccess: async (membro) => {
      await clienteDeQuery.invalidateQueries({ queryKey: ['equipe'] });
      toast.success(`Convite enviado para ${membro.email}.`);
      definirNome('');
      definirEmail('');
      aoFechar();
    },
    onError: (e) => definirErro(mensagemDoErro(e)),
  });

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Convidar pessoa"
      descricao="Ela recebe um e-mail para definir a senha. O link vale por 72 horas."
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao disabled={nome.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email.trim())} carregando={convidar.isPending} onClick={() => convidar.mutate()}>
            Enviar convite
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        {erro && <Alerta tom="perigo">{erro}</Alerta>}
        <Campo rotulo="Nome">
          <Entrada value={nome} onChange={(e) => definirNome(e.target.value)} placeholder="Eduarda Pires" />
        </Campo>
        <Campo rotulo="E-mail">
          <Entrada type="email" value={email} onChange={(e) => definirEmail(e.target.value)} placeholder="eduarda@empresa.com.br" />
        </Campo>
        <Campo rotulo="Papel" dica={DESCRICAO_DO_PAPEL[papel]}>
          <Seletor value={papel} onChange={(e) => definirPapel(e.target.value as Papel)}>
            {(Object.keys(ROTULO_DO_PAPEL) as Papel[])
              .filter((p) => p !== 'proprietario' || podeProprietario)
              .map((p) => (
                <option key={p} value={p}>{ROTULO_DO_PAPEL[p]}</option>
              ))}
          </Seletor>
        </Campo>
      </div>
    </Modal>
  );
}
