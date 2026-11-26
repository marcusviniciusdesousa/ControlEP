import { Check, Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useControl } from '../../contexts/ControlContext';
import { useNotification } from '../../contexts/NotificationContext';
import {
  createShift,
  deleteShift,
  errorMessage,
  updateShift,
  type ShiftItem,
} from '../../services/api';
import { isValidTime } from '../../utils/dates';
import { describeDays } from '../../utils/weekdays';
import { TimeInput } from '../forms/TimeInput';
import { DataTable } from '../ui/DataTable';
import { Modal } from '../ui/Modal';
import { DayChips, DayPicker } from './DayPicker';

type Draft = { id?: string; name: string; hourStart: string; hourEnd: string; days: number[] };

const EMPTY: Draft = { name: '', hourStart: '08:00', hourEnd: '17:00', days: [1, 2, 3, 4, 5] };

/** Lista de turnos com cadastro/edição em diálogo. */
export function ShiftsPanel() {
  const { shifts, reloadShifts, reloadEmployees } = useControl();
  const { notify } = useNotification();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<ShiftItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const open = (shift?: ShiftItem) => {
    setError('');
    setDraft(
      shift
        ? {
            id: shift.id,
            name: shift.name,
            hourStart: shift.hourStart,
            hourEnd: shift.hourEnd,
            days: shift.days,
          }
        : { ...EMPTY },
    );
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || saving) return;
    setError('');
    if (!draft.name.trim()) return setError('Informe o nome do turno.');
    if (!isValidTime(draft.hourStart) || !isValidTime(draft.hourEnd))
      return setError('Informe os horários no formato HH:MM (24h).');
    if (draft.hourStart === draft.hourEnd)
      return setError('O término deve ser diferente do início.');
    if (!draft.days.length) return setError('Selecione ao menos um dia da semana.');

    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      hour_start: draft.hourStart,
      hour_end: draft.hourEnd,
      days_of_week: draft.days,
    };
    try {
      if (draft.id) await updateShift({ ...payload, id: draft.id });
      else await createShift(payload);
      // Funcionários exibem o nome/escala do turno: atualiza ambos
      await Promise.all([reloadShifts(), reloadEmployees().catch(() => {})]);
      notify(draft.id ? 'Turno atualizado.' : 'Turno cadastrado.');
      setDraft(null);
    } catch (err) {
      setError(errorMessage(err, 'Erro ao salvar turno.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteShift(toDelete.id);
      await reloadShifts();
      notify('Turno excluído.');
      setToDelete(null);
    } catch (err) {
      notify(errorMessage(err, 'Não foi possível excluir o turno.'));
    } finally {
      setDeleting(false);
    }
  };

  const crossesMidnight = (s: { hourStart: string; hourEnd: string }) => s.hourEnd < s.hourStart;

  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Turnos cadastrados</h2>
          <p>Horários e dias da semana em que cada turno é válido.</p>
        </div>
        <button className="primary" onClick={() => open()}>
          <Plus size={16} />
          Novo turno
        </button>
      </div>

      <DataTable headers={['Turno', 'Horário', 'Dias válidos', '']} empty={!shifts.length}>
        {shifts.map((s) => (
          <tr key={s.id}>
            <td className="strong">{s.name}</td>
            <td>
              <span className="shift-hours">
                <Clock size={14} />
                {s.hourStart} – {s.hourEnd}
                {crossesMidnight(s) && <small>(termina no dia seguinte)</small>}
              </span>
            </td>
            <td>
              <span className="shift-days">
                <DayChips days={s.days} />
                <small>{describeDays(s.days)}</small>
              </span>
            </td>
            <td>
              <div className="row-actions">
                <button
                  title="Editar"
                  aria-label={`Editar turno ${s.name}`}
                  onClick={() => open(s)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className="danger-icon"
                  title="Excluir"
                  aria-label={`Excluir turno ${s.name}`}
                  onClick={() => setToDelete(s)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      {draft && (
        <Modal
          title={draft.id ? 'Editar turno' : 'Novo turno'}
          subtitle="Defina o horário e os dias da semana em que o turno é válido."
          onClose={() => setDraft(null)}
        >
          <form onSubmit={(e) => void save(e)}>
            <div className="form-grid">
              <label className="span-2">
                Nome do turno
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Ex.: Manhã"
                  maxLength={30}
                  required
                />
              </label>
              <label>
                Início
                <TimeInput
                  value={draft.hourStart}
                  onChange={(v) => setDraft({ ...draft, hourStart: v })}
                  required
                />
              </label>
              <label>
                Término
                <TimeInput
                  value={draft.hourEnd}
                  onChange={(v) => setDraft({ ...draft, hourEnd: v })}
                  required
                />
              </label>
              <div className="span-2 field-group">
                <span className="field-label">Dias válidos</span>
                <DayPicker value={draft.days} onChange={(days) => setDraft({ ...draft, days })} />
                {isValidTime(draft.hourStart) &&
                  isValidTime(draft.hourEnd) &&
                  crossesMidnight(draft) && (
                    <small className="field-hint">
                      O turno termina no dia seguinte; a presença é registrada no dia de início.
                    </small>
                  )}
              </div>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="secondary"
                type="button"
                onClick={() => setDraft(null)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button className="primary" type="submit" disabled={saving}>
                <Check size={16} />
                {saving ? 'Salvando...' : 'Salvar turno'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {toDelete && (
        <Modal
          title={`Excluir o turno "${toDelete.name}"?`}
          onClose={() => setToDelete(null)}
          className="confirm"
          alert
        >
          <span className="delete-symbol">
            <Trash2 size={24} />
          </span>
          <p>Turnos com funcionários vinculados não podem ser excluídos.</p>
          <div className="modal-footer">
            <button className="secondary" onClick={() => setToDelete(null)} disabled={deleting}>
              Cancelar
            </button>
            <button className="primary" onClick={() => void remove()} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir turno'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
