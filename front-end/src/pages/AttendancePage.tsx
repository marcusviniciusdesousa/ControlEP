import { ClipboardCheck, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DateRangeFilter } from '../components/forms/DateRangeFilter';
import { ExportButton } from '../components/records/RecordActions';
import { DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { useControl } from '../contexts/ControlContext';
import { useNotification } from '../contexts/NotificationContext';
import { useDateRange } from '../hooks/useDateRange';
import {
  ApiError,
  markAllPresentByDate,
  saveAttendanceRecord,
} from '../services/api';

/** Registro de presença por funcionário e data integrado à API. */
export default function AttendancePage() {
  const {
    employees,
    shifts,
    attendance,
    setAttendance,
    attendanceRecordIds,
    setAttendanceRecordIds,
    loadAttendanceDates,
  } = useControl();
  const { notify } = useNotification();
  const [person, setPerson] = useState('Todos');
  const [status, setStatus] = useState('Ativo');
  const [shift, setShift] = useState('Todos');
  const [savingAll, setSavingAll] = useState(false);
  const { from, setFrom, to, setTo, days } = useDateRange();

  useEffect(() => {
    void loadAttendanceDates(days);
  }, [days, loadAttendanceDates]);

  const dates = <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />;
  const shiftOptions =
    shifts.length > 0 ? ['Todos', ...shifts.map((s) => s.name)] : ['Todos', 'Manhã', 'Tarde', 'Noite'];

  const filteredEmployees = employees.filter(
    (e) =>
      (status === 'Todos' || e.status === status) &&
      (person === 'Todos' || e.name === person) &&
      (shift === 'Todos' || e.shift === shift),
  );

  const handleCellChange = async (employeeId: string, date: string, nextValue: string) => {
    if (!nextValue) return;
    const key = `${employeeId}|${date}`;
    const prevValue = attendance[key] || '';

    setAttendance((prev) => ({ ...prev, [key]: nextValue }));

    try {
      const savedId = await saveAttendanceRecord({
        recordId: attendanceRecordIds[key],
        employeeId,
        statusLabel: nextValue,
        date,
      });
      if (savedId) {
        setAttendanceRecordIds((prev) => ({ ...prev, [key]: savedId }));
      }
    } catch (err) {
      setAttendance((prev) => ({ ...prev, [key]: prevValue }));
      notify(err instanceof ApiError ? err.message : 'Erro ao salvar presença.');
    }
  };

  const handleMarkAll = async () => {
    if (savingAll) return;
    setSavingAll(true);
    try {
      await Promise.all(days.map((d) => markAllPresentByDate(d)));
      await loadAttendanceDates(days);
      notify('Presenças registradas para o período.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Erro ao registrar presença em massa.');
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Lista de Presença"
        subtitle="Organize a disponibilidade e a presença da sua equipe."
        actions={
          <>
            <ExportButton
              rows={employees.map((e) => ({
                Funcionário: e.name,
                ...Object.fromEntries(
                  days.map((d) => [d, attendance[e.id + '|' + d] || 'Não informado']),
                ),
              }))}
              name="presenca"
            />
            <button className="secondary" onClick={() => window.print()}>
              <Printer size={15} />
              Imprimir
            </button>
            <button className="primary" disabled={savingAll} onClick={() => void handleMarkAll()}>
              <ClipboardCheck size={16} />
              {savingAll ? 'Registrando...' : 'Marcar todos presentes'}
            </button>
          </>
        }
      />
      <div className="filter-card filters">
        {dates}
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Ativo</option>
            <option>Inativo</option>
            <option>Todos</option>
          </select>
        </label>
        <label>
          Turno
          <select value={shift} onChange={(e) => setShift(e.target.value)}>
            {shiftOptions.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Pessoa
          <select value={person} onChange={(e) => setPerson(e.target.value)}>
            <option>Todos</option>
            {employees.map((e) => (
              <option key={e.id}>{e.name}</option>
            ))}
          </select>
        </label>
      </div>
      <DataTable
        headers={['Funcionário', 'Turno', ...days.map((d) => d.slice(8) + '/' + d.slice(5, 7))]}
        empty={!filteredEmployees.length}
      >
        {filteredEmployees.map((e) => (
          <tr key={e.id}>
            <td className="strong">{e.name}</td>
            <td>{e.shift || '—'}</td>
            {days.map((d) => (
              <td key={d} className="presence-cell">
                <select
                  aria-label={`Presença de ${e.name} em ${d}`}
                  className={attendance[e.id + '|' + d] === 'Presente' ? 'present' : ''}
                  value={attendance[e.id + '|' + d] || ''}
                  onChange={(ev) => void handleCellChange(e.id, d, ev.target.value)}
                >
                  <option value="">Não informado</option>
                  {['Presente', 'Falta', 'Atestado', 'Afastado', 'Férias', 'Folga'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </td>
            ))}
          </tr>
        ))}
      </DataTable>
      <p className="helper-text">
        As alterações são salvas automaticamente no servidor. Exibição limitada a 62 dias por consulta.
      </p>
    </>
  );
}