import { useEffect, useState } from 'react';
import { useControl } from '../../contexts/ControlContext';
import { fetchAllPermissions, type PermissionItem } from '../../services/api';
import type { LookupItem, RecordKind, Row } from '../../types/models';
import { localDate, toDateTimeInput } from '../../utils/dates';
import { describeDays } from '../../utils/weekdays';
import { FormField, type FieldOption } from '../forms/FormField';

const IN_USE = 'Em uso';

const toOptions = (items: LookupItem[]): FieldOption[] =>
  items.map((item) => ({ value: item.id, label: item.name }));

/** Garante que o valor atual apareça mesmo que não esteja mais na lista. */
const withCurrent = (options: FieldOption[], value?: string, label?: string): FieldOption[] =>
  value && !options.some((o) => (typeof o === 'string' ? o : o.value) === value)
    ? [...options, { value, label: label || `#${value}` }]
    : options;

/** Campos de cada entidade, alimentados pelas tabelas de referência do banco. */
export function RecordFields({ kind, row }: { kind: RecordKind; row?: Row }) {
  const { employees, equipment, shifts, lookups } = useControl();
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [permissionsError, setPermissionsError] = useState('');

  useEffect(() => {
    if (kind !== 'role') return;
    fetchAllPermissions()
      .then(setPermissions)
      .catch(() => setPermissionsError('Não foi possível carregar as permissões.'));
  }, [kind]);

  switch (kind) {
    case 'employee': {
      const shiftOptions = shifts.map((s) => ({
        value: s.id,
        label: `${s.name} (${s.hourStart}–${s.hourEnd}, ${describeDays(s.days)})`,
      }));
      return (
        <>
          <FormField name="name" label="Nome completo" value={row?.name} />
          <FormField
            name="number"
            label="Número / Matrícula"
            value={row?.number}
            required={false}
          />
          <FormField
            name="positionId"
            label="Cargo"
            options={withCurrent(toOptions(lookups.positions), row?.roleId, row?.role)}
            placeholder="Selecione..."
            value={row?.roleId}
          />
          <FormField
            name="sectorId"
            label="Setor"
            options={withCurrent(toOptions(lookups.sectors), row?.sectorId, row?.sector)}
            placeholder="Sem setor"
            value={row?.sectorId}
            required={false}
          />
          <FormField name="jms" label="Usuário JMS" value={row?.jms} required={false} />
          <FormField
            name="shiftId"
            label="Turno"
            options={withCurrent(shiftOptions, row?.shiftId, row?.shift)}
            placeholder="Selecione..."
            value={row?.shiftId}
          />
          <FormField
            name="admission"
            label="Data de admissão / início"
            type="date"
            value={row?.admission || (row ? '' : localDate())}
            hint="Não é possível registrar presença antes desta data."
          />
          <FormField
            name="status"
            label="Status"
            options={['Ativo', 'Inativo']}
            value={row?.status}
          />
        </>
      );
    }
    case 'equipment': {
      const inUse = Boolean(row?.openUseId) || row?.status === IN_USE;
      const statusOptions = lookups.equipmentStatuses
        .filter((s) => s.name !== IN_USE || inUse)
        .map((s) => ({ value: s.id, label: s.name }));
      return (
        <>
          <FormField name="name" label="Nome" value={row?.name} />
          <FormField
            name="typeId"
            label="Tipo"
            options={withCurrent(toOptions(lookups.equipmentTypes), row?.typeId, row?.type)}
            placeholder="Selecione..."
            value={row?.typeId}
          />
          <FormField name="serial" label="Código patrimonial" value={row?.serial} />
          <FormField
            name="statusId"
            label="Status"
            options={statusOptions}
            value={
              row?.statusId || lookups.equipmentStatuses.find((s) => s.name === 'Disponível')?.id
            }
            disabled={inUse}
            hint={
              inUse
                ? `Em uso por ${row?.openUseEmployee || 'um funcionário'}. Registre a devolução em Uso de Equipamentos para alterar o status.`
                : '"Em uso" é definido automaticamente ao registrar um empréstimo.'
            }
          />
        </>
      );
    }
    case 'usage': {
      // Novo empréstimo: apenas equipamentos livres e funcionários ativos
      const equipmentOptions = withCurrent(
        equipment
          .filter((e) => Boolean(row) || !e.openUseId)
          .map((e) => ({
            value: e.id,
            label: `${e.name} · ${e.serial}${e.openUseId && e.id !== row?.equipmentId ? ' (em uso)' : ''}`,
          })),
        row?.equipmentId,
        row?.equipment,
      );
      const employeeOptions = withCurrent(
        employees
          .filter((e) => e.status === 'Ativo' || e.id === row?.employeeId)
          .map((e) => ({ value: e.id, label: e.name })),
        row?.employeeId,
        row?.employee,
      );
      return (
        <>
          <FormField
            name="equipmentId"
            label="Equipamento"
            options={equipmentOptions}
            placeholder="Selecione..."
            value={row?.equipmentId}
          />
          <FormField
            name="employeeId"
            label="Funcionário"
            options={employeeOptions}
            placeholder="Selecione..."
            value={row?.employeeId}
          />
          <FormField
            name="start"
            label="Início"
            type="datetime-local"
            value={toDateTimeInput(row?.start || new Date().toISOString())}
          />
          <FormField
            name="end"
            label="Devolução (opcional)"
            type="datetime-local"
            value={toDateTimeInput(row?.end || '')}
            required={false}
          />
          <FormField name="note" label="Observação" value={row?.note} required={false} />
        </>
      );
    }
    case 'role': {
      const selectedIds = row?.permissionIds?.split(',').map((v) => v.trim()) || [];
      return (
        <>
          <FormField name="name" label="Nome do papel" value={row?.name} />
          <fieldset>
            <legend>Permissões</legend>
            {permissionsError && <p className="form-error">{permissionsError}</p>}
            {permissions.map((permission) => (
              <label className="checkbox-label" key={permission.id}>
                <input
                  type="checkbox"
                  name="permission"
                  value={permission.id}
                  defaultChecked={selectedIds.includes(permission.id)}
                />
                {permission.name}
              </label>
            ))}
          </fieldset>
        </>
      );
    }
  }
}
