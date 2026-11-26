import { Check } from 'lucide-react';
import { useState } from 'react';
import { useControl } from '../../contexts/ControlContext';
import { useNotification } from '../../contexts/NotificationContext';
import { approveUser, errorMessage, rejectUser } from '../../services/api';
import type { User } from '../../types/models';
import { isMasterRole } from '../../utils/roles';

/** Escolha do papel + aprovar/recusar, compartilhado entre Usuários e Aprovações. */
export function ApprovalControls({ user }: { user: User }) {
  const { roles, users, reloadUsers } = useControl();
  const masterTaken = users.some((u) => u.id !== user.id && isMasterRole(u.role));
  const { notify } = useNotification();
  const [roleId, setRoleId] = useState(isMasterRole(user.role) ? '' : user.roleId);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>, success: string, failure: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      await reloadUsers();
      notify(success);
    } catch (err) {
      notify(errorMessage(err, failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="approval-actions">
      <select
        aria-label={`Papel de ${user.name}`}
        value={roleId}
        disabled={busy}
        onChange={(e) => setRoleId(e.target.value)}
      >
        <option value="">Selecione o papel...</option>
        {roles.map((r) => {
          // O sistema permite apenas um Master
          const taken = isMasterRole(r.name) && masterTaken;
          return (
            <option key={r.id} value={r.id} disabled={taken}>
              {r.name}
              {taken ? ' (já atribuído)' : ''}
            </option>
          );
        })}
      </select>
      {user.status === 'Pendente' && (
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            void run(
              () => rejectUser(user.id),
              'Solicitação recusada.',
              'Erro ao recusar solicitação.',
            )
          }
        >
          Recusar
        </button>
      )}
      <button
        className="primary"
        disabled={busy || !roleId}
        title={!roleId ? 'Selecione o papel antes de aprovar' : undefined}
        onClick={() =>
          void run(
            () => approveUser(user.id, roleId),
            'Usuário aprovado.',
            'Erro ao aprovar usuário.',
          )
        }
      >
        <Check size={15} />
        Aprovar
      </button>
    </div>
  );
}
