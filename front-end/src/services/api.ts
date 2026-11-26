/**
 * src/services/api.ts
 *
 * Cliente HTTP do Control EP (React + Vite) para o back-end Node/Express.
 * A autenticação usa cookies httpOnly (accessToken/refreshToken) definidos pela API.
 */
import { env } from '../config/env';
import type {
  Employee,
  Equipment,
  EquipmentUsage,
  LookupItem,
  Lookups,
  Role,
  User,
  UserStatus,
} from '../types/models';

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export const ENDPOINTS = {
  login: '/auth',
  register: '/register',
  refresh: '/refresh',
  refreshUser: '/refreshUser',
  logout: '/logout',
  passwordReset: '/password-reset',
  users: '/users',
  employees: '/employees',
  roles: '/roles',
  permissions: '/permissions',
  shifts: '/shifts',
  equipments: '/equipments',
  equipmentUses: '/equipment-uses',
  presence: '/presence',
  dashboard: '/dashboard',
  lookups: '/lookups',
} as const;

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface SessionUser {
  id: string;
  name: string;
  roleId: string;
  permissions: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  roleId: string | number;
}

export interface RegisterResult {
  pending: true;
  message: string;
}

export interface PermissionItem {
  id: string;
  name: string;
}

export interface ShiftItem {
  id: string;
  name: string;
  hourStart: string;
  hourEnd: string;
  days: number[];
}

export interface EmployeePayload {
  id?: string | number;
  name: string;
  id_position: number;
  code_employee: string | null;
  login_main_system: string | null;
  id_sector: number | null;
  id_shift: number;
  date_admission: string;
  status_active: boolean;
}

export interface EquipmentPayload {
  id?: string | number;
  name: string;
  id_equipment_type: number;
  id_equipment_status?: number;
  heritage_code: string;
  id_sector: number | null;
  observation: string | null;
}

export interface EquipmentUsePayload {
  id_equipment: number;
  id_employee: number;
  date_start: string;
  date_return: string | null;
  observation: string | null;
}

export interface AttendanceFetchResult {
  statusByKey: Record<string, string>;
  recordIdByKey: Record<string, string>;
}

export interface DashboardData {
  period: { from: string; to: string };
  employees: { registered: number; active_now: number; inactive_now: number };
  attendance: {
    byStatus: { id: number; status: string; quantity: number }[];
    byEmployee: {
      id: number;
      name: string;
      position_name: string;
      status_active: boolean;
      date_admission: string;
      counts: Record<string, number>;
    }[];
  };
  equipment: {
    total: number;
    in_use: number;
    byStatus: { id_status: number; status: string; quantity: number }[];
  };
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: QueryParams;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  skipAuthRefresh?: boolean;
  silent?: boolean;
}

/* ------------------------------------------------------------------ */
/* Erros                                                               */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/** Somente 401 indica sessão ausente/expirada. 403 = autenticado, mas sem permissão. */
export const isAuthStatus = (status: number): boolean => status === 401;

const DEFAULT_MESSAGES: Record<number, string> = {
  0: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
  400: 'Dados inválidos.',
  401: 'Sua sessão expirou. Entre novamente.',
  403: 'Você não tem permissão para realizar esta ação.',
  404: 'Recurso não encontrado.',
  409: 'Registro já existe ou possui vínculos ativos.',
  422: 'A operação não atende às regras de negócio.',
  500: 'Erro interno do servidor.',
};

const defaultMessage = (status: number): string => DEFAULT_MESSAGES[status] ?? `Erro ${status}.`;

function extractMessage(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const text = data.message ?? data.Message;
  return typeof text === 'string' && text.trim() ? text : null;
}

export const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof ApiError || error instanceof Error ? error.message || fallback : fallback;

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const str = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value);

const toBool = (value: unknown): boolean =>
  value === true || value === 1 || value === 't' || value === 'true';

const toLookup = (raw: unknown): LookupItem => {
  const row = isRecord(raw) ? raw : {};
  return { id: str(row.id), name: str(row.name) };
};

