import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  emptyLookups,
  fetchAttendanceRange,
  fetchEmployees,
  fetchEquipment,
  fetchLookups,
  fetchRolesWithPermissions,
  fetchShifts,
  fetchUsers,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  restoreSession,
  setSessionExpiredHandler,
  type LoginCredentials,
  type RegisterInput,
  type RegisterResult,
  type SessionUser,
  type ShiftItem,
} from '../services/api';
import type { AttendanceMap, Employee, Equipment, Lookups, Role, User } from '../types/models';
import { useNotification } from './NotificationContext';
import { clearPersistentFilters } from '../hooks/usePersistentState';

type Setter<T> = Dispatch<SetStateAction<T>>;
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface ControlState {
  employees: Employee[];
  equipment: Equipment[];
  roles: Role[];
  users: User[];
  shifts: ShiftItem[];
  lookups: Lookups;
  attendance: AttendanceMap;
  setAttendance: Setter<AttendanceMap>;
  attendanceRecordIds: Record<string, string>;
  setAttendanceRecordIds: Setter<Record<string, string>>;
  loadAttendanceRange: (from: string, to: string) => Promise<void>;
  reloadEmployees: () => Promise<void>;
  reloadEquipment: () => Promise<void>;
  reloadRoles: () => Promise<void>;
  reloadUsers: () => Promise<void>;
  reloadShifts: () => Promise<void>;
  currentUser: SessionUser | null;
  hasPermission: (permission: string) => boolean;
  authStatus: AuthStatus;
  login: (credentials: LoginCredentials) => Promise<SessionUser>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  reloadAllData: () => Promise<void>;
}

const ControlContext = createContext<ControlState | null>(null);

export function ControlProvider({ children }: { children: ReactNode }) {
  const { notify } = useNotification();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [lookups, setLookups] = useState<Lookups>(emptyLookups);
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [attendanceRecordIds, setAttendanceRecordIds] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

  const hasPermission = useCallback(
    (permission: string) => Boolean(currentUser?.permissions.includes(permission)),
    [currentUser],
  );

  /** Substitui os registros do período (inclusive células apagadas no servidor). */
  const loadAttendanceRange = useCallback(async (from: string, to: string) => {
    if (!from || !to || from > to) return;
    const result = await fetchAttendanceRange(from, to);
    const inRange = (key: string) => {
      const day = key.split('|')[1];
      return day >= from && day <= to;
    };
    const merge = (prev: Record<string, string>, next: Record<string, string>) => ({
      ...Object.fromEntries(Object.entries(prev).filter(([key]) => !inRange(key))),
      ...next,
    });
    setAttendance((prev) => merge(prev, result.statusByKey));
    setAttendanceRecordIds((prev) => merge(prev, result.recordIdByKey));
  }, []);

  const reloadEmployees = useCallback(async () => setEmployees(await fetchEmployees()), []);
  const reloadEquipment = useCallback(async () => setEquipment(await fetchEquipment()), []);
  const reloadRoles = useCallback(async () => setRoles(await fetchRolesWithPermissions()), []);
  const reloadUsers = useCallback(async () => setUsers(await fetchUsers()), []);
  const reloadShifts = useCallback(async () => setShifts(await fetchShifts()), []);

  const reloadAllData = useCallback(async () => {
    // Cada coleção é carregada de forma independente: a falta de permissão em uma
    // (403) não impede as demais.
    await Promise.allSettled([
      fetchLookups().then(setLookups),
      reloadShifts(),
      reloadEmployees(),
      reloadRoles(),
      reloadUsers(),
      reloadEquipment(),
    ]);
  }, [reloadEmployees, reloadEquipment, reloadRoles, reloadShifts, reloadUsers]);

  const clearSession = useCallback(() => {
    setCurrentUser(null);
    setEmployees([]);
    setEquipment([]);
    setRoles([]);
    setUsers([]);
    setShifts([]);
    setLookups(emptyLookups);
    setAttendance({});
    setAttendanceRecordIds({});
    setAuthStatus('unauthenticated');
  }, []);

  useEffect(() => {
    let active = true;
    setSessionExpiredHandler((message) => {
      clearSession();
      notify(message);
    });
    restoreSession()
      .then((user) => {
        if (!active) return;
        setCurrentUser(user);
        setAuthStatus(user ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (active) clearSession();
      });
    return () => {
      active = false;
      setSessionExpiredHandler(null);
    };
  }, [clearSession, notify]);

  useEffect(() => {
    if (authStatus === 'authenticated') void reloadAllData();
  }, [authStatus, reloadAllData]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const user = await loginRequest(credentials);
    setCurrentUser(user);
    setAuthStatus('authenticated');
    return user;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    clearPersistentFilters();
    clearSession();
  }, [clearSession]);

  return (
    <ControlContext.Provider
      value={{
        employees,
        equipment,
        roles,
        users,
        shifts,
        lookups,
        attendance,
        setAttendance,
        attendanceRecordIds,
        setAttendanceRecordIds,
        loadAttendanceRange,
        reloadEmployees,
        reloadEquipment,
        reloadRoles,
        reloadUsers,
        reloadShifts,
        currentUser,
        hasPermission,
        authStatus,
        login,
        register: registerRequest,
        logout,
        reloadAllData,
      }}
    >
      {children}
    </ControlContext.Provider>
  );
}

export function useControl() {
  const context = useContext(ControlContext);
  if (!context) throw new Error('useControl deve ser usado dentro de ControlProvider.');
  return context;
}
