import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileSignature,
  Gauge,
  Inbox,
  PartyPopper,
  PenLine,
  Plus,
  Timer,
} from 'lucide-react';
import { usePerfil, usePode } from '@/app/providers/sessao-contexto';
import { GraficoDeRosca, GraficoMensal, PALETA } from '@/components/graficos/Graficos';
import { CabecalhoDaPagina } from '@/components/layout/CabecalhoDaPagina';
import { estilosDeBotao } from '@/components/ui/Botao';
import { Cartao, CabecalhoDoCartao } from '@/components/ui/Cartao';
import { Carregando, EstadoDeErro, EstadoVazio, Esqueleto } from '@/components/ui/Estados';
import { STATUS_DO_DOCUMENTO, STATUS_EM_ORDEM, VERIFICACAO } from '@/constants/status';
import { apiDoPainel } from '@/lib/api/gestao';
import type { TipoDeVerificacao } from '@/lib/api/documentos';
import { cn } from '@/lib/cn';
import { formatarData, formatarDuracao, formatarMes, formatarPorcentagem, formatarRelativo, saudacao } from '@/lib/formatadores';

const COR_DO_STATUS = {
  rascunho: '#94a3b8',
  em_andamento: PALETA[3],
  concluido: PALETA[2],
  recusado: PALETA[4],
  expirado: '#f97316',
  cancelado: '#64748b',
} as const;

export function PainelPage() {
  const perfil = usePerfil();
  const podeCriar = usePode('documentos.criar');
  const [parametros] = useSearchParams();
  const consulta = useQuery({ queryKey: ['painel'], queryFn: apiDoPainel.resumo });
  const primeiroNome = perfil.nome.split(' ')[0];

  return (
    <>
      <CabecalhoDaPagina
        titulo={`${saudacao()}, ${primeiroNome}`}
        descricao={`Um resumo das assinaturas de ${perfil.organizacao.nome}.`}
        acoes={
          podeCriar && (
            <Link to="/app/documentos/novo" className={estilosDeBotao('primario')}>
              <Plus className="size-4" aria-hidden="true" /> Novo documento
            </Link>
          )
        }
      />

      {parametros.get('bem-vindo') === '1' && (
        <div className="bg-gradiente-marca-texto relative mb-8 overflow-hidden rounded-[var(--radius-cartao)] p-6 text-white shadow-brilho sm:p-8">
          <div aria-hidden="true" className="grade-de-fundo absolute inset-0 opacity-50" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <PartyPopper className="size-8 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-lg font-bold">Sua conta está pronta!</p>
                <p className="mt-1 text-white/80">Envie o primeiro PDF: em poucos minutos ele volta assinado, selado e com QR Code de validação.</p>
              </div>
            </div>
            <Link to="/app/documentos/novo" className={estilosDeBotao('claro')}>
              Enviar primeiro documento
            </Link>
          </div>
        </div>
      )}

      {consulta.isPending && <EsqueletoDoPainel />}
      {consulta.isError && <Cartao><EstadoDeErro erro={consulta.error} aoTentarDeNovo={() => void consulta.refetch()} /></Cartao>}
      {consulta.data && <ConteudoDoPainel dados={consulta.data} />}
    </>
  );
}

