import type { Employee } from '../types/models';
import { formatDate } from './dates.ts';
import { describeDays, parseDays, WEEKDAYS, weekdayOf } from './weekdays.ts';

/** Motivo pelo qual não se registra presença no dia (ou null quando permitido). */
export function blockedReason(employee: Employee, date: string): string | null {
  if (employee.admission && date < employee.admission) {
    return `Antes da admissão (${formatDate(employee.admission)})`;
  }
  const days = parseDays(employee.shiftDays);
  if (days.length && !days.includes(weekdayOf(date))) {
    return `Fora da escala: turno ${employee.shift} não vale às ${WEEKDAYS[weekdayOf(date)].long}s (${describeDays(days)})`;
  }
  return null;
}
