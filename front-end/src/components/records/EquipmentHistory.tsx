import { useEffect, useState } from 'react';
import { errorMessage, fetchEquipmentHistory } from '../../services/api';
import type { EquipmentUsage, Row } from '../../types/models';
import { formatDateTime } from '../../utils/dates';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

/** Histórico de empréstimos do equipamento, lido do servidor. */
export function EquipmentHistory({ equipment }: { equipment: Row }) {
  const [history, setHistory] = useState<EquipmentUsage[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchEquipmentHistory(equipment.id)
      .then(setHistory)
      .catch((err) => setError(errorMessage(err, 'Não foi possível carregar o histórico.')));
  }, [equipment.id]);

  if (error) return <p className="form-error">{error}</p>;
  if (!history) return <p>Carregando...</p>;

  return (
    <div className="history-list">
      {history.length ? (
        history.map((item) => (
          <div key={item.id}>
            <strong>{item.employee}</strong>
            <p>
              {formatDateTime(item.start)}
              {item.end ? ` → ${formatDateTime(item.end)}` : ''}
            </p>
            <Badge tone={item.end ? 'green' : 'amber'}>{item.end ? 'Devolvido' : 'Em uso'}</Badge>
          </div>
        ))
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
