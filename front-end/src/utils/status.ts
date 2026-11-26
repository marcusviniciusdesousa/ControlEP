import type { BadgeTone } from '../types/models';

/** Cor do badge conforme o nome do status de equipamento cadastrado no banco. */
export function equipmentStatusTone(status: string): BadgeTone {
  const s = status.trim().toLowerCase();
  if (s === 'disponível' || s === 'disponivel' || s === 'ativo') return 'green';
  if (s === 'em uso') return 'amber';
  if (s === 'manutenção' || s === 'manutencao') return 'red';
  return 'neutral';
}
