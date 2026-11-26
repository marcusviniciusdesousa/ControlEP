/** Campos serializáveis dos formulários e registros. */
export type Row = Record<string, string>;

export type RecordKind = 'employee' | 'equipment' | 'usage' | 'role';
export type RecordDialogState = { kind: RecordKind | 'history'; row?: Row } | null;
export type DeleteTarget = { kind: RecordKind; id: string; label?: string } | null;
/** Chave employeeId|AAAA-MM-DD -> nome do status de presença (como cadastrado no banco). */
export type AttendanceMap = Record<string, string>;
export type BadgeTone = 'green' | 'red' | 'amber' | 'neutral';

export interface Employee extends Row {
  id: string;
  name: string;
  number: string;
  role: string;
  roleId: string;
  sector: string;
  sectorId: string;
  jms: string;
  status: string;
  shift: string;
  shiftId: string;
  /** Dias da semana do turno, separados por vírgula (0 = domingo). */
  shiftDays: string;
  /** Data de admissão/início (AAAA-MM-DD). */
  admission: string;
}

export interface Equipment extends Row {
  id: string;
  name: string;
  type: string;
  typeId: string;
  serial: string;
  status: string;
  statusId: string;
  sectorId: string;
  observation: string;
  /** Empréstimo em aberto (vazio quando disponível). */
  openUseId: string;
  openUseEmployee: string;
  openUseStart: string;
}

export interface EquipmentUsage extends Row {
  id: string;
  equipmentId: string;
  equipment: string;
  employeeId: string;
  employee: string;
  start: string;
  end: string;
  note: string;
}

export interface Role extends Row {
  id: string;
  name: string;
  permissions: string;
}

export type UserStatus = 'Pendente' | 'Ativo' | 'Inativo' | 'Rejeitado';

export interface User extends Row {
  id: string;
  name: string;
  email: string;
  role: string;
  roleId: string;
  status: UserStatus;
  registeredAt: string;
}

export interface Operation extends Row {
  name: string;
  unit: string;
  email: string;
}

export interface LookupItem {
  id: string;
  name: string;
}

export interface Lookups {
  positions: LookupItem[];
  sectors: LookupItem[];
  equipmentTypes: LookupItem[];
  equipmentStatuses: LookupItem[];
  attendanceStatuses: LookupItem[];
}
