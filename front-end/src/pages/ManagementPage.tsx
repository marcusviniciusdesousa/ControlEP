import { CircleHelp, Clock, Shield } from 'lucide-react';
import { OperationForm as Operation } from '../components/forms/OperationForm';
import { CreateButton, RowActions } from '../components/records/RecordActions';
import { ShiftsPanel } from '../components/shifts/ShiftsPanel';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { useControl } from '../contexts/ControlContext';
import { usePersistentState } from '../hooks/usePersistentState';

/** Administração de papéis, turnos e configuração da operação em abas independentes. */
export default function ManagementPage() {
  const { roles } = useControl();
  const [management, setManagement] = usePersistentState('management:tab', 'Papéis e Permissões');

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
            <span className="tab-label-long">{t}</span>
            <span className="tab-label-short">{t === 'Papéis e Permissões' ? 'Papéis' : t}</span>
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

      {management === 'Turnos' && <ShiftsPanel />}

      {management === 'Operação' && <Operation />}
    </>
  );
}
