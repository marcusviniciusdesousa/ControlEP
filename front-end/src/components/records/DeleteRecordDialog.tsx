import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useControl } from '../../contexts/ControlContext';
import { useNotification } from '../../contexts/NotificationContext';
import {
  deleteEmployee,
  deleteEquipment,
  deleteEquipmentUse,
  deleteRole,
  errorMessage,
} from '../../services/api';
import type { DeleteTarget, RecordKind } from '../../types/models';
import { Modal } from '../ui/Modal';

const descriptions: Record<RecordKind, string> = {
  employee:
    'Funcionários com histórico de presença ou de uso de equipamentos não podem ser excluídos; nesse caso, altere o status para Inativo.',
  equipment:
    'Se o equipamento possuir histórico de empréstimos, ele deixará de aparecer nas listagens, mas o histórico será preservado.',
  usage:
    'O registro de uso será removido. Se o empréstimo estiver em aberto, o equipamento volta a ficar disponível.',
  role: 'Papéis atribuídos a usuários não podem ser excluídos.',
};

export function DeleteRecordDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: NonNullable<DeleteTarget>;
  onClose: () => void;
  onDeleted: (kind: RecordKind) => void;
}) {
  const { reloadEmployees, reloadEquipment, reloadRoles } = useControl();
  const { notify } = useNotification();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    setError('');

    try {
      switch (target.kind) {
        case 'employee':
          await deleteEmployee(target.id);
          await reloadEmployees();
          notify('Funcionário excluído.');
          break;
        case 'role':
          await deleteRole(target.id);
          await reloadRoles();
          notify('Papel excluído.');
          break;
        case 'equipment':
          notify(await deleteEquipment(target.id));
          await reloadEquipment();
          break;
        case 'usage':
          await deleteEquipmentUse(target.id);
          await reloadEquipment();
          notify('Registro de uso excluído.');
          break;
      }
      onDeleted(target.kind);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível excluir o registro.'));
      setDeleting(false);
    }
  };

  return (
    <Modal
      title={target.label ? `Excluir "${target.label}"?` : 'Excluir este registro?'}
      onClose={onClose}
      className="confirm"
      alert
    >
      <span className="delete-symbol">
        <Trash2 size={24} />
      </span>
      <p>{descriptions[target.kind]}</p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
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
