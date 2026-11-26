/** Data civil local no formato esperado por input[type=date], sem conversão para UTC. */
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Intervalo inclusivo limitado para não criar tabelas com centenas de colunas. */
export function dateRange(from: string, to: string, limit = 62): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return [];
  const date = new Date(`${from}T12:00:00`);
  const endDate = new Date(`${to}T12:00:00`);
  const days: string[] = [];
  if (
    Number.isNaN(date.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    localDate(date) !== from ||
    localDate(endDate) !== to
  )
    return days;
  while (localDate(date) <= to && days.length < limit) {
    days.push(localDate(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

/** A chave de presença tem o formato employeeId|YYYY-MM-DD. */
export function countAttendance(
  attendance: Record<string, string>,
  value: string,
  from: string,
  to: string,
): number {
  return Object.entries(attendance).filter(([key, status]) => {
    const day = key.split('|')[1];
    return status === value && day >= from && day <= to;
  }).length;
}

/** Converte datas persistidas, inclusive ISO/UTC, para datetime-local. */
export function toDateTimeInput(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${localDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Data/hora curta em pt-BR ("25/11/2026 08:15"); vazio para valores inválidos. */
export function formatDateTime(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** AAAA-MM-DD -> DD/MM/AAAA */
export function formatDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('/');
  // Timestamps (ex.: "2026-11-26T01:10:00Z") são exibidos no fuso local
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('pt-BR') : '';
}

/* ------------------------------------------------------------------ */
/* Máscaras pt-BR (DD/MM/AAAA e HH:MM 24h)                             */
/* ------------------------------------------------------------------ */

/** Aplica a máscara DD/MM/AAAA enquanto o usuário digita. */
export function maskDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Aplica a máscara HH:MM enquanto o usuário digita. */
export function maskTime(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** AAAA-MM-DD -> DD/MM/AAAA (vazio se inválido). */
export function isoToBr(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '';
}

/** DD/MM/AAAA -> AAAA-MM-DD, ou null se a data não existir (ex.: 31/02). */
export function brToIso(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDate(date) === iso ? iso : null;
}

/** Texto no formato AAAA-MM-DD representando uma data real? */
export function isIsoDate(value: string): boolean {
  return Boolean(brToIso(isoToBr(value)));
}

/** "HH:MM" válido em 24h? */
export function isValidTime(text: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text);
}
