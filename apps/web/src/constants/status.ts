import type { LucideIcon } from 'lucide-react';
import { Ban, CheckCircle2, Clock3, Eye, FilePen, Hand, Hourglass, Mail, Mic, PenLine, ScanFace, XCircle } from 'lucide-react';
import type { TomDeEtiqueta } from '@/components/ui/Etiqueta';
import type { NivelDeVerificacao, StatusDoDocumento, StatusDoSignatario, TipoDeVerificacao } from '@/lib/api/documentos';

/**
 * Mapas de fonte única: rótulo, tom e ícone de cada status. ⚠️ Nunca um `switch`
 * espalhado por componente — e **status nunca só por cor**: sempre cor, ícone e
 * rótulo. A `ordem` é a do ciclo de vida, não a alfabética.
 */
export const STATUS_DO_DOCUMENTO: Record<StatusDoDocumento, { rotulo: string; tom: TomDeEtiqueta; icone: LucideIcon; ordem: number }> = {
  rascunho: { rotulo: 'Rascunho', tom: 'neutro', icone: FilePen, ordem: 1 },
  em_andamento: { rotulo: 'Em andamento', tom: 'alerta', icone: Clock3, ordem: 2 },
  concluido: { rotulo: 'Concluído', tom: 'sucesso', icone: CheckCircle2, ordem: 3 },
  recusado: { rotulo: 'Recusado', tom: 'perigo', icone: XCircle, ordem: 4 },
  expirado: { rotulo: 'Expirado', tom: 'perigo', icone: Hourglass, ordem: 5 },
  cancelado: { rotulo: 'Cancelado', tom: 'neutro', icone: Ban, ordem: 6 },
};

export const STATUS_EM_ORDEM = (Object.keys(STATUS_DO_DOCUMENTO) as StatusDoDocumento[]).sort(
  (a, b) => STATUS_DO_DOCUMENTO[a].ordem - STATUS_DO_DOCUMENTO[b].ordem,
);

export const STATUS_DO_SIGNATARIO: Record<StatusDoSignatario, { rotulo: string; tom: TomDeEtiqueta; icone: LucideIcon }> = {
  pendente: { rotulo: 'Aguardando', tom: 'neutro', icone: Clock3 },
  visualizado: { rotulo: 'Visualizou', tom: 'info', icone: Eye },
  assinado: { rotulo: 'Assinou', tom: 'sucesso', icone: PenLine },
  recusado: { rotulo: 'Recusou', tom: 'perigo', icone: XCircle },
};

export const VERIFICACAO: Record<TipoDeVerificacao, { rotulo: string; curto: string; icone: LucideIcon }> = {
  codigo_email: { rotulo: 'Código por e-mail', curto: 'E-mail', icone: Mail },
  facial: { rotulo: 'Rosto com prova de vida', curto: 'Rosto', icone: ScanFace },
  voz: { rotulo: 'Desafio de voz', curto: 'Voz', icone: Mic },
  gestos: { rotulo: 'Sequência de gestos', curto: 'Gestos', icone: Hand },
};

export const NIVEIS: Record<NivelDeVerificacao, { rotulo: string; descricao: string; verificacoes: TipoDeVerificacao[] }> = {
  simples: {
    rotulo: 'Simples',
    descricao: 'Código de uso único enviado ao e-mail de quem assina.',
    verificacoes: ['codigo_email'],
  },
  biometrico: {
    rotulo: 'Biométrico',
    descricao: 'E-mail + reconhecimento facial com prova de vida.',
    verificacoes: ['codigo_email', 'facial'],
  },
  completo: {
    rotulo: 'Completo',
    descricao: 'E-mail + rosto + desafio de voz + sequência de gestos.',
    verificacoes: ['codigo_email', 'facial', 'voz', 'gestos'],
  },
};
