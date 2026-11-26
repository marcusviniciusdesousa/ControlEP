/** Dias da semana no padrão Date#getDay / PostgreSQL EXTRACT(DOW): 0 = domingo. */
export const WEEKDAYS = [
  { value: 0, short: 'Dom', long: 'domingo' },
  { value: 1, short: 'Seg', long: 'segunda-feira' },
  { value: 2, short: 'Ter', long: 'terça-feira' },
  { value: 3, short: 'Qua', long: 'quarta-feira' },
  { value: 4, short: 'Qui', long: 'quinta-feira' },
  { value: 5, short: 'Sex', long: 'sexta-feira' },
  { value: 6, short: 'Sáb', long: 'sábado' },
] as const;

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Dia da semana de uma data AAAA-MM-DD sem deslocamento de fuso. */
export function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00`).getDay();
}

export function parseDays(value: string | number[] | null | undefined): number[] {
  if (Array.isArray(value)) return value.map(Number);
  if (!value) return [];
  return String(value)
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6);
}

/** Resumo legível: "Todos os dias", "Seg a Sex", "Fins de semana" ou lista. */
export function describeDays(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const key = sorted.join(',');
  if (key === '0,1,2,3,4,5,6') return 'Todos os dias';
  if (key === '1,2,3,4,5') return 'Seg a Sex';
  if (key === '1,2,3,4,5,6') return 'Seg a Sáb';
  if (key === '0,6') return 'Fins de semana';
  if (!sorted.length) return '—';
  return sorted.map((d) => WEEKDAYS[d].short).join(', ');
}
