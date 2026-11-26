import { CircleHelp, Clock, Pencil, Shield, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { OperationForm as Operation } from '../components/forms/OperationForm';
import { CreateButton, RowActions } from '../components/records/RecordActions';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { useControl } from '../contexts/ControlContext';
import { useNotification } from '../contexts/NotificationContext';
import {
  ApiError,
  createShift,
  deleteShift,
  fetchShifts,
  updateShift,
  type ShiftItem,
} from '../services/api';

/** Administração de papéis, turnos e configuração da operação em abas independentes. */
export default function ManagementPage() {
  const { roles } = useControl();
  const { notify } = useNotification();
  const [management, setManagement] = useState('Papéis e Permissões');
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftName, setShiftName] = useState('');
  const [hourStart, setHourStart] = useState('08:00');
  const [hourEnd, setHourEnd] = useState('17:00');
  const [savingShift, setSavingShift] = useState(false);

  useEffect(() => {
    fetchShifts()
      .then(setShifts)
      .catch(() => {});
  }, []);

  const resetShiftForm = () => {
    setEditingShiftId(null);
    setShiftName('');
    setHourStart('08:00');
    setHourEnd('17:00');
  };

  const handleStartEditShift = (shift: ShiftItem) => {
    setEditingShiftId(shift.id);
    setShiftName(shift.name);
    setHourStart(shift.hourStart.slice(0, 5));
    setHourEnd(shift.hourEnd.slice(0, 5));
  };

  const handleSaveShift = async (event: FormEvent) => {
    event.preventDefault();
    if (!shiftName.trim() || savingShift) return;
    setSavingShift(true);
    try {
      if (editingShiftId) {
        await updateShift({
          id: editingShiftId,
          name: shiftName.trim(),
          hour_start: hourStart,
          hour_end: hourEnd,
        });
        notify('Turno atualizado com sucesso.');
      } else {
        await createShift({ name: shiftName.trim(), hour_start: hourStart, hour_end: hourEnd });
        notify('Turno cadastrado com sucesso.');
      }
      setShifts(await fetchShifts());
      resetShiftForm();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Erro ao salvar turno.');
    } finally {
      setSavingShift(false);
    }
  };

  const handleDeleteShift = async (id: string) => {
    try {
      await deleteShift(id);
      if (editingShiftId === id) resetShiftForm();
      setShifts(await fetchShifts());
      notify('Turno excluído.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Não foi possível excluir o turno.');
    }
  };

  return (
    <>
      <PageHeader title="Gestão" subtitle="Configure papéis, turnos e detalhes da operação." />
      <div className="tabs management-tabs">
        {['Papéis e Permissões', 'Turnos', 'Operação'].map((t) => (
          <button
            key={t}
            className={management === t ? 'active' : ''}
            onClick={() => setManagement(t)}
          >
            {t === 'Operação' ? (
              <CircleHelp size={16} />
            ) : t === 'Turnos' ? (
              <Clock size={16} />
            ) : (
              <Shield size={16} />
            )}
            {t}
          </button>
        ))}
      </div>

      {management === 'Papéis e Permissões' && (
        <>
          <div className="section-heading">
            <h2>Papéis cadastrados</h2>
            <CreateButton kind="role" label="Novo papel" />
          </div>
          <DataTable headers={['Nome', 'Permissões', '']} empty={!roles.length}>
            {roles.map((r) => (
              <tr key={r.id}>
                <td className="strong">{r.name}</td>
                <td>
                  <div className="permission-list">
                    {r.permissions
                      ? r.permissions.split(',').map((p) => (
                          <Badge key={p} tone="red">
                            {p.trim()}
                          </Badge>
                        ))
                      : '—'}
                  </div>
                </td>
                <td>
                  <RowActions kind="role" row={r} />
                </td>
              </tr>
            ))}
          </DataTable>
        </>
      )}

      {management === 'Turnos' && (
        <>
          <form className="list-toolbar" onSubmit={(e) => void handleSaveShift(e)}>
            <input
              placeholder="Nome do turno (ex: Manhã)"
              value={shiftName}
              onChange={(e) => setShiftName(e.target.value)}
              required
            />
            <input
              type="time"
              aria-label="Início do turno"
              value={hourStart}
              onChange={(e) => setHourStart(e.target.value)}
              required
            />
            <input
              type="time"
              aria-label="Fim do turno"
              value={hourEnd}
              onChange={(e) => setHourEnd(e.target.value)}
              required
            />
            <button type="submit" className="primary" disabled={savingShift}>
              {editingShiftId ? 'Salvar alterações' : 'Novo turno'}
            </button>
            {editingShiftId && (
              <button
                type="button"
                className="ghost"
                aria-label="Cancelar edição"
                onClick={resetShiftForm}
              >
                <X size={16} /> Cancelar
              </button>
            )}
          </form>
          <DataTable headers={['Turno', 'Início', 'Término', '']} empty={!shifts.length}>
            {shifts.map((s) => (
              <tr key={s.id}>
                <td className="strong">{s.name}</td>
                <td>{s.hourStart}</td>
                <td>{s.hourEnd}</td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="ghost"
                      aria-label={`Editar turno ${s.name}`}
                      onClick={() => handleStartEditShift(s)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      aria-label={`Excluir turno ${s.name}`}
                      onClick={() => void handleDeleteShift(s.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </>
      )}

      {management === 'Operação' && <Operation />}
    </>
  );
}