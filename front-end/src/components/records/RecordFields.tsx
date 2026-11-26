import { useEffect, useState } from 'react';
import { useControl } from '../../contexts/ControlContext';
import {
  fetchAllPermissions,
  fetchShifts,
  type PermissionItem,
  type ShiftItem,
} from '../../services/api';
import type { RecordKind, Row } from '../../types/models';
import { toDateTimeInput } from '../../utils/dates';
import { FormField } from '../forms/FormField';

const DEFAULT_PERMISSIONS = [
  'Presença',
  'Marcar presença',
  'Funcionários',
  'Equipamentos',
  'Uso de Equipamentos',
  'Aprovações',
  'Gestão',
  'Usuários',
];

/** Campos por entidade integrados com turnos e permissões da API. */
export function RecordFields({ kind, row }: { kind: RecordKind; row?: Row }) {
  const { employees, equipment } = useControl();
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);

  useEffect(() => {
    if (kind === 'employee') {
      fetchShifts()
        .then(setShifts)
        .catch(() => {});
    }
    if (kind === 'role') {
      fetchAllPermissions()
        .then(setPermissions)
        .catch(() => {});
    }
  }, [kind]);

  const field = (
    name: string,
    label: string,
    options?: string[],
    type = 'text',
    required = true,
    defaultValue?: string,
  ) => (
    <FormField
      key={name}
      name={name}
      label={label}
      options={options}
      type={type}
      value={
        type === 'datetime-local'
          ? toDateTimeInput(row?.[name] || '')
          : (defaultValue ?? row?.[name])
      }
      required={required}
    />
  );

  switch (kind) {
    case 'employee': {
      const shiftOptions =
        shifts.length > 0
          ? shifts.map((s) => `${s.id} - ${s.name}`)
          : ['1 - Manhã', '2 - Tarde', '3 - Noite'];
      const currentShift =
        row?.shiftId && shifts.length > 0
          ? `${row.shiftId} - ${shifts.find((s) => s.id === row.shiftId)?.name ?? row.shift}`
          : row?.shift;

      return (
        <>
          {field('name', 'Nome completo')}
          {field('number', 'Número / Matrícula', undefined, 'text', false)}
          {field('role', 'Cargo (ID ou nome)', undefined, 'text', true, row?.roleId || row?.role)}
          {field('sector', 'Setor (ID ou nome)', undefined, 'text', false, row?.sectorId || row?.sector)}
          {field('jms', 'Usuário JMS', undefined, 'text', false)}
          {field('shift', 'Turno', shiftOptions, 'text', true, currentShift)}
          {field('status', 'Status', ['Ativo', 'Inativo'])}
        </>
      );
    }
    case 'equipment':
      return (
        <>
          {field('name', 'Nome')}
          {field('type', 'Tipo', ['PDA', 'Notebook', 'Rádio', 'Tablet', 'Celular', 'Outro'])}
          {field('serial', 'Código patrimonial', undefined, 'text', true)}
          {field('status', 'Status', ['Ativo', 'Inativo', 'Manutenção'])}
        </>
      );
    case 'usage': {
      const options = (values: string[], current?: string) =>
        Array.from(new Set([...values, ...(current ? [current] : [])]));
      return (
        <>
          {field(
            'equipment',
            'Equipamento',
            options(
              equipment.map((item) => item.name + ' · ' + item.serial),
              row?.equipment,
            ),
          )}
          {field(
            'employee',
            'Funcionário',
            options(
              employees.map((item) => item.name),
              row?.employee,
            ),
          )}
          {field('start', 'Início', undefined, 'datetime-local')}
          {field('end', 'Devolução (opcional)', undefined, 'datetime-local', false)}
          {field('note', 'Observação', undefined, 'text', false)}
        </>
      );
    }
    case 'role': {
      const selectedNames = row?.permissions.split(',').map((v) => v.trim().toLowerCase()) || [];
      const selectedIds = row?.permissionIds?.split(',').map((v) => v.trim()) || [];
      const items =
        permissions.length > 0
          ? permissions
          : DEFAULT_PERMISSIONS.map((name, idx) => ({ id: String(idx + 1), name }));

      return (
        <>
          {field('name', 'Nome do papel')}
          <fieldset>
            <legend>Permissões</legend>
            {items.map((permission) => (
              <label className="checkbox-label" key={permission.id}>
                <input
                  type="checkbox"
                  name="permission"
                  value={permission.id}
                  defaultChecked={
                    selectedIds.includes(permission.id) ||
                    selectedNames.includes(permission.name.toLowerCase())
                  }
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