function ConteudoDoPainel({ dados }: { readonly dados: NonNullable<Awaited<ReturnType<typeof apiDoPainel.resumo>>> }) {
  const { indicadores } = dados;
  const semNada = indicadores.total === 0;

  if (semNada) {
    return (
      <Cartao>
        <EstadoVazio
          icone={<FileSignature />}
          titulo="Nenhum documento ainda"
          descricao="Assim que você enviar o primeiro PDF para assinatura, os números e gráficos aparecem aqui."
          acao={
            <Link to="/app/documentos/novo" className={estilosDeBotao('primario')}>
              <Plus className="size-4" aria-hidden="true" /> Enviar documento
            </Link>
          }
        />
      </Cartao>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador indice={0} icone={<Clock3 />} cor="from-amber-500 to-orange-500" rotulo="Em andamento" valor={String(indicadores.emAndamento)} detalhe="aguardando assinaturas" />
        <Indicador indice={1} icone={<CheckCircle2 />} cor="from-emerald-500 to-teal-500" rotulo="Concluídos" valor={String(indicadores.concluidos)} detalhe="assinados por todos" />
        <Indicador indice={2} icone={<Gauge />} cor="from-brand-500 to-violeta-600" rotulo="Taxa de conclusão" valor={formatarPorcentagem(indicadores.taxaDeConclusao)} detalhe="dos documentos enviados" />
        <Indicador indice={3} icone={<Timer />} cor="from-ciano-500 to-brand-500" rotulo="Tempo médio" valor={formatarDuracao(indicadores.tempoMedioDeConclusaoHoras)} detalhe="do envio à última assinatura" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Cartao className="xl:col-span-2">
          <CabecalhoDoCartao titulo="Assinaturas nos últimos 12 meses" descricao="Documentos enviados e concluídos por mês" />
          <GraficoMensal
            rotulos={dados.serieMensal.map((m) => formatarMes(m.mes))}
            enviados={dados.serieMensal.map((m) => m.enviados)}
            concluidos={dados.serieMensal.map((m) => m.concluidos)}
            descricao={`Gráfico mensal: ${dados.serieMensal.map((m) => `${formatarMes(m.mes)}, ${m.enviados} enviados e ${m.concluidos} concluídos`).join('; ')}.`}
          />
        </Cartao>

        <Cartao>
          <CabecalhoDoCartao titulo="Por status" descricao="Todos os documentos" />
          <GraficoDeRosca
            centro={{ valor: String(indicadores.total), rotulo: 'documentos' }}
            descricao={`Distribuição por status: ${STATUS_EM_ORDEM.map((s) => `${STATUS_DO_DOCUMENTO[s].rotulo} ${dados.porStatus[s] ?? 0}`).join(', ')}.`}
            fatias={STATUS_EM_ORDEM.map((s) => ({ rotulo: STATUS_DO_DOCUMENTO[s].rotulo, valor: dados.porStatus[s] ?? 0, cor: COR_DO_STATUS[s] }))}
          />
          <ul className="mt-6 space-y-2">
            {STATUS_EM_ORDEM.filter((s) => (dados.porStatus[s] ?? 0) > 0).map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <Link to={`/app/documentos?status=${s}`} className="text-tinta-2 hover:text-tinta flex items-center gap-2.5">
                  <span className="size-2.5 rounded-full" style={{ background: COR_DO_STATUS[s] }} aria-hidden="true" />
                  {STATUS_DO_DOCUMENTO[s].rotulo}
                </Link>
                <span className="text-tinta font-semibold numeros">{dados.porStatus[s]}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao>
          <CabecalhoDoCartao titulo="Aguardando sua assinatura" descricao="Documentos em que é a sua vez" />
          {dados.aguardandoVoce.length === 0 ? (
            <EstadoVazio className="py-8" icone={<Inbox />} titulo="Tudo em dia" descricao="Nenhum documento esperando por você agora." />
          ) : (
            <ul className="divide-linha -mx-2 divide-y">
              {dados.aguardandoVoce.map((item) => (
                <li key={item.documento}>
                  <Link to={`/app/documentos/${item.documento}`} className="hover:bg-superficie-2 group flex items-center gap-4 rounded-xl px-2 py-3 transition">
                    <span className="bg-alerta-suave text-alerta-tinta flex size-10 shrink-0 items-center justify-center rounded-xl">
                      <PenLine className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-tinta block truncate text-sm font-semibold">{item.titulo}</span>
                      <span className="text-tinta-3 block text-xs">
                        De {item.remetente} · {item.prazo ? `prazo ${formatarData(item.prazo)}` : `enviado ${formatarRelativo(item.enviadoEm)}`}
                      </span>
                    </span>
                    <ArrowRight className="text-tinta-3 group-hover:text-destaque size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <CabecalhoDoCartao titulo="Atividade recente" descricao="Registrada na trilha de auditoria" />
          {dados.atividade.length === 0 ? (
            <EstadoVazio className="py-8" icone={<Activity />} titulo="Sem atividade" descricao="Os eventos dos documentos aparecem aqui." />
          ) : (
            <ol className="relative space-y-5 pl-6">
              <span aria-hidden="true" className="bg-linha absolute top-1.5 bottom-1.5 left-[7px] w-px" />
              {dados.atividade.map((evento, i) => (
                <li key={`${evento.em}-${i}`} className="relative">
                  <span aria-hidden="true" className={cn('ring-superficie absolute top-1 -left-6 size-3.5 rounded-full ring-4', corDoEvento(evento.acao))} />
                  <p className="text-tinta text-sm">{evento.resumo}</p>
                  <p className="text-tinta-3 mt-0.5 text-xs">
                    {formatarRelativo(evento.em)}
                    {evento.documento?.uuid && (
                      <>
                        {' · '}
                        <Link to={`/app/documentos/${evento.documento.uuid}`} className="text-destaque hover:underline">
                          {evento.documento.titulo}
                        </Link>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Cartao>
      </div>

      <Cartao>
        <CabecalhoDoCartao titulo="Verificações de identidade aprovadas" descricao="Total acumulado, por método" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(VERIFICACAO) as TipoDeVerificacao[]).map((tipo) => {
            const { rotulo, icone: Icone } = VERIFICACAO[tipo];

            return (
              <div key={tipo} className="border-linha bg-superficie-2/50 flex items-center gap-4 rounded-2xl border p-4">
                <span className="bg-destaque-suave text-destaque flex size-11 items-center justify-center rounded-xl">
                  <Icone className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-display text-tinta text-2xl font-extrabold numeros">{dados.verificacoes[tipo] ?? 0}</p>
                  <p className="text-tinta-3 text-xs">{rotulo}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Cartao>
    </div>
  );
}

function corDoEvento(acao: string): string {
  if (acao === 'documento_concluido') return 'bg-sucesso';
  if (acao === 'assinatura_registrada') return 'bg-destaque';
  if (acao === 'assinatura_recusada' || acao === 'documento_cancelado') return 'bg-perigo';

  return 'bg-linha-forte';
}

function Indicador({ icone, rotulo, valor, detalhe, cor, indice }: { readonly icone: ReactNode; readonly rotulo: string; readonly valor: string; readonly detalhe: string; readonly cor: string; readonly indice: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: indice * 0.06, duration: 0.4 }}>
      <Cartao className="group relative h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-elevada">
        <div aria-hidden="true" className={cn('absolute -top-10 -right-10 size-28 rounded-full bg-gradient-to-br opacity-10 transition group-hover:opacity-20', cor)} />
        <span className={cn('flex size-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg [&_svg]:size-5', cor)} aria-hidden="true">
          {icone}
        </span>
        <p className="text-tinta-2 mt-5 text-sm font-medium">{rotulo}</p>
        <p className="font-display text-tinta mt-1 text-3xl font-extrabold numeros">{valor}</p>
        <p className="text-tinta-3 mt-1 text-xs">{detalhe}</p>
      </Cartao>
    </motion.div>
  );
}

function EsqueletoDoPainel() {
  return (
    <Carregando rotulo="Carregando o painel…">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Esqueleto key={i} className="h-40 rounded-[var(--radius-cartao)]" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <Esqueleto className="h-96 rounded-[var(--radius-cartao)] xl:col-span-2" />
          <Esqueleto className="h-96 rounded-[var(--radius-cartao)]" />
        </div>
      </div>
    </Carregando>
  );
}
