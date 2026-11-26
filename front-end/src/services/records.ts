import type { RecordKind, Row } from '../types/models';

export interface EmployeeForm {
  id?: string;
  name: string;
  number: string;
  positionId: string;
  sectorId: string;
  jms: string;
  shiftId: string;
  admission: string;
  active: boolean;
}

export interface EquipmentForm {
  id?: string;
  name: string;
  typeId: string;
  serial: string;
  statusId: string;
}

export interface UsageForm {
  id?: string;
  equipmentId: string;
  employeeId: string;
  start: string;
  end: string;
  note: string;
}

export interface RoleForm {
  id?: string;
  name: string;
  permissionIds: string[];
}

export type ParsedRecord =
  | { kind: 'employee'; value: EmployeeForm }
  | { kind: 'equipment'; value: EquipmentForm }
  | { kind: 'usage'; value: UsageForm }
  | { kind: 'role'; value: RoleForm };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Converte FormData em dados tipados e valida os campos obrigatórios (sem persistir). */
export function parseRecord(kind: RecordKind, data: FormData, previous?: Row): ParsedRecord {
  const read = (key: string) => String(data.get(key) ?? '').trim();
  const required = (key: string, label: string) => {
    const value = read(key);
    if (!value) throw new Error(`Preencha o campo ${label}.`);
    return value;
  };
  const id = previous?.id || undefined;

  switch (kind) {
    case 'employee': {
      const admission = required('admission', 'data de admissão');
      if (!DATE_RE.test(admission)) throw new Error('Informe uma data de admissão válida.');
      return {
        kind,
        value: {
          id,
          name: required('name', 'nome'),
          number: read('number'),
          positionId: required('positionId', 'cargo'),
          sectorId: read('sectorId'),
          jms: read('jms'),
          shiftId: required('shiftId', 'turno'),
          admission,
          active: required('status', 'status') === 'Ativo',
        },
      };
    }
    case 'equipment':
      return {
        kind,
        value: {
          id,
          name: required('name', 'nome'),
          typeId: required('typeId', 'tipo'),
          serial: required('serial', 'código patrimonial'),
          // O status fica bloqueado (campo desabilitado) enquanto o equipamento está em uso
          statusId: read('statusId'),
        },
      };
    case 'usage': {
      const start = required('start', 'início');
      const end = read('end');
      if (Number.isNaN(new Date(start).getTime()) || (end && Number.isNaN(new Date(end).getTime())))
        throw new Error('Informe datas válidas para o empréstimo.');
      if (end && new Date(end) < new Date(start))
        throw new Error('A devolução deve ser posterior ao início.');
      return {
        kind,
        value: {
          id,
          equipmentId: required('equipmentId', 'equipamento'),
          employeeId: required('employeeId', 'funcionário'),
          start,
          end,
          note: read('note'),
        },
      };
    }
    case 'role':
      return {
        kind,
        value: {
          id,
          name: required('name', 'nome do papel'),
          permissionIds: data.getAll('permission').map(String),
        },
      };
  }
}

/** Atualiza pelo identificador, preservando a posição; novos registros são adicionados ao fim. */
export function upsertRecord<T extends { id: string }>(rows: T[], record: T): T[] {
  return rows.some((row) => row.id === record.id)
    ? rows.map((row) => (row.id === record.id ? record : row))
    : [...rows, record];
}
