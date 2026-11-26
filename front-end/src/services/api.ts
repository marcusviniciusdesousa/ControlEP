/**
 * src/services/api.ts
 *
 * Cliente HTTP completo do Control EP (React + Vite) para o back-end Node/Express.
 */
import { env } from '../config/env';
import type { Employee, Equipment, Role, User } from '../types/models';

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

export const ENDPOINTS = {
  login: '/auth',
  register: '/register',
  refresh: '/refresh',
  refreshUser: '/refreshUser',
  logout: '/logout',
  users: '/users',
  employees: '/employees',
  roles: '/roles',
  permissions: '/permissions',
  shifts: '/shifts',
  equipments: '/equipments',
  presence: '/presence',
  dashboard: '/dashboard',
} as const;

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface SessionUser {
  id: string;
  name: string;
  roleId: string;
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
}

export interface EmployeePayload {
  id?: string | number;
  name: string;
  id_position: number;
  code_employee: string | null;
  login_main_system: string | null;
  id_sector: number | null;
  id_shift: number;
}

export interface EquipmentPayload {
  id?: string | number;
  name: string;
  id_equipment_type: number;
  id_equipment_status: number;
  heritage_code: string;
  id_sector: number | null;
  observation: string | null;
}

export interface AttendanceFetchResult {
  statusByKey: Record<string, string>;
  recordIdByKey: Record<string, string>;
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
/* Tabelas de referência (IDs padrão do banco)                         */
/* ------------------------------------------------------------------ */

const EQUIPMENT_TYPE_IDS: Record<string, number> = {
  pda: 1,
  notebook: 2,
  rádio: 3,
  radio: 3,
  tablet: 4,
  celular: 5,
  outro: 6,
};

const EQUIPMENT_STATUS_IDS: Record<string, number> = {
  ativo: 1,
  inativo: 2,
  manutenção: 3,
  manutencao: 3,
};

const ATTENDANCE_STATUS_TO_ID: Record<string, number> = {
  Presente: 1,
  Falta: 2,
  'Falta injustificada': 2,
  Atestado: 3,
  'Banco de horas': 4,
  Afastado: 5,
  Férias: 6,
  Folga: 4,
};

function normalizeAttendanceLabel(apiLabel: string): string {
  const clean = apiLabel.trim();
  if (clean === 'Falta injustificada') return 'Falta';
  if (clean === 'Banco de horas') return 'Folga';
  return clean;
}

export function resolveEquipmentTypeId(value: string): number {
  const key = value.trim().toLowerCase();
  return EQUIPMENT_TYPE_IDS[key] ?? parseNumericId(value, 1);
}

export function resolveEquipmentStatusId(value: string): number {
  const key = value.trim().toLowerCase();
  return EQUIPMENT_STATUS_IDS[key] ?? parseNumericId(value, 1);
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

export const isAuthStatus = (status: number): boolean => status === 401 || status === 403;

const DEFAULT_MESSAGES: Record<number, string> = {
  0: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
  400: 'Dados inválidos.',
  401: 'Sessão inválida ou sem permissão.',
  403: 'Acesso negado.',
  404: 'Recurso não encontrado.',
  409: 'Registro já existe ou possui vínculos ativos.',
  500: 'Erro interno do servidor.',
};

const defaultMessage = (status: number): string => DEFAULT_MESSAGES[status] ?? `Erro ${status}.`;

function extractMessage(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const text = data.message ?? data.Message;
  return typeof text === 'string' && text.trim() ? text : null;
}

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const str = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

const toBool = (value: unknown): boolean =>
  value === true || value === 1 || value === 't' || value === 'true';

export function parseNumericId(value: unknown, fallback = 1): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  const text = str(value).trim();
  const match = /^(\d+)/.exec(text);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Estado da sessão (somente em memória)                               */
/* ------------------------------------------------------------------ */

const BASE_URL = env.apiBaseUrl.replace(/\/+$/, '');

let accessToken: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};
export const getAccessToken = (): string | null => accessToken;

export const setSessionExpiredHandler = (handler: (() => void) | null): void => {
  sessionExpiredHandler = handler;
};

function expireSession(silent?: boolean): void {
  accessToken = null;
  if (!silent) sessionExpiredHandler?.();
}

function pickAccessToken(data: unknown): string | null {
  return isRecord(data) && typeof data.accessToken === 'string' ? data.accessToken : null;
}

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
    if (body instanceof FormData) {
      payload = body;
    } else {
      headers.set('Content-Type', 'application/json');
      payload = JSON.stringify(body);
    }
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

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

export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(buildUrl(ENDPOINTS.refresh), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
  } catch (cause) {
    throw new ApiError(0, defaultMessage(0), cause);
  }

  if (res.ok) {
    const token = pickAccessToken(await parseBody(res));
    if (token) accessToken = token;
    return true;
  }
  if (isAuthStatus(res.status)) return false;
  throw new ApiError(res.status, defaultMessage(res.status));
}

