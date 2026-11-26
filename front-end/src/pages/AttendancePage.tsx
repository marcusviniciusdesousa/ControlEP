import { ClipboardCheck, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DateRangeFilter } from '../components/forms/DateRangeFilter';
import { ExportButton } from '../components/records/RecordActions';
import { DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { useControl } from '../contexts/ControlContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDateRange } from '../hooks/useDateRange';
import { usePersistentState } from '../hooks/usePersistentState';
import { isIsoDate } from '../utils/dates';
import {
  deleteAttendanceRecord,
  errorMessage,
  markAllPresent,
  saveAttendanceRecord,
} from '../services/api';
import type { Employee } from '../types/models';
import { blockedReason } from '../utils/attendance';

/** Registro de presença por funcionário e data integrado à API. */
export default function AttendancePage() {
  const {
    employees,
    shifts,
    lookups,
    attendance,
    setAttendance,
    attendanceRecordIds,
    setAttendanceRecordIds,
    loadAttendanceRange,
  } = useControl();
  const { notify } = useNotification();
  const [person, setPerson] = usePersistentState('attendance:person', '');
  const [status, setStatus] = usePersistentState('attendance:status', 'Ativo');
  const [shift, setShift] = usePersistentState('attendance:shift', '');
  const [savingAll, setSavingAll] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { from, setFrom, to, setTo, days } = useDateRange('attendance');
  const location = useLocation();
  const navigate = useNavigate();

  // Vindo do painel ("Gerenciar presença"): aplica o intervalo informado na URL
  // e depois limpa a URL, para que os filtros escolhidos aqui continuem valendo.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qFrom = params.get('from');
    const qTo = params.get('to');
    if (!qFrom && !qTo) return;
    if (qFrom && qTo && isIsoDate(qFrom) && isIsoDate(qTo) && qFrom <= qTo) {
      setFrom(qFrom);
      setTo(qTo);
    }
    const timer = setTimeout(() => navigate(location.pathname, { replace: true }), 0);
    return () => clearTimeout(timer);
  }, [location.search, location.pathname, navigate, setFrom, setTo]);
  const statuses = lookups.attendanceStatuses;

  useEffect(() => {
    loadAttendanceRange(from, to).catch((err) =>
      notify(errorMessage(err, 'Não foi possível carregar as presenças.')),
    );
  }, [from, to, loadAttendanceRange, notify]);

  const filteredEmployees = employees.filter(
    (e) =>
      (status === 'Todos' || e.status === status) &&
      (!person || e.id === person) &&
      (!shift || e.shiftId === shift),
  );

  const handleCellChange = async (employee: Employee, date: string, nextStatusId: string) => {
    const key = `${employee.id}|${date}`;
    const prevValue = attendance[key] || '';
    const recordId = attendanceRecordIds[key];
    const nextName = statuses.find((s) => s.id === nextStatusId)?.name ?? '';
    if (!nextStatusId && !recordId) return;

    setSavingKey(key);
    setAttendance((prev) => ({ ...prev, [key]: nextName }));

    try {
      if (!nextStatusId) {
        // "Não informado": remove o registro existente
        await deleteAttendanceRecord(recordId);
        setAttendance((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setAttendanceRecordIds((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } else {
        const savedId = await saveAttendanceRecord({
          employeeId: employee.id,
          statusId: nextStatusId,
          date,
        });
        if (savedId) setAttendanceRecordIds((prev) => ({ ...prev, [key]: savedId }));
      }
    } catch (err) {
      setAttendance((prev) => ({ ...prev, [key]: prevValue }));
      notify(errorMessage(err, 'Erro ao salvar presença.'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleMarkAll = async () => {
    if (savingAll || !days.length) return;
    setSavingAll(true);
    try {
      const message = await markAllPresent(days[0], days[days.length - 1]);
      await loadAttendanceRange(from, to);
      notify(message);
    } catch (err) {
      notify(errorMessage(err, 'Erro ao registrar presença em massa.'));
    } finally {
      setSavingAll(false);
    }
  };

  const statusIdByName = (name: string) => statuses.find((s) => s.name === name)?.id ?? '';

  return (
    <>
      <PageHeader
        title="Lista de Presença"
        subtitle="Organize a disponibilidade e a presença da sua equipe."
        actions={
          <>
            <ExportButton
              rows={filteredEmployees.map((e) => ({
                Funcionário: e.name,
                ...Object.fromEntries(
                  days.map((d) => [
                    d,
                    attendance[e.id + '|' + d] || blockedReason(e, d) || 'Não informado',
                  ]),
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
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
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
            <option value="">Todos</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pessoa
          <select value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">Todos</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <DataTable
        headers={['Funcionário', 'Turno', ...days.map((d) => d.slice(8) + '/' + d.slice(5, 7))]}
        empty={!filteredEmployees.length}
        layout="scroll"
      >
        {filteredEmployees.map((e) => (
          <tr key={e.id}>
            <td className="strong">
              {e.name}
              <small className="mobile-only">{e.shift}</small>
            </td>
            <td>{e.shift || '—'}</td>
            {days.map((d) => {
              const key = e.id + '|' + d;
              const current = attendance[key] || '';
              const blocked = blockedReason(e, d);
              // Registros antigos continuam editáveis mesmo fora da regra
              const disabled = savingKey === key || (Boolean(blocked) && !current);
              return (
                <td key={d} className="presence-cell">
                  <select
                    aria-label={`Presença de ${e.name} em ${d}`}
                    title={blocked ?? undefined}
                    className={current === 'Presente' ? 'present' : ''}
                    value={statusIdByName(current)}
                    disabled={disabled}
                    onChange={(ev) => void handleCellChange(e, d, ev.target.value)}
                  >
                    <option value="">
                      {blocked && !current ? blocked.split(':')[0].split(' (')[0] : 'Não informado'}
                    </option>
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </td>
              );
            })}
          </tr>
        ))}
      </DataTable>
      <p className="helper-text">
        As alterações são salvas automaticamente no servidor. Dias anteriores à admissão ou fora da
        escala do turno ficam bloqueados. Exibição limitada a 62 dias por consulta.
      </p>
    </>
  );
}
