import { Check } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DateRangeFilter } from '../components/forms/DateRangeFilter';
import { CreateButton, ExportButton, RowActions } from '../components/records/RecordActions';
import { DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { useControl } from '../contexts/ControlContext';
import { useNotification } from '../contexts/NotificationContext';
import { useRecordDialogs } from '../contexts/RecordDialogContext';
import { useDateRange } from '../hooks/useDateRange';
import { usePersistentState } from '../hooks/usePersistentState';
import { errorMessage, fetchEquipmentUses, returnEquipmentUse } from '../services/api';
import type { EquipmentUsage } from '../types/models';
import { formatDateTime } from '../utils/dates';

/** Empréstimos e devoluções, persistidos no servidor. Empréstimos em aberto sempre aparecem. */
export default function EquipmentUsagePage() {
  const { employees, equipment, reloadEquipment } = useControl();
  const { onRecordsChanged } = useRecordDialogs();
  const { notify } = useNotification();
  const [equipmentId, setEquipmentId] = usePersistentState('usage:equipment', '');
  const [employeeId, setEmployeeId] = usePersistentState('usage:employee', '');
  const { from, setFrom, to, setTo } = useDateRange('usage');
  const [rows, setRows] = useState<EquipmentUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [returningId, setReturningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await fetchEquipmentUses({ from, to, equipmentId, employeeId }));
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível carregar os registros de uso.'));
    } finally {
      setLoading(false);
    }
  }, [from, to, equipmentId, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Recarrega após salvar/excluir nos diálogos
  useEffect(
    () =>
      onRecordsChanged((kind) => {
        if (kind === 'usage') void load();
      }),
    [onRecordsChanged, load],
  );

  const handleReturn = async (use: EquipmentUsage) => {
    if (returningId) return;
    setReturningId(use.id);
    try {
      await returnEquipmentUse(use.id);
      await Promise.all([load(), reloadEquipment()]);
      notify('Devolução registrada.');
    } catch (err) {
      notify(errorMessage(err, 'Não foi possível registrar a devolução.'));
    } finally {
      setReturningId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Uso de Equipamentos"
        subtitle="Registre quem usa cada equipamento e em qual período."
        actions={
          <>
            <ExportButton
              rows={rows.map((u) => ({
                Equipamento: u.equipment,
                Funcionário: u.employee,
                Início: formatDateTime(u.start),
                Devolução: formatDateTime(u.end) || 'Em uso',
                Observação: u.note,
              }))}
              name="uso-equipamentos"
            />
            <CreateButton kind="usage" label="Registrar uso" />
          </>
        }
      />
      <div className="filter-card filters">
        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          fromLabel="Período início"
          toLabel="Período fim"
        />
        <label>
          Equipamento
          <select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
            <option value="">Todos</option>
            {equipment.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name + ' · ' + e.serial}
              </option>
            ))}
          </select>
        </label>
        <label>
          Funcionário
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Todos</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <DataTable
        headers={['Equipamento', 'Funcionário', 'Início', 'Devolução', 'Observação', '']}
        empty={!loading && !rows.length}
      >
        {rows.map((u) => (
          <tr key={u.id}>
            <td className="strong">{u.equipment}</td>
            <td>{u.employee}</td>
            <td>{formatDateTime(u.start)}</td>
            <td>
              {u.end ? (
                formatDateTime(u.end)
              ) : (
                <button
                  className="badge red badge-button"
                  title="Registrar devolução agora"
                  disabled={returningId === u.id}
                  onClick={() => void handleReturn(u)}
                >
                  {returningId === u.id ? 'Registrando...' : 'Em uso · devolver'}{' '}
                  <Check size={12} />
                </button>
              )}
            </td>
            <td>{u.note || '—'}</td>
            <td>
              <RowActions kind="usage" row={u} />
            </td>
          </tr>
        ))}
      </DataTable>
      <p className="helper-text">
        Empréstimos em aberto são exibidos independentemente do período selecionado.
      </p>
    </>
  );
}
