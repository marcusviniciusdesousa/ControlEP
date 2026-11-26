import { useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { PageHeader } from '../components/ui/PageHeader';
import { useControl } from '../contexts/ControlContext';
import { useNotification } from '../contexts/NotificationContext';
import { ApiError, fetchUsers, toggleUserStatus, updateUser } from '../services/api';

/** Usuários e atribuição de papéis integrados ao back-end. */
export default function UsersPage() {
  const { roles, users, setUsers, currentUser } = useControl();
  const { notify } = useNotification();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleRoleChange = async (userId: string, nextRoleId: string) => {
    const target = users.find((u) => u.id === userId);
    if (!target || !nextRoleId || busyId) return;

    setBusyId(userId);
    try {
      await updateUser({
        id: target.id,
        name: target.name,
        email: target.email,
        id_role: nextRoleId,
      });
      const updated = await fetchUsers();
      setUsers(updated);
      notify('Papel atualizado com sucesso.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Erro ao atualizar papel do usuário.');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleStatus = async (userId: string) => {
    if (busyId) return;
    setBusyId(userId);
    try {
      await toggleUserStatus(userId);
      const updated = await fetchUsers();
      setUsers(updated);
      notify('Status do usuário atualizado.');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Erro ao alterar status do usuário.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader title="Usuários" subtitle="Aprove cadastros e atribua papéis de acesso." />
      <DataTable headers={['Usuário', 'Papel', 'Status', 'Ações']} empty={!users.length}>
        {users.map((u) => {
          const isProtected =
            u.role.toLowerCase().startsWith('master') ||
            u.role.toLowerCase().startsWith('supervisor') ||
            u.id === currentUser?.id;

          return (
            <tr key={u.id}>
              <td>
                <div className="user-cell">
                  <strong>{u.name}</strong>
                  <small>{u.email}</small>
                </div>
              </td>
              <td>
                {isProtected ? (
                  <span>{u.role || 'Master'}</span>
                ) : (
                  <select
                    aria-label={`Papel de ${u.name}`}
                    value={u.roleId || ''}
                    disabled={busyId === u.id}
                    onChange={(e) => void handleRoleChange(u.id, e.target.value)}
                  >
                    {!u.roleId && <option value="">{u.role || 'Selecione...'}</option>}
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                )}
              </td>
              <td>
                <Badge
                  tone={
                    u.status === 'Pendente'
                      ? 'amber'
                      : u.role.toLowerCase().startsWith('master')
                        ? 'amber'
                        : 'green'
                  }
                >
                  {u.status}
                </Badge>
              </td>
              <td>
                {!isProtected && (
                  <button
                    type="button"
                    className="ghost"
                    disabled={busyId === u.id}
                    onClick={() => void handleToggleStatus(u.id)}
                  >
                    {u.status === 'Ativo' ? 'Desativar' : 'Aprovar'}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </DataTable>
    </>
  );
}