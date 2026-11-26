import { Check } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { useControl } from '../contexts/ControlContext';
import { useNotification } from '../contexts/NotificationContext';
import { ApiError, deleteUser, fetchUsers, toggleUserStatus } from '../services/api';

/** Solicitações pendentes de acesso integradas ao back-end. */
export default function ApprovalsPage() {
  const { users, setUsers } = useControl();
  const { notify } = useNotification();
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingUsers = users.filter((u) => u.status === 'Pendente');

  const handleApprove = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await toggleUserStatus(id);
      setUsers(await fetchUsers());
      notify('Usuário aprovado com sucesso.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Erro ao aprovar usuário.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await deleteUser(id);
      setUsers(await fetchUsers());
      notify('Solicitação recusada.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Erro ao recusar solicitação.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader title="Aprovações" subtitle="Revise as solicitações de acesso à plataforma." />
      <DataTable
        headers={['Solicitante', 'Papel solicitado', 'Status', 'Ações']}
        empty={!pendingUsers.length}
      >
        {pendingUsers.map((u) => (
          <tr key={u.id}>
            <td>
              <div className="user-cell">
                <strong>{u.name}</strong>
                <small>{u.email}</small>
              </div>
            </td>
            <td>{u.role || '—'}</td>
            <td>
              <Badge tone="amber">Pendente</Badge>
            </td>
            <td>
              <div className="row-actions">
                <button
                  className="secondary"
                  disabled={busyId === u.id}
                  onClick={() => void handleReject(u.id)}
                >
                  Recusar
                </button>
                <button
                  className="primary"
                  disabled={busyId === u.id}
                  onClick={() => void handleApprove(u.id)}
                >
                  <Check size={15} />
                  Aprovar
                </button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}