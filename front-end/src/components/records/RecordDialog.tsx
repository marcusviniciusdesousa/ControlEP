import { Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useControl } from '../../contexts/ControlContext';
import { useNotification } from '../../contexts/NotificationContext';
import {
  createEmployee,
  createEquipment,
  createEquipmentUse,
  createRole,
  errorMessage,
  optionalNumber,
  updateEmployee,
  updateEquipment,
  updateEquipmentUse,
  updateRole,
} from '../../services/api';
import { parseRecord } from '../../services/records';
import type { RecordDialogState } from '../../types/models';
import { Modal } from '../ui/Modal';
import { EquipmentHistory } from './EquipmentHistory';
import { RecordFields } from './RecordFields';

const labels = {
  employee: 'funcionário',
  equipment: 'equipamento',
  usage: 'uso de equipamento',
  role: 'papel',
};

/** datetime-local (horário local) -> ISO com fuso, para o back-end gravar o instante correto. */
const toIso = (value: string) => (value ? new Date(value).toISOString() : null);

export function RecordDialog({
  record,
  onClose,
  onSaved,
}: {
  record: NonNullable<RecordDialogState>;
  onClose: () => void;
  onSaved: (kind: NonNullable<RecordDialogState>['kind']) => void;
}) {
  const { reloadEmployees, reloadEquipment, reloadRoles } = useControl();
  const { notify } = useNotification();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (record.kind === 'history')
    return (
      <Modal title="Histórico do equipamento" subtitle={record.row?.name} onClose={onClose}>
        {record.row && <EquipmentHistory equipment={record.row} />}
      </Modal>
    );

  const kind = record.kind;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setError('');
    setSaving(true);

    try {
      const parsed = parseRecord(kind, new FormData(event.currentTarget), record.row);

      switch (parsed.kind) {
        case 'employee': {
          const emp = parsed.value;
          const payload = {
            name: emp.name,
            id_position: Number(emp.positionId),
            code_employee: emp.number || null,
            login_main_system: emp.jms || null,
            id_sector: optionalNumber(emp.sectorId),
            id_shift: Number(emp.shiftId),
            date_admission: emp.admission,
            // O status é enviado nos dois sentidos (ativo <-> inativo)
            status_active: emp.active,
          };
          if (emp.id) await updateEmployee({ ...payload, id: emp.id });
          else await createEmployee(payload);
          await reloadEmployees();
          break;
        }
        case 'role': {
          const role = parsed.value;
          if (role.id) {
            const previous = record.row?.permissionIds?.split(',').filter(Boolean) ?? [];
            await updateRole(role.id, role.name, previous, role.permissionIds);
          } else {
            await createRole(role.name, role.permissionIds);
          }
          await reloadRoles();
          break;
        }
        case 'equipment': {
          const eq = parsed.value;
          const payload = {
            name: eq.name,
            id_equipment_type: Number(eq.typeId),
            heritage_code: eq.serial,
            id_sector: optionalNumber(record.row?.sectorId),
            observation: record.row?.observation || null,
            // Ausente quando o campo está bloqueado (equipamento em uso)
            ...(eq.statusId ? { id_equipment_status: Number(eq.statusId) } : {}),
          };
          if (eq.id) {
            await updateEquipment({ ...payload, id: eq.id });
          } else {
            if (!eq.statusId) throw new Error('Selecione o status do equipamento.');
            await createEquipment({ ...payload, id_equipment_status: Number(eq.statusId) });
          }
          await reloadEquipment();
          break;
        }
        case 'usage': {
          const use = parsed.value;
          const payload = {
            id_equipment: Number(use.equipmentId),
            id_employee: Number(use.employeeId),
            date_start: toIso(use.start) as string,
            date_return: toIso(use.end),
            observation: use.note || null,
          };
          if (use.id) await updateEquipmentUse(use.id, payload);
          else await createEquipmentUse(payload);
          // O status do equipamento muda junto com o empréstimo
          await reloadEquipment();
          break;
        }
      }

      onSaved(kind);
      onClose();
      notify('Registro salvo com sucesso.');
    } catch (cause) {
      setError(errorMessage(cause, 'Não foi possível salvar o registro.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`${record.row ? 'Editar' : 'Novo registro de'} ${labels[kind]}`}
      subtitle="Preencha as informações abaixo para continuar."
      onClose={onClose}
    >
      <form onSubmit={(event) => void save(event)}>
        <div className="form-grid">
          <RecordFields kind={kind} row={record.row} />
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button className="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="primary" type="submit" disabled={saving} aria-busy={saving}>
            <Check size={16} />
            {saving ? 'Salvando...' : 'Salvar registro'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
