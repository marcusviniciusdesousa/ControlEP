import { useMemo } from 'react';
import { dateRange, localDate } from '../utils/dates';
import { usePersistentState } from './usePersistentState';

/**
 * Intervalo de datas de uma tela. O valor é mantido ao trocar de módulo e
 * voltar (cada tela tem o seu, identificado por `scope`).
 */
export function useDateRange(scope: string) {
  const [from, setFrom] = usePersistentState(`${scope}:from`, localDate());
  const [to, setTo] = usePersistentState(`${scope}:to`, localDate());
  const days = useMemo(() => dateRange(from, to), [from, to]);
  return { from, setFrom, to, setTo, days };
}
