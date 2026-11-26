import { TriangleAlert, UserCheck, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { ApprovalControls } from '../components/users/ApprovalControls';
import { useControl } from '../contexts/ControlContext';
import { useNotification } from '../contexts/NotificationContext';
import { usePersistentState } from '../hooks/usePersistentState';
import { errorMessage, setUserStatus, updateUser } from '../services/api';
import type { BadgeTone, User, UserStatus } from '../types/models';
import { isMasterRole } from '../utils/roles';

const statusTone: Record<UserStatus, BadgeTone> = {
  Pendente: 'amber',
  Ativo: 'green',
  Inativo: 'neutral',
  Rejeitado: 'red',
};

/** Usuários: aprovação de cadastros, atribuição de papéis e ativação/desativação. */
export default function UsersPage() {
  const { roles, users, reloadUsers, currentUser } = useControl();
  const { notify } = useNotification();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = usePersistentState<'Todos' | UserStatus>('users:filter', 'Todos');
  const [toDeactivate, setToDeactivate] = useState<User | null>(null);

  useEffect(() => {
    void reloadUsers().catch(() => {});
  }, [reloadUsers]);

  const visibleUsers = users.filter((u) => filter === 'Todos' || u.status === filter);
  const pendingCount = users.filter((u) => u.status === 'Pendente').length;
  const masters = users.filter((u) => isMasterRole(u.role));
  const iAmMaster = isMasterRole(roles.find((r) => r.id === currentUser?.roleId)?.name);

  const run = async (
    userId: string,
    action: () => Promise<void>,
    success: string,
    failure: string,
  ) => {
    if (busyId) return;
    setBusyId(userId);
    try {
      await action();
      await reloadUsers();
      notify(success);
    } catch (err) {
      notify(errorMessage(err, failure));
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = (u: User, roleId: string) =>
    void run(
      u.id,
      () => updateUser({ id: u.id, name: u.name, email: u.email, id_role: roleId }),
      'Papel atualizado.',
      'Erro ao atualizar papel do usuário.',
    );

  const confirmDeactivate = async () => {
    if (!toDeactivate) return;
    const target = toDeactivate;
    setToDeactivate(null);
    await run(
      target.id,
      () => setUserStatus(target.id, false),
      'Usuário desativado.',
      'Erro ao desativar usuário.',
    );
  };

  return (
    <>
      <PageHeader title="Usuários" subtitle="Aprove cadastros e atribua papéis de acesso." />
      {masters.length > 1 && (
        <div className="notice warning" role="alert">
          <TriangleAlert size={16} />
          <span>
            Existem {masters.length} usuários com o papel Master (
            {masters.map((m) => m.name).join(', ')}). O sistema permite apenas um: altere o papel
            dos demais.
          </span>
        </div>
      )}
      <div className="list-toolbar">
        <span>
          {users.length} usuários
          {pendingCount > 0 && ` · ${pendingCount} aguardando aprovação`}
        </span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          aria-label="Filtrar por status"
        >
          {['Todos', 'Pendente', 'Ativo', 'Inativo', 'Rejeitado'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <DataTable headers={['Usuário', 'Papel', 'Status', 'Ações']} empty={!visibleUsers.length}>
        {visibleUsers.map((u) => {
          const isSelf = u.id === currentUser?.id;
          const awaitingDecision = u.status === 'Pendente' || u.status === 'Rejeitado';
          // Só o Master altera outro Master
          const locked = isSelf || (isMasterRole(u.role) && !iAmMaster);

          return (
            <tr key={u.id}>
              <td>
                <div className="user-cell">
                  <strong>
                    {u.name}
                    {isSelf && ' (você)'}
                  </strong>
                  <small>{u.email}</small>
                </div>
              </td>
              <td>
                {awaitingDecision || locked ? (
                  <span>{u.role || '—'}</span>
                ) : (
                  <select
                    aria-label={`Papel de ${u.name}`}
                    value={u.roleId}
                    disabled={busyId === u.id}
                    onChange={(e) => changeRole(u, e.target.value)}
                  >
                    {roles.map((r) => {
                      const taken = isMasterRole(r.name) && masters.some((m) => m.id !== u.id);
                      return (
                        <option key={r.id} value={r.id} disabled={taken}>
                          {r.name}
                          {taken ? ' (já atribuído)' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </td>
              <td>
                <Badge tone={statusTone[u.status]}>{u.status}</Badge>
              </td>
              <td>
                {awaitingDecision ? (
                  <ApprovalControls user={u} />
                ) : (
                  !locked &&
                  (u.status === 'Ativo' ? (
                    <button
                      type="button"
                      className="status-action deactivate"
                      disabled={busyId === u.id}
                      onClick={() => setToDeactivate(u)}
                    >
                      <UserX size={14} />
                      Desativar
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="status-action activate"
                      disabled={busyId === u.id}
                      onClick={() =>
                        void run(
                          u.id,
                          () => setUserStatus(u.id, true),
                          'Usuário ativado.',
                          'Erro ao ativar usuário.',
                        )
                      }
                    >
                      <UserCheck size={14} />
                      {busyId === u.id ? 'Ativando...' : 'Ativar'}
                    </button>
                  ))
                )}
              </td>
            </tr>
          );
        })}
      </DataTable>

      {toDeactivate && (
        <Modal
          title={`Desativar ${toDeactivate.name}?`}
          onClose={() => setToDeactivate(null)}
          className="confirm"
          alert
        >
          <span className="delete-symbol">
            <UserX size={24} />
          </span>
          <p>
            O acesso será bloqueado imediatamente e as sessões abertas deste usuário serão
            encerradas. Você pode reativá-lo a qualquer momento.
          </p>
          <div className="modal-footer">
            <button className="secondary" onClick={() => setToDeactivate(null)}>
              Cancelar
            </button>
            <button className="primary" onClick={() => void confirmDeactivate()}>
              Desativar usuário
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
