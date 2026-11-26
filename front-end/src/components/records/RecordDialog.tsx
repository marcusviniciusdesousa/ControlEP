import { Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useControl } from '../../contexts/ControlContext';
import { useNotification } from '../../contexts/NotificationContext';
import {
  ApiError,
  createEmployee,
  createEquipment,
  createRole,
  deactivateEmployee,
  fetchEmployees,
  fetchEquipment,
  fetchRolesWithPermissions,
  fetchShifts,
  parseNumericId,
  resolveEquipmentStatusId,
  resolveEquipmentTypeId,
  updateEmployee,
  updateEquipment,
  updateEquipmentStatus,
  updateRole,
} from '../../services/api';
import { parseRecord, upsertRecord } from '../../services/records';
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

export function RecordDialog({
  record,
  onClose,
}: {
  record: NonNullable<RecordDialogState>;
  onClose: () => void;
}) {
  const { setEmployees, setEquipment, setUsage, setRoles, currentUser } = useControl();
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
            id_position: parseNumericId(emp.role, 1),
            code_employee: emp.number || null,
            login_main_system: emp.jms || null,
            id_sector: emp.sector ? parseNumericId(emp.sector, 0) || null : null,
            id_shift: parseNumericId(emp.shift, 1),
          };

          if (record.row?.id) {
            await updateEmployee({ ...payload, id: record.row.id });
            if (record.row.status !== emp.status && emp.status === 'Inativo') {
              await deactivateEmployee(record.row.id, currentUser?.id);
            }
          } else {
            const created = await createEmployee(payload);
            if (emp.status === 'Inativo' && created.id) {
              await deactivateEmployee(created.id, currentUser?.id);
            }
          }

          const shifts = await fetchShifts().catch(() => []);
          setEmployees(await fetchEmployees(shifts));
          break;
        }
        case 'role': {
          const role = parsed.value;
          const nextPermissionIds = role.permissionIds
            ? role.permissionIds.split(',').filter(Boolean)
            : [];

          if (record.row?.id) {
            const previousPermissionIds = record.row.permissionIds
              ? record.row.permissionIds.split(',').filter(Boolean)
              : [];
            await updateRole(record.row.id, role.name, previousPermissionIds, nextPermissionIds);
          } else {
            await createRole(role.name, nextPermissionIds);
          }

          setRoles(await fetchRolesWithPermissions());
          break;
        }
        case 'equipment': {
          const eq = parsed.value;
          if (!eq.serial) {
            throw new Error('Preencha o código patrimonial do equipamento.');
          }
          const typeId = resolveEquipmentTypeId(eq.type);
          const statusId = resolveEquipmentStatusId(eq.status);

          if (record.row?.id) {
            await updateEquipment({
              id: record.row.id,
              name: eq.name,
              id_equipment_type: typeId,
              heritage_code: eq.serial,
              id_sector: record.row.sectorId ? Number(record.row.sectorId) : null,
              observation: record.row.observation || null,
            });
            if (record.row.status !== eq.status) {
              await updateEquipmentStatus(record.row.id, statusId).catch(() => {});
            }
          } else {
            await createEquipment({
              name: eq.name,
              id_equipment_type: typeId,
              id_equipment_status: statusId,
              heritage_code: eq.serial,
              id_sector: null,
              observation: null,
            });
          }

          setEquipment(await fetchEquipment());
          break;
        }
        case 'usage':
          setUsage((rows) => upsertRecord(rows, parsed.value));
          break;
      }

      onClose();
      notify('Registro salvo com sucesso.');
    } catch (cause) {
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : 'Não foi possível salvar o registro.',
      );
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