/** Converte "" em null e valores numéricos em number. */
export const optionalNumber = (value: string | null | undefined): number | null =>
  value === undefined || value === null || value === '' ? null : Number(value);

/* ------------------------------------------------------------------ */
/* Sessão                                                              */
/* ------------------------------------------------------------------ */

const BASE_URL = env.apiBaseUrl.replace(/\/+$/, '');

let sessionExpiredHandler: ((message: string) => void) | null = null;

export const setSessionExpiredHandler = (handler: ((message: string) => void) | null): void => {
  sessionExpiredHandler = handler;
};

/* ------------------------------------------------------------------ */
/* Camada de rede                                                      */
/* ------------------------------------------------------------------ */

function buildUrl(path: string, query?: QueryParams): string {
  let url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  if ((res.headers.get('content-type') ?? '').includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

async function execute<T>(path: string, options: RequestOptions): Promise<T> {
  const { method = 'GET', body, query, signal } = options;
  const headers = new Headers({ Accept: 'application/json', ...options.headers });

  let payload: BodyInit | undefined;
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: payload,
      credentials: 'include',
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(0, defaultMessage(0), cause);
  }

  const data = await parseBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, extractMessage(data) ?? defaultMessage(res.status), data);
  }
  return data as T;
}

/* ------------------------------------------------------------------ */
/* Renovação de sessão (/refresh)                                      */
/* ------------------------------------------------------------------ */

let refreshInFlight: Promise<boolean> | null = null;

/** Uma única renovação por vez, mesmo com várias requisições simultâneas recebendo 401. */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
  try {
    await execute(ENDPOINTS.refresh, { method: 'GET' });
    return true;
  } catch (error) {
    if (error instanceof ApiError && isAuthStatus(error.status)) return false;
    // Falha de rede/servidor: não derruba a sessão; a requisição original falha normalmente.
    throw error;
  }
}

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await execute<T>(path, options);
  } catch (error) {
    const sessionMissing = error instanceof ApiError && isAuthStatus(error.status);
    if (!sessionMissing || options.skipAuthRefresh) throw error;

    if (!(await refreshSession())) {
      const message = 'Sua sessão expirou. Entre novamente para continuar.';
      if (!options.silent) sessionExpiredHandler?.(message);
      throw new ApiError(401, message);
    }
    return execute<T>(path, options);
  }
}

export const api = {
  get: <T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ) => request<T>(path, { ...options, method: 'POST', body }),
  put: <T = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ) => request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

/* ------------------------------------------------------------------ */
/* Mappers                                                             */
/* ------------------------------------------------------------------ */

export function toLoginPayload({ email, password }: LoginCredentials) {
  return { email_usuario: email.trim().toLowerCase(), senha_usuario: password };
}

export function toRegisterPayload(input: RegisterInput) {
  return {
    nome_usuario: input.name.trim(),
    email_usuario: input.email.trim().toLowerCase(),
    senha_usuario: input.password,
    id_funcao: Number(input.roleId),
  };
}

export function mapSessionUser(raw: unknown): SessionUser | null {
  if (!isRecord(raw)) return null;
  const id = raw.userId ?? raw.id;
  const name = raw.username ?? raw.name;
  const role = raw.role ?? raw.id_role;
  if (id == null || name == null || role == null) return null;
  return {
    id: str(id),
    name: str(name),
    roleId: str(role),
    permissions: Array.isArray(raw.permissions) ? raw.permissions.map(str) : [],
  };
}

export function mapUserStatus(row: Record<string, unknown>): UserStatus {
  const approval = str(row.approval_status);
  if (approval === 'Pendente') return 'Pendente';
  if (approval === 'Rejeitado') return 'Rejeitado';
  return toBool(row.status_active) ? 'Ativo' : 'Inativo';
}

export function mapApiUser(raw: unknown): User {
  const row = isRecord(raw) ? raw : {};
  return {
    id: str(row.id),
    name: str(row.name),
    email: str(row.email),
    role: str(row.role_name),
    roleId: str(row.id_role),
    status: mapUserStatus(row),
    registeredAt: str(row.date_register),
  };
}

export function mapApiRole(raw: unknown, permissions: PermissionItem[] = []): Role {
  const row = isRecord(raw) ? raw : {};
  return {
    id: str(row.id),
    name: str(row.name),
    permissions: permissions.map((p) => p.name).join(', '),
    permissionIds: permissions.map((p) => p.id).join(','),
  };
}

export function mapApiShift(raw: unknown): ShiftItem {
  const row = isRecord(raw) ? raw : {};
  return {
    id: str(row.id),
    name: str(row.name),
    hourStart: str(row.hour_start).slice(0, 5),
    hourEnd: str(row.hour_end).slice(0, 5),
    days: Array.isArray(row.days_of_week) ? row.days_of_week.map(Number) : [0, 1, 2, 3, 4, 5, 6],
  };
}

export function mapApiEmployee(raw: unknown): Employee {
  const row = isRecord(raw) ? raw : {};
  return {
    id: str(row.id),
    name: str(row.name),
    number: str(row.code_employee),
    role: str(row.position_name),
    roleId: str(row.id_position),
    sector: str(row.sector_name),
    sectorId: str(row.id_sector),
    jms: str(row.login_main_system),
    status: toBool(row.status_active) ? 'Ativo' : 'Inativo',
    shift: str(row.shift_name),
    shiftId: str(row.id_shift),
    shiftDays: Array.isArray(row.shift_days) ? row.shift_days.join(',') : '0,1,2,3,4,5,6',
    admission: str(row.date_admission).slice(0, 10),
  };
}

export function mapApiEquipment(raw: unknown): Equipment {
  const row = isRecord(raw) ? raw : {};
  return {
    id: str(row.id),
    name: str(row.name),
    type: str(row.equipment_type),
    typeId: str(row.id_equipment_type),
    serial: str(row.heritage_code),
    status: str(row.equipment_status),
    statusId: str(row.id_equipment_status),
    sectorId: str(row.id_sector),
    observation: str(row.observation),
    openUseId: str(row.open_use_id),
    openUseEmployee: str(row.open_use_employee),
    openUseStart: str(row.open_use_start),
  };
}

export function mapApiEquipmentUse(raw: unknown): EquipmentUsage {
  const row = isRecord(raw) ? raw : {};
  const code = str(row.heritage_code);
  return {
    id: str(row.id),
    equipmentId: str(row.id_equipment),
    equipment: code ? `${str(row.equipment_name)} · ${code}` : str(row.equipment_name),
    employeeId: str(row.id_employee),
    employee: str(row.employee_name),
    start: str(row.date_start),
    end: str(row.date_return),
    note: str(row.observation),
  };
}

/* ------------------------------------------------------------------ */
/* Sessão                                                              */
/* ------------------------------------------------------------------ */

export async function fetchCurrentUser(
  options: Pick<RequestOptions, 'silent'> = {},
): Promise<SessionUser> {
  const raw = await request<unknown>(ENDPOINTS.refreshUser, { silent: options.silent });
  const user = mapSessionUser(raw);
  if (!user) throw new ApiError(500, 'Resposta inválida de /refreshUser.', raw);
  return user;
}

export async function login(credentials: LoginCredentials): Promise<SessionUser> {
  const raw = await request<unknown>(ENDPOINTS.login, {
    method: 'POST',
    body: toLoginPayload(credentials),
    skipAuthRefresh: true,
  });
  return mapSessionUser(raw) ?? fetchCurrentUser();
}

export async function register(input: RegisterInput): Promise<RegisterResult> {
  const res = await request<{ message?: string }>(ENDPOINTS.register, {
    method: 'POST',
    body: toRegisterPayload(input),
    skipAuthRefresh: true,
  });
  return {
    pending: true,
    message:
      res?.message ??
      'Cadastro enviado. Seu acesso será liberado após a aprovação de um administrador.',
  };
}

export async function logout(): Promise<void> {
  try {
    await request<void>(ENDPOINTS.logout, { skipAuthRefresh: true });
  } catch {
    // Sem rede: não impede o logout local.
  }
}

export async function restoreSession(): Promise<SessionUser | null> {
  try {
    return await fetchCurrentUser({ silent: true });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

/* Recuperação de senha (código enviado por e-mail) */

export async function requestPasswordReset(email: string): Promise<string> {
  const res = await request<{ message?: string }>(ENDPOINTS.passwordReset, {
    method: 'POST',
    body: { email_usuario: email.trim().toLowerCase() },
    skipAuthRefresh: true,
  });
  return res?.message ?? 'Se o e-mail estiver cadastrado, você receberá um código.';
}

export async function verifyPasswordResetCode(code: string): Promise<void> {
  await request(`${ENDPOINTS.passwordReset}/verify`, {
    method: 'POST',
    body: { code: code.trim() },
    skipAuthRefresh: true,
  });
}

export async function resetPassword(password: string): Promise<void> {
  await request(ENDPOINTS.passwordReset, {
    method: 'PUT',
    body: { senha_usuario: password },
    skipAuthRefresh: true,
  });
}

/* ------------------------------------------------------------------ */
/* Dados de referência                                                 */
/* ------------------------------------------------------------------ */

export const emptyLookups: Lookups = {
  positions: [],
  sectors: [],
  equipmentTypes: [],
  equipmentStatuses: [],
  attendanceStatuses: [],
};

export async function fetchLookups(): Promise<Lookups> {
  const res = await api.get<Record<string, unknown[]>>(ENDPOINTS.lookups);
  const list = (key: string) => (Array.isArray(res?.[key]) ? res[key].map(toLookup) : []);
  return {
    positions: list('positions'),
    sectors: list('sectors'),
    equipmentTypes: list('equipment_types'),
    equipmentStatuses: list('equipment_statuses'),
    attendanceStatuses: list('attendance_statuses'),
  };
}

/* ------------------------------------------------------------------ */
/* Usuários, papéis e permissões                                       */
/* ------------------------------------------------------------------ */

export async function fetchUsers(): Promise<User[]> {
  const rows = await api.get<unknown[]>(ENDPOINTS.users);
  return Array.isArray(rows) ? rows.map(mapApiUser) : [];
}

export async function updateUser(payload: {
  id: string | number;
  name: string;
  email: string;
  id_role: string | number;
}): Promise<void> {
  await api.put(ENDPOINTS.users, {
    id: Number(payload.id),
    name: payload.name.trim(),
    email: payload.email.trim(),
    id_role: Number(payload.id_role),
  });
}

export async function approveUser(id: string | number, roleId: string | number): Promise<void> {
  await api.put(`${ENDPOINTS.users}/${Number(id)}/approve`, { id_role: Number(roleId) });
}

export async function rejectUser(id: string | number): Promise<void> {
  await api.put(`${ENDPOINTS.users}/${Number(id)}/reject`);
}

export async function setUserStatus(id: string | number, active: boolean): Promise<void> {
  await api.put(`${ENDPOINTS.users}/${Number(id)}/status`, { status_active: active });
}

export async function fetchAllPermissions(): Promise<PermissionItem[]> {
  const rows = await api.get<unknown[]>(ENDPOINTS.permissions);
  return Array.isArray(rows) ? rows.map(toLookup) : [];
}

export async function fetchRolePermissions(roleId: string | number): Promise<PermissionItem[]> {
  const rows = await api.get<unknown[]>(`${ENDPOINTS.permissions}/roles/${roleId}`);
  return Array.isArray(rows) ? rows.map(toLookup) : [];
}

export async function fetchRolesWithPermissions(): Promise<Role[]> {
  const rawRoles = await api.get<unknown[]>(ENDPOINTS.roles);
  if (!Array.isArray(rawRoles)) return [];
  return Promise.all(
    rawRoles.map(async (raw) => {
      const row = isRecord(raw) ? raw : {};
      const roleId = str(row.id);
      try {
        const perms = roleId ? await fetchRolePermissions(roleId) : [];
        return mapApiRole(row, perms);
      } catch {
        // Sem permissão de "Papéis": lista apenas os nomes (usado na aprovação de usuários)
        return mapApiRole(row, []);
      }
    }),
  );
}

export async function createRole(name: string, permissionIds: string[] = []): Promise<Role> {
  const res = await api.post<{ role?: unknown }>(ENDPOINTS.roles, { name: name.trim() });
  const created = mapApiRole(res?.role ?? { name });
  if (created.id && permissionIds.length > 0) {
    await Promise.all(
      permissionIds.map((permId) =>
        api.put(`${ENDPOINTS.permissions}/${created.id}/${Number(permId)}`),
      ),
    );
  }
  return created;
}

export async function updateRole(
  id: string | number,
  name: string,
  previousPermissionIds: string[],
  nextPermissionIds: string[],
): Promise<void> {
  await api.put(ENDPOINTS.roles, { id: Number(id), name: name.trim() });

  const toAdd = nextPermissionIds.filter((pid) => !previousPermissionIds.includes(pid));
  const toRemove = previousPermissionIds.filter((pid) => !nextPermissionIds.includes(pid));

  await Promise.all([
    ...toAdd.map((pid) => api.put(`${ENDPOINTS.permissions}/${Number(id)}/${Number(pid)}`)),
    ...toRemove.map((pid) => api.delete(`${ENDPOINTS.permissions}/${Number(id)}/${Number(pid)}`)),
  ]);
}

export async function deleteRole(id: string | number): Promise<void> {
  await api.delete(`${ENDPOINTS.roles}/${Number(id)}`);
}

/* ------------------------------------------------------------------ */
/* Turnos                                                              */
/* ------------------------------------------------------------------ */

export interface ShiftInput {
  name: string;
  hour_start: string;
  hour_end: string;
  days_of_week: number[];
}

export async function fetchShifts(): Promise<ShiftItem[]> {
  const rows = await api.get<unknown[]>(ENDPOINTS.shifts);
  return Array.isArray(rows) ? rows.map(mapApiShift) : [];
}

export async function createShift(payload: ShiftInput): Promise<ShiftItem> {
  const res = await api.post<{ shift?: unknown }>(ENDPOINTS.shifts, payload);
  return mapApiShift(res?.shift);
}

export async function updateShift(
  payload: ShiftInput & { id: string | number },
): Promise<ShiftItem> {
  const res = await api.put<{ shift?: unknown }>(ENDPOINTS.shifts, {
    ...payload,
    id: Number(payload.id),
  });
  return mapApiShift(res?.shift);
}

export async function deleteShift(id: string | number): Promise<void> {
  await api.delete(`${ENDPOINTS.shifts}/${Number(id)}`);
}

/* ------------------------------------------------------------------ */
/* Funcionários                                                        */
/* ------------------------------------------------------------------ */

export async function fetchEmployees(): Promise<Employee[]> {
  const rows = await api.get<unknown[]>(ENDPOINTS.employees);
  return Array.isArray(rows) ? rows.map(mapApiEmployee) : [];
}

export async function createEmployee(payload: Omit<EmployeePayload, 'id'>): Promise<Employee> {
  const res = await api.post<{ employee?: unknown }>(ENDPOINTS.employees, payload);
  return mapApiEmployee(res?.employee);
}

export async function updateEmployee(payload: EmployeePayload): Promise<void> {
  await api.put(ENDPOINTS.employees, { ...payload, id: Number(payload.id) });
}

export async function setEmployeeStatus(id: string | number, active: boolean): Promise<void> {
  await api.put(`${ENDPOINTS.employees}/${Number(id)}/status`, { status_active: active });
}

export async function deleteEmployee(id: string | number): Promise<void> {
  await api.delete(`${ENDPOINTS.employees}/${Number(id)}`);
}

/* ------------------------------------------------------------------ */
/* Equipamentos e empréstimos                                          */
/* ------------------------------------------------------------------ */

export async function fetchEquipment(): Promise<Equipment[]> {
  const res = await api.get<{ equipment?: unknown[] }>(ENDPOINTS.equipments);
  return Array.isArray(res?.equipment) ? res.equipment.map(mapApiEquipment) : [];
}

export async function createEquipment(payload: Omit<EquipmentPayload, 'id'>): Promise<Equipment> {
  const res = await api.post<{ equipment?: unknown }>(ENDPOINTS.equipments, payload);
  return mapApiEquipment(res?.equipment);
}

/** Atualiza dados e, se id_equipment_status for informado, também o status. */
export async function updateEquipment(payload: EquipmentPayload): Promise<void> {
  await api.put(ENDPOINTS.equipments, { ...payload, id: Number(payload.id) });
}

export async function deleteEquipment(id: string | number): Promise<string> {
  const res = await api.delete<{ message?: string }>(`${ENDPOINTS.equipments}/${Number(id)}`);
  return res?.message ?? 'Equipamento excluído.';
}

export async function fetchEquipmentHistory(id: string | number): Promise<EquipmentUsage[]> {
  const res = await api.get<{ uses?: unknown[] }>(`${ENDPOINTS.equipments}/${Number(id)}/history`);
  return Array.isArray(res?.uses) ? res.uses.map(mapApiEquipmentUse) : [];
}

export async function fetchEquipmentUses(filters: {
  from?: string;
  to?: string;
  equipmentId?: string;
  employeeId?: string;
}): Promise<EquipmentUsage[]> {
  const res = await api.get<{ uses?: unknown[] }>(ENDPOINTS.equipmentUses, {
    query: {
      from: filters.from,
      to: filters.to,
      id_equipment: filters.equipmentId,
      id_employee: filters.employeeId,
    },
  });
  return Array.isArray(res?.uses) ? res.uses.map(mapApiEquipmentUse) : [];
}

export async function createEquipmentUse(payload: EquipmentUsePayload): Promise<void> {
  await api.post(ENDPOINTS.equipmentUses, payload);
}

export async function updateEquipmentUse(
  id: string | number,
  payload: EquipmentUsePayload,
): Promise<void> {
  await api.put(`${ENDPOINTS.equipmentUses}/${Number(id)}`, payload);
}

export async function returnEquipmentUse(id: string | number): Promise<void> {
  await api.put(`${ENDPOINTS.equipmentUses}/${Number(id)}/return`, {});
}

export async function deleteEquipmentUse(id: string | number): Promise<void> {
  await api.delete(`${ENDPOINTS.equipmentUses}/${Number(id)}`);
}

/* ------------------------------------------------------------------ */
/* Presença                                                            */
/* ------------------------------------------------------------------ */

export async function fetchAttendanceRange(
  from: string,
  to: string,
): Promise<AttendanceFetchResult> {
  const res = await api.get<{ attendance?: unknown[] }>(ENDPOINTS.presence, {
    query: { from, to },
  });
  const rows = Array.isArray(res?.attendance) ? res.attendance : [];

  const statusByKey: Record<string, string> = {};
  const recordIdByKey: Record<string, string> = {};

  for (const raw of rows) {
    if (!isRecord(raw)) continue;
    const key = `${str(raw.id_employee)}|${str(raw.date).slice(0, 10)}`;
    statusByKey[key] = str(raw.attendance_status);
    if (raw.id != null) recordIdByKey[key] = str(raw.id);
  }

  return { statusByKey, recordIdByKey };
}

export async function saveAttendanceRecord(params: {
  employeeId: string | number;
  statusId: string | number;
  date: string;
  observation?: string | null;
}): Promise<string | undefined> {
  const res = await api.put<{ attendance?: { id?: number | string } }>(ENDPOINTS.presence, {
    id_employee: Number(params.employeeId),
    id_attendance_status: Number(params.statusId),
    date: params.date,
    observation: params.observation ?? null,
  });
  return res?.attendance?.id != null ? str(res.attendance.id) : undefined;
}

export async function deleteAttendanceRecord(id: string | number): Promise<void> {
  await api.delete(`${ENDPOINTS.presence}/${Number(id)}`);
}

export async function markAllPresent(from: string, to: string): Promise<string> {
  const res = await api.post<{ message?: string }>(`${ENDPOINTS.presence}/all`, { from, to });
  return res?.message ?? 'Presenças registradas.';
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export async function fetchDashboard(from: string, to: string): Promise<DashboardData> {
  return api.get<DashboardData>(ENDPOINTS.dashboard, { query: { from, to } });
}
