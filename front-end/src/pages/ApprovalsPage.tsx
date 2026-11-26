import { useEffect } from 'react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { ApprovalControls } from '../components/users/ApprovalControls';
import { useControl } from '../contexts/ControlContext';
import { formatDate } from '../utils/dates';

/** Solicitações pendentes de acesso: o administrador escolhe o papel e aprova ou recusa. */
export default function ApprovalsPage() {
  const { users, reloadUsers } = useControl();
  const pendingUsers = users.filter((u) => u.status === 'Pendente');

  // Sempre busca a lista atual ao abrir a tela (novos cadastros chegam a qualquer momento)
  useEffect(() => {
    void reloadUsers().catch(() => {});
  }, [reloadUsers]);

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
                <small>
                  {u.email}
                  {u.registeredAt ? ` · ${formatDate(u.registeredAt)}` : ''}
                </small>
              </div>
            </td>
            <td>{u.role || '—'}</td>
            <td>
              <Badge tone="amber">Pendente</Badge>
            </td>
            <td>
              <ApprovalControls user={u} />
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
