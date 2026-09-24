/**
 * Formatação pt-BR, em fuso de Brasília. Uma fonte só: data que aparece de dois
 * jeitos em duas telas faz quem lê desconfiar de que são datas diferentes.
 */
const FUSO = 'America/Sao_Paulo';

const dataCurta = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const dataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  dateStyle: 'short',
  timeStyle: 'short',
});
const dataHoraLonga = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  dateStyle: 'long',
  timeStyle: 'medium',
});
const relativo = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
const mesCurto = new Intl.DateTimeFormat('pt-BR', { month: 'short' });

type Entrada = string | Date | null | undefined;

function paraData(valor: Entrada): Date | null {
  if (valor === null || valor === undefined) return null;

  const data = valor instanceof Date ? valor : new Date(valor);

  return Number.isNaN(data.getTime()) ? null : data;
}

/** ⚠️ `null` vira travessão, nunca uma data inventada. */
export function formatarData(valor: Entrada): string {
  const data = paraData(valor);

  return data === null ? '—' : dataCurta.format(data).replace(' de ', ' ').replace('.', '');
}

export function formatarDataHora(valor: Entrada): string {
  const data = paraData(valor);

  return data === null ? '—' : dataHora.format(data);
}

export function formatarDataHoraLonga(valor: Entrada): string {
  const data = paraData(valor);

  return data === null ? '—' : `${dataHoraLonga.format(data)} (Brasília)`;
}

/** "há 5 minutos", "ontem", "em 3 dias". */
export function formatarRelativo(valor: Entrada, agora = new Date()): string {
  const data = paraData(valor);

  if (data === null) return '—';

  const segundos = Math.round((data.getTime() - agora.getTime()) / 1000);
  const abs = Math.abs(segundos);

  if (abs < 45) return 'agora mesmo';
  if (abs < 3600) return relativo.format(Math.round(segundos / 60), 'minute');
  if (abs < 86_400) return relativo.format(Math.round(segundos / 3600), 'hour');
  if (abs < 30 * 86_400) return relativo.format(Math.round(segundos / 86_400), 'day');

  return formatarData(data);
}

/** `"2026-03"` → `"mar"`. */
export function formatarMes(chave: string): string {
  const [ano, mes] = chave.split('-').map(Number);

  return mesCurto.format(new Date(ano ?? 2000, (mes ?? 1) - 1, 1)).replace('.', '');
}

export function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Horas → "3 h", "2 dias", "45 min". `null` vira travessão. */
export function formatarDuracao(horas: number | null): string {
  if (horas === null) return '—';
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 48) return `${horas.toFixed(horas < 10 ? 1 : 0).replace('.', ',')} h`;

  return `${Math.round(horas / 24)} dias`;
}

export function formatarPorcentagem(valor: number | null): string {
  return valor === null ? '—' : `${Math.round(valor * 100)}%`;
}

/** Máscara de CPF enquanto se digita. */
export function mascararCpf(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);

  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/** Saudação pelo horário de Brasília. */
export function saudacao(agora = new Date()): string {
  const hora = Number(
    new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: 'numeric', hour12: false }).format(
      agora,
    ),
  );

  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';

  return 'Boa noite';
}
