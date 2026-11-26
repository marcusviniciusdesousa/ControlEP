import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useControl } from '../../contexts/ControlContext';
import { useNotification } from '../../contexts/NotificationContext';
import {
  ApiError,
  deleteEmployee,
  deleteRole,
  fetchEmployees,
  fetchRolesWithPermissions,
  fetchShifts,
} from '../../services/api';
import type { DeleteTarget } from '../../types/models';
import { Modal } from '../ui/Modal';

export function DeleteRecordDialog({
  target,
  onClose,
}: {
  target: NonNullable<DeleteTarget>;
  onClose: () => void;
}) {
  const { setEmployees, setUsage, setRoles } = useControl();
  const { notify } = useNotification();
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);

    try {
      switch (target.kind) {
        case 'employee': {
          await deleteEmployee(target.id);
          const shifts = await fetchShifts().catch(() => []);
          setEmployees(await fetchEmployees(shifts));
          notify('Funcionário excluído.');
          break;
        }
        case 'role': {
          await deleteRole(target.id);
          setRoles(await fetchRolesWithPermissions());
          notify('Papel excluído.');
          break;
        }
        case 'equipment':
          notify('Equipamentos não podem ser excluídos permanentemente. Altere o status para Inativo ao editar.');
          break;
        case 'usage':
          setUsage((rows) => rows.filter((row) => row.id !== target.id));
          notify('Registro de uso excluído.');
          break;
      }
      onClose();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Não foi possível excluir o registro.');
      setDeleting(false);
    }
  };

  return (
    <Modal title="Excluir este registro?" onClose={onClose} className="confirm" alert>
      <span className="delete-symbol">
        <Trash2 size={24} />
      </span>
      <p>Esta ação removerá o registro permanentemente do sistema.</p>
      <div className="modal-footer">
        <button className="secondary" onClick={onClose} disabled={deleting}>
          Cancelar
        </button>
        <button className="primary" onClick={() => void remove()} disabled={deleting}>
          {deleting ? 'Excluindo...' : 'Excluir registro'}
        </button>
      </div>
    </Modal>
  );
}