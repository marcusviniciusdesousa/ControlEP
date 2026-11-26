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
import { initialUsage } from '../data/initialData';
import { useLocalStorage } from '../hooks/useLocalStorage';
import {
  fetchAttendanceByDate,
  fetchEmployees,
  fetchEquipment,
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
import { storageKeys } from '../services/storage';
import type {
  AttendanceMap,
  Employee,
  Equipment,
  EquipmentUsage,
  Role,
  User,
} from '../types/models';

type Setter<T> = Dispatch<SetStateAction<T>>;
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface ControlState {
  employees: Employee[];
  setEmployees: Setter<Employee[]>;
  equipment: Equipment[];
  setEquipment: Setter<Equipment[]>;
  usage: EquipmentUsage[];
  setUsage: Setter<EquipmentUsage[]>;
  roles: Role[];
  setRoles: Setter<Role[]>;
  users: User[];
  setUsers: Setter<User[]>;
  shifts: ShiftItem[];
  attendance: AttendanceMap;
  setAttendance: Setter<AttendanceMap>;
  attendanceRecordIds: Record<string, string>;
  setAttendanceRecordIds: Setter<Record<string, string>>;
  loadAttendanceDates: (dates: string[]) => Promise<void>;
  currentUser: SessionUser | null;
  authStatus: AuthStatus;
  login: (credentials: LoginCredentials) => Promise<SessionUser>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  reloadAllData: () => Promise<void>;
}

const ControlContext = createContext<ControlState | null>(null);

export function ControlProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [attendanceRecordIds, setAttendanceRecordIds] = useState<Record<string, string>>({});

  // Uso/empréstimo de equipamentos ainda não possui rota no back-end
  const [usage, setUsage] = useLocalStorage(storageKeys.usage, initialUsage);

  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

  const loadAttendanceDates = useCallback(async (dates: string[]) => {
    if (!dates.length) return;
    const results = await Promise.allSettled(dates.map((d) => fetchAttendanceByDate(d)));
    setAttendance((prev) => {
      const next = { ...prev };
      for (const res of results) {
        if (res.status === 'fulfilled') Object.assign(next, res.value.statusByKey);
      }
      return next;
    });
    setAttendanceRecordIds((prev) => {
      const next = { ...prev };
      for (const res of results) {
        if (res.status === 'fulfilled') Object.assign(next, res.value.recordIdByKey);
      }
      return next;
    });
  }, []);

  const reloadAllData = useCallback(async () => {
    const loadedShifts = await fetchShifts().catch(() => []);
    setShifts(loadedShifts);

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const [employeesRes, rolesRes, usersRes, equipmentRes] = await Promise.allSettled([
      fetchEmployees(loadedShifts),
      fetchRolesWithPermissions(),
      fetchUsers(),
      fetchEquipment(),
    ]);

    if (employeesRes.status === 'fulfilled') setEmployees(employeesRes.value);
    if (rolesRes.status === 'fulfilled') setRoles(rolesRes.value);
    if (usersRes.status === 'fulfilled') setUsers(usersRes.value);
    if (equipmentRes.status === 'fulfilled') setEquipment(equipmentRes.value);

    await loadAttendanceDates([today]).catch(() => {});
  }, [loadAttendanceDates]);

  useEffect(() => {
    let active = true;
    const clearSession = () => {
      setCurrentUser(null);
      setEmployees([]);
      setEquipment([]);
      setRoles([]);
      setUsers([]);
      setAttendance({});
      setAttendanceRecordIds({});
      setAuthStatus('unauthenticated');
    };
    setSessionExpiredHandler(clearSession);
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
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      void reloadAllData();
    }
  }, [authStatus, reloadAllData]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const user = await loginRequest(credentials);
    setCurrentUser(user);
    setAuthStatus('authenticated');
    return user;
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setCurrentUser(null);
    setEmployees([]);
    setEquipment([]);
    setRoles([]);
    setUsers([]);
    setAttendance({});
    setAttendanceRecordIds({});
    setAuthStatus('unauthenticated');
  }, []);

  return (
    <ControlContext.Provider
      value={{
        employees,
        setEmployees,
        equipment,
        setEquipment,
        usage,
        setUsage,
        roles,
        setRoles,
        users,
        setUsers,
        shifts,
        attendance,
        setAttendance,
        attendanceRecordIds,
        setAttendanceRecordIds,
        loadAttendanceDates,
        currentUser,
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