export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await execute<T>(path, options);
  } catch (error) {
    const authFailure = error instanceof ApiError && isAuthStatus(error.status);
    if (!authFailure || options.skipAuthRefresh) throw error;

    if (!(await refreshSession())) {
      expireSession(options.silent);
      throw new ApiError(401, 'Sua sessão expirou. Entre novamente.');
    }
    return execute<T>(path, options);
  }
}

export const api = {
  get: <T = unknown>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T = unknown>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
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
  return { id: str(id), name: str(name), roleId: str(role) };
}

export function mapApiUser(raw: unknown): User {
  const row = isRecord(raw) ? raw : {};
  const hasStatus = row.status_active !== undefined && row.status_active !== null;
  return {
    id: str(row.id),
    name: str(row.name),
    email: str(row.email),
    role: str(row.role_name ?? row.role),
    roleId: str(row.id_role),
    status: !hasStatus || toBool(row.status_active) ? 'Ativo' : 'Pendente',
  };
}

export function mapApiPermission(raw: unknown): PermissionItem {
  const row = isRecord(raw) ? raw : {};
  return { id: str(row.id), name: str(row.name) };
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
    hourStart: str(row.hour_start),
    hourEnd: str(row.hour_end),
  };
}

export function mapApiEmployee(raw: unknown, shiftMap?: Map<string, string>): Employee {
  const row = isRecord(raw) ? raw : {};
  const shiftId = str(row.id_shift);
  const positionId = str(row.id_position);
  const sectorId = str(row.id_sector);

  return {
    id: str(row.id),
    name: str(row.name),
    number: str(row.code_employee),
    role: str(row.position_name ?? (positionId ? `Cargo #${positionId}` : '')),
    roleId: positionId,
    sector: str(row.sector_name ?? (sectorId ? `Setor #${sectorId}` : '')),
    sectorId,
    jms: str(row.login_main_system),
    status: toBool(row.status_active) ? 'Ativo' : 'Inativo',
    shift: str(row.shift_name ?? shiftMap?.get(shiftId) ?? (shiftId ? `Turno #${shiftId}` : '')),
    shiftId,
  };
}

export function mapApiEquipment(raw: unknown): Equipment {
  const row = isRecord(raw) ? raw : {};
  const typeId = str(row.id_equipment_type);
  const statusId = str(row.id_equipment_status);
  return {
    id: str(row.id),
    name: str(row.name),
    type: str(row.equipment_type ?? (typeId ? `Tipo #${typeId}` : 'Outro')),
    typeId,
    serial: str(row.heritage_code),
    status: str(row.equipment_status ?? 'Ativo'),
    statusId,
    sectorId: str(row.id_sector),
    observation: str(row.observation),
  };
}

/* ------------------------------------------------------------------ */
/* Etapa 1: Sessão                                                     */
/* ------------------------------------------------------------------ */

export async function fetchCurrentUser(options: Pick<RequestOptions, 'silent'> = {}): Promise<SessionUser> {
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
  const token = pickAccessToken(raw);
  if (token) accessToken = token;
  return mapSessionUser(raw) ?? fetchCurrentUser();
}

export async function register(input: RegisterInput): Promise<RegisterResult> {
  await request(ENDPOINTS.register, {
    method: 'POST',
    body: toRegisterPayload(input),
    skipAuthRefresh: true,
  });
  return {
    pending: true,
    message: 'Cadastro enviado. Seu acesso será liberado após a aprovação de um Supervisor ou Master.',
  };
}

export async function logout(): Promise<void> {
  try {
    await request<void>(ENDPOINTS.logout, { skipAuthRefresh: true });
  } catch {
    // Sem rede ou sem cookie: não impede o logout local.
  } finally {
    accessToken = null;
  }
}

export async function restoreSession(): Promise<SessionUser | null> {
  try {
    return await fetchCurrentUser({ silent: true });
  } catch (error) {
    if (error instanceof ApiError && isAuthStatus(error.status)) return null;
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Etapa 2: Usuários, Papéis, Permissões, Turnos e Funcionários        */
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

export async function toggleUserStatus(id: string | number): Promise<void> {
  await api.put(`${ENDPOINTS.users}/${Number(id)}`);
}

export async function deleteUser(id: string | number): Promise<void> {
  await api.delete(`${ENDPOINTS.users}/${Number(id)}`);
}

export async function fetchAllPermissions(): Promise<PermissionItem[]> {
  const rows = await api.get<unknown[]>(ENDPOINTS.permissions);
  return Array.isArray(rows) ? rows.map(mapApiPermission) : [];
}

export async function fetchRolePermissions(roleId: string | number): Promise<PermissionItem[]> {
  const rows = await api.get<unknown[]>(`${ENDPOINTS.permissions}/roles/${roleId}`);
  return Array.isArray(rows) ? rows.map(mapApiPermission) : [];
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

export async function fetchShifts(): Promise<ShiftItem[]> {
  const rows = await api.get<unknown[]>(ENDPOINTS.shifts);
  return Array.isArray(rows) ? rows.map(mapApiShift) : [];
}

export async function createShift(payload: {
  name: string;
  hour_start: string;
  hour_end: string;
}): Promise<ShiftItem> {
  const res = await api.post<{ shift?: unknown }>(ENDPOINTS.shifts, payload);
  return mapApiShift(res?.shift ?? payload);
}

export async function updateShift(payload: {
  id: string | number;
  name: string;
  hour_start: string;
  hour_end: string;
}): Promise<ShiftItem> {
  const res = await api.put<{ shift?: unknown }>(ENDPOINTS.shifts, {
    id: Number(payload.id),
    name: payload.name,
    hour_start: payload.hour_start,
    hour_end: payload.hour_end,
  });
  return mapApiShift(res?.shift ?? payload);
}

export async function deleteShift(id: string | number): Promise<void> {
  await api.delete(`${ENDPOINTS.shifts}/${Number(id)}`);
}

export async function fetchEmployees(shifts?: ShiftItem[]): Promise<Employee[]> {
  const shiftMap = new Map<string, string>((shifts ?? []).map((s) => [s.id, s.name]));
  const rows = await api.get<unknown[]>(ENDPOINTS.employees);
  return Array.isArray(rows) ? rows.map((row) => mapApiEmployee(row, shiftMap)) : [];
}

export async function createEmployee(payload: Omit<EmployeePayload, 'id'>): Promise<Employee> {
  const res = await api.post<{ employee?: unknown }>(ENDPOINTS.employees, payload);
  return mapApiEmployee(res?.employee ?? payload);
}

export async function updateEmployee(payload: EmployeePayload): Promise<void> {
  await api.put(ENDPOINTS.employees, {
    ...payload,
    id: Number(payload.id),
  });
}

export async function deactivateEmployee(id: string | number, userId?: string | number): Promise<void> {
  const path = userId
    ? `${ENDPOINTS.employees}/${Number(id)}/${Number(userId)}`
    : `${ENDPOINTS.employees}/${Number(id)}`;
  await api.put(path);
}

export async function deleteEmployee(id: string | number): Promise<void> {
  await api.delete(`${ENDPOINTS.employees}/${Number(id)}`);
}

/* ------------------------------------------------------------------ */
/* Etapa 3: Equipamentos, Presença e Dashboard                         */
/* ------------------------------------------------------------------ */

export async function fetchEquipment(): Promise<Equipment[]> {
  const res = await api.get<{ equipment?: unknown[] } | unknown[]>(ENDPOINTS.equipments);
  const rows = Array.isArray(res) ? res : Array.isArray(res?.equipment) ? res.equipment : [];
  return rows.map(mapApiEquipment);
}

export async function createEquipment(payload: Omit<EquipmentPayload, 'id'>): Promise<Equipment> {
  const res = await api.post<{ equipment?: unknown }>(ENDPOINTS.equipments, payload);
  return mapApiEquipment(res?.equipment ?? payload);
}

export async function updateEquipment(payload: Omit<EquipmentPayload, 'id_equipment_status'>): Promise<void> {
  await api.put(ENDPOINTS.equipments, {
    ...payload,
    id: Number(payload.id),
  });
}

export async function updateEquipmentStatus(
  id: string | number,
  id_equipment_status: number,
): Promise<void> {
  await api.get(`${ENDPOINTS.equipments}/status`, {
    query: { id: Number(id), id_equipment_status },
  });
}

export async function fetchAttendanceByDate(date: string): Promise<AttendanceFetchResult> {
  const res = await api.get<{ attendance?: unknown[] } | unknown[]>(ENDPOINTS.presence, {
    query: { date },
  });
  const rows = Array.isArray(res) ? res : Array.isArray(res?.attendance) ? res.attendance : [];

  const statusByKey: Record<string, string> = {};
  const recordIdByKey: Record<string, string> = {};

  for (const raw of rows) {
    if (!isRecord(raw)) continue;
    const empId = str(raw.id_employee);
    const rawDate = str(raw.date).slice(0, 10) || date;
    const key = `${empId}|${rawDate}`;
    statusByKey[key] = normalizeAttendanceLabel(str(raw.attendance_status));
    if (raw.id != null) recordIdByKey[key] = str(raw.id);
  }

  return { statusByKey, recordIdByKey };
}

export async function saveAttendanceRecord(params: {
  recordId?: string;
  employeeId: string | number;
  statusLabel: string;
  date: string;
  observation?: string | null;
}): Promise<string | undefined> {
  const statusId = ATTENDANCE_STATUS_TO_ID[params.statusLabel] ?? 1;

  if (params.recordId) {
    const res = await api.post<{ attendance?: { id?: number | string } }>(ENDPOINTS.presence, {
      id: Number(params.recordId),
      id_attendance_status: statusId,
      observation: params.observation ?? null,
    });
    return res?.attendance?.id != null ? str(res.attendance.id) : params.recordId;
  }

  const res = await api.put<{ attendance?: { id?: number | string } }>(ENDPOINTS.presence, {
    id_employee: Number(params.employeeId),
    id_attendance_status: statusId,
    date: params.date,
    observation: params.observation ?? null,
  });
  return res?.attendance?.id != null ? str(res.attendance.id) : undefined;
}

export async function markAllPresentByDate(date: string): Promise<void> {
  await api.get(`${ENDPOINTS.presence}/all`, { query: { date } });
}