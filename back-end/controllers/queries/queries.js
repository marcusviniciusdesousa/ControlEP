// Queries for Project
// CommonJS (o restante do back-end usa require/module.exports).

// Fuso horário usado para converter datas (AAAA-MM-DD) em instantes nos filtros de período.
// Validado para poder ser interpolado com segurança no SQL.
const APP_TIMEZONE = /^[A-Za-z_]+(\/[A-Za-z_]+)*$/.test(process.env.DB_TIMEZONE || "")
  ? process.env.DB_TIMEZONE
  : "America/Sao_Paulo";

// Colunas comuns de funcionário, já com nomes das tabelas relacionadas
const EMPLOYEE_COLUMNS = `
  e.id, e.name, e.id_position, p.name AS position_name, e.code_employee, e.login_main_system,
  e.id_sector, s.name AS sector_name, e.id_shift, sh.name AS shift_name, sh.days_of_week AS shift_days,
  e.status_active, to_char(e.date_admission, 'YYYY-MM-DD') AS date_admission,
  e.date_register, e.date_change_status, e.id_user_create, e.id_last_user_change`;

const EMPLOYEE_JOINS = `
  FROM employee e
  INNER JOIN position p ON e.id_position = p.id
  LEFT JOIN sector s ON e.id_sector = s.id
  INNER JOIN shift sh ON e.id_shift = sh.id`;

// Colunas de equipamento + empréstimo em aberto (se existir)
const EQUIPMENT_COLUMNS = `
  e.id, e.name, e.id_equipment_type, et.name AS equipment_type, e.id_equipment_status,
  es.name AS equipment_status, e.heritage_code, e.id_sector, s.name AS sector_name, e.observation,
  e.date_register, e.date_change_status, e.id_user_create, e.id_last_user_change,
  ou.id AS open_use_id, ou.id_employee AS open_use_employee_id, oe.name AS open_use_employee,
  ou.date_start AS open_use_start`;

const EQUIPMENT_JOINS = `
  FROM equipment e
  INNER JOIN equipment_type et ON e.id_equipment_type = et.id
  INNER JOIN equipment_status es ON e.id_equipment_status = es.id
  LEFT JOIN sector s ON e.id_sector = s.id
  LEFT JOIN equipment_use ou ON ou.id_equipment = e.id AND ou.date_return IS NULL
  LEFT JOIN employee oe ON oe.id = ou.id_employee`;

const USE_COLUMNS = `
  u.id, u.id_equipment, eq.name AS equipment_name, eq.heritage_code, u.id_employee,
  em.name AS employee_name, u.date_start, u.date_return, u.observation,
  u.date_register, u.date_last_change, u.id_user_create, u.id_last_user_change`;

const USE_JOINS = `
  FROM equipment_use u
  INNER JOIN equipment eq ON eq.id = u.id_equipment
  INNER JOIN employee em ON em.id = u.id_employee`;

const ATTENDANCE_COLUMNS = `
  a.id, a.id_employee, e.name AS employee_name, a.id_attendance_status, ast.name AS attendance_status,
  to_char(a.date, 'YYYY-MM-DD') AS date, a.observation, a.date_register, a.date_last_change,
  a.id_user_create, a.id_last_user_change`;

const ATTENDANCE_JOINS = `
  FROM attendance a
  INNER JOIN employee e ON a.id_employee = e.id
  INNER JOIN attendance_status ast ON a.id_attendance_status = ast.id`;

const queries = {
  //
  //
  // USERS

  qSelectAllUsers: `
    SELECT u.id, u.name, u.email, u.id_role, r.name AS role_name, u.status_active,
           u.approval_status, u.date_register, u.date_approval
      FROM "user" u
      INNER JOIN role r ON u.id_role = r.id
     ORDER BY CASE u.approval_status WHEN 'Pendente' THEN 0 WHEN 'Aprovado' THEN 1 ELSE 2 END,
              u.name ASC;`,

  qSelectUserByID: `
    SELECT u.id, u.name, u.email, u.id_role, r.name AS role_name, u.status_active, u.approval_status
      FROM "user" u
      INNER JOIN role r ON u.id_role = r.id
     WHERE u.id = $1;`,

  qSelectUserByEmail: `
    SELECT u.id, u.name, u.id_role, u.password_hash, u.status_active, u.approval_status
      FROM "user" u
     WHERE u.email = $1;`,

  qSelectUserByEmailExceptId: `SELECT id FROM "user" WHERE email = $1 AND id <> $2;`,

  qAddNewUser: `
    INSERT INTO "user" (name, email, password_hash, id_role, status_active, approval_status)
    VALUES ($1, $2, $3, $4, FALSE, 'Pendente')
    RETURNING id;`,

  qUpdateUser: `UPDATE "user" SET name = $1, email = $2, id_role = $3 WHERE id = $4 RETURNING id;`,

  qApproveUser: `
    UPDATE "user"
       SET approval_status = 'Aprovado', status_active = TRUE, id_role = $1,
           id_user_approval = $2, date_approval = NOW()
     WHERE id = $3
     RETURNING id;`,

  qRejectUser: `
    UPDATE "user"
       SET approval_status = 'Rejeitado', status_active = FALSE,
           id_user_approval = $1, date_approval = NOW()
     WHERE id = $2
     RETURNING id;`,

  qUpdateUserStatus: `UPDATE "user" SET status_active = $1 WHERE id = $2 RETURNING id;`,

  qDeleteUser: `DELETE FROM "user" WHERE id = $1 RETURNING id;`,

  qUpdateUserPassword: `UPDATE "user" SET password_hash = $1 WHERE id = $2 RETURNING id;`,

  //
  //
  // SESSIONS

  qSelectRefreshToken: `
    SELECT us.id AS id_session, us.id_user, us.expires_at, u.id, u.name, u.id_role,
           u.status_active, u.approval_status
      FROM user_session us
      INNER JOIN "user" u ON us.id_user = u.id
     WHERE us.token = $1 AND us.expires_at > NOW();`,

  qAddRefreshToken: `INSERT INTO user_session (id_user, token, expires_at) VALUES ($1, $2, $3);`,

  // Mantém o token antigo válido por alguns segundos após a rotação
  qExpireRefreshTokenSoon: `
    UPDATE user_session SET expires_at = LEAST(expires_at, $2::timestamptz) WHERE id = $1;`,

  qDeleteRefreshTokenByToken: `DELETE FROM user_session WHERE token = $1;`,
  qDeleteRefreshTokenByID: `DELETE FROM user_session WHERE id_user = $1;`,
  qDeleteRefreshTokenByExpirationDate: `DELETE FROM user_session WHERE expires_at < NOW();`,

  //
  //
  // ROLES & PERMISSIONS

  qSelectRoles: `SELECT id, name FROM role ORDER BY name ASC;`,
  qSelectPermissions: `SELECT id, name FROM permission ORDER BY name ASC;`,
  qSelectRoleById: `SELECT id, name FROM role WHERE id = $1;`,
  qCheckRolePermission: `SELECT 1 FROM role_permission WHERE id_role = $1 AND id_permission = $2;`,
  SelectPermissionsByRole: `
    SELECT p.id, p.name FROM permission p
      INNER JOIN role_permission rp ON p.id = rp.id_permission
     WHERE rp.id_role = $1 ORDER BY p.name ASC;`,
  qSelectRoleByName: `SELECT id, name FROM role WHERE LOWER(name) = LOWER($1);`,
  qSelectRoleByNameExceptId: `SELECT id FROM role WHERE LOWER(name) = LOWER($1) AND id <> $2;`,
  qSelectUsersByRole: `SELECT id FROM "user" WHERE id_role = $1;`,
  qSelectPermissionsByRoleId: `
    SELECT p.name FROM role_permission rp JOIN permission p ON p.id = rp.id_permission
     WHERE rp.id_role = $1`,
  qAddRole: `INSERT INTO role (name) VALUES ($1) RETURNING id, name;`,
  qAddRolePermission: `INSERT INTO role_permission (id_role, id_permission) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
  qUpdateRole: `UPDATE role SET name = $1 WHERE id = $2 RETURNING id, name;`,
  qDeleteRole: `
    DELETE FROM role WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id_role = $1)
    RETURNING id, name;`,
  qDeleteRolePermission: `
    DELETE FROM role_permission WHERE id_role = $1 AND id_permission = $2
    RETURNING id_role, id_permission;`,
  qDeleteAllRolePermissions: `DELETE FROM role_permission WHERE id_role = $1 RETURNING id_role, id_permission;`,

  //
  //
  // LOOKUPS

  qSelectPositions: `SELECT id, name FROM position ORDER BY name ASC;`,
  qSelectSectors: `SELECT id, name FROM sector ORDER BY name ASC;`,
  qSelectEquipmentTypes: `SELECT id, name FROM equipment_type ORDER BY name ASC;`,
  qSelectEquipmentStatuses: `SELECT id, name FROM equipment_status ORDER BY name ASC;`,
  qSelectAttendanceStatuses: `SELECT id, name FROM attendance_status ORDER BY id ASC;`,
  qSelectPositionById: `SELECT id FROM position WHERE id = $1;`,
  qSelectSectorById: `SELECT id FROM sector WHERE id = $1;`,

  //
  //
  // SHIFTS

  qSelectShifts: `
    SELECT id, name, to_char(hour_start, 'HH24:MI') AS hour_start,
           to_char(hour_end, 'HH24:MI') AS hour_end, days_of_week
      FROM shift ORDER BY hour_start ASC, name ASC;`,
  qSelectShiftById: `
    SELECT id, name, to_char(hour_start, 'HH24:MI') AS hour_start,
           to_char(hour_end, 'HH24:MI') AS hour_end, days_of_week
      FROM shift WHERE id = $1;`,
  qSelectShiftByNameExceptId: `
    SELECT id, name FROM shift WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND id <> $2;`,
  qSelectShiftByHoursExceptId: `
    SELECT id, name FROM shift WHERE hour_start = $1::time AND hour_end = $2::time AND id <> $3;`,
  qSelectShiftEmployeeUsage: `SELECT COUNT(*)::int AS total FROM employee WHERE id_shift = $1;`,
  qAddShift: `
    INSERT INTO shift (name, hour_start, hour_end, days_of_week) VALUES ($1, $2, $3, $4)
    RETURNING id, name, to_char(hour_start, 'HH24:MI') AS hour_start,
              to_char(hour_end, 'HH24:MI') AS hour_end, days_of_week;`,
  qUpdateShift: `
    UPDATE shift SET name = $1, hour_start = $2, hour_end = $3, days_of_week = $4 WHERE id = $5
    RETURNING id, name, to_char(hour_start, 'HH24:MI') AS hour_start,
              to_char(hour_end, 'HH24:MI') AS hour_end, days_of_week;`,
  qDeleteShift: `DELETE FROM shift WHERE id = $1 RETURNING id, name;`,

  //
  //
  // EMPLOYEES

  qSelectEmployees: `SELECT ${EMPLOYEE_COLUMNS} ${EMPLOYEE_JOINS} ORDER BY e.name ASC;`,
  qSelectEmployeeById: `SELECT ${EMPLOYEE_COLUMNS} ${EMPLOYEE_JOINS} WHERE e.id = $1;`,
  qSelectEmployeeFullById: `
    SELECT ${EMPLOYEE_COLUMNS}, uc.name AS created_by, ul.name AS last_changed_by
    ${EMPLOYEE_JOINS}
      INNER JOIN "user" uc ON e.id_user_create = uc.id
      INNER JOIN "user" ul ON e.id_last_user_change = ul.id
     WHERE e.id = $1;`,
  qSelectEmployeeFirstAttendanceDate: `
    SELECT to_char(MIN(date), 'YYYY-MM-DD') AS first_date FROM attendance WHERE id_employee = $1;`,
  qSelectEmployeeReferences: `
    SELECT (SELECT COUNT(*) FROM attendance WHERE id_employee = $1)::int AS attendance,
           (SELECT COUNT(*) FROM equipment_use WHERE id_employee = $1)::int AS equipment_use;`,
  qAddEmployee: `
    INSERT INTO employee (name, id_position, code_employee, login_main_system, id_sector, id_shift,
                          status_active, date_admission, date_register, id_user_create, id_last_user_change)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9, $9)
    RETURNING id;`,
  qUpdateEmployee: `
    UPDATE employee
       SET name = $1, id_position = $2, code_employee = $3, login_main_system = $4, id_sector = $5,
           id_shift = $6, date_admission = $7, id_last_user_change = $8
     WHERE id = $9 RETURNING id;`,
  qUpdateEmployeeStatus: `
    UPDATE employee
       SET status_active = $1,
           date_change_status = CASE WHEN status_active IS DISTINCT FROM $1 THEN CURRENT_TIMESTAMP ELSE date_change_status END,
           id_last_user_change = $2
     WHERE id = $3 RETURNING id;`,
  qDeleteEmployee: `DELETE FROM employee WHERE id = $1 RETURNING id;`,

  //
  //
  // EQUIPMENT

  qSelectAllEquipment: `
    SELECT ${EQUIPMENT_COLUMNS} ${EQUIPMENT_JOINS}
     WHERE e.date_deleted IS NULL ORDER BY e.name ASC;`,
  qSelectEquipmentById: `
    SELECT ${EQUIPMENT_COLUMNS} ${EQUIPMENT_JOINS}
     WHERE e.id = $1 AND e.date_deleted IS NULL;`,
  qLockEquipment: `
    SELECT e.id, e.id_equipment_status, es.name AS equipment_status, e.date_deleted
      FROM equipment e JOIN equipment_status es ON es.id = e.id_equipment_status
     WHERE e.id = $1 FOR UPDATE OF e;`,
  qSelectEquipmentTypeById: `SELECT id FROM equipment_type WHERE id = $1;`,
  qSelectEquipmentStatusById: `SELECT id, name FROM equipment_status WHERE id = $1;`,
  qSelectEquipmentStatusByName: `SELECT id, name FROM equipment_status WHERE name = $1;`,
  qCheckDuplicateHeritageCode: `
    SELECT id FROM equipment WHERE heritage_code = $1 AND id <> $2 AND date_deleted IS NULL;`,
  qSelectEquipmentUseCount: `SELECT COUNT(*)::int AS total FROM equipment_use WHERE id_equipment = $1;`,
  qAddEquipment: `
    INSERT INTO equipment (name, id_equipment_type, id_equipment_status, heritage_code, id_sector,
                           observation, id_user_create, id_last_user_change)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING id;`,
  qUpdateEquipment: `
    UPDATE equipment
       SET name = $1, id_equipment_type = $2, heritage_code = $3, id_sector = $4, observation = $5,
           id_last_user_change = $6
     WHERE id = $7 AND date_deleted IS NULL RETURNING id;`,
  qUpdateEquipmentStatus: `
    UPDATE equipment SET id_equipment_status = $1, id_last_user_change = $2 WHERE id = $3 RETURNING id;`,
  qSoftDeleteEquipment: `
    UPDATE equipment SET date_deleted = NOW(), id_user_delete = $1, id_last_user_change = $1
     WHERE id = $2 AND date_deleted IS NULL RETURNING id;`,
  qDeleteEquipment: `DELETE FROM equipment WHERE id = $1 RETURNING id;`,

  //
  //
  // EQUIPMENT USE (empréstimos)

  qSelectEquipmentUses: `
    SELECT ${USE_COLUMNS} ${USE_JOINS}
     WHERE ($1::date IS NULL OR u.date_return IS NULL
            OR u.date_start < (($1::date + 1)::timestamp AT TIME ZONE '${APP_TIMEZONE}'))
       AND ($2::date IS NULL OR u.date_return IS NULL
            OR u.date_return >= ($2::date::timestamp AT TIME ZONE '${APP_TIMEZONE}'))
       AND ($3::int IS NULL OR u.id_equipment = $3)
       AND ($4::int IS NULL OR u.id_employee = $4)
     ORDER BY (u.date_return IS NULL) DESC, u.date_start DESC;`,
  qSelectEquipmentUsesByEquipment: `
    SELECT ${USE_COLUMNS} ${USE_JOINS} WHERE u.id_equipment = $1 ORDER BY u.date_start DESC;`,
  qSelectEquipmentUseById: `SELECT ${USE_COLUMNS} ${USE_JOINS} WHERE u.id = $1;`,
  qLockEquipmentUse: `SELECT * FROM equipment_use WHERE id = $1 FOR UPDATE;`,
  qSelectOpenUseByEquipment: `
    SELECT id FROM equipment_use WHERE id_equipment = $1 AND date_return IS NULL AND id <> COALESCE($2, -1);`,
  qSelectOverlappingUse: `
    SELECT id FROM equipment_use
     WHERE id_equipment = $1 AND id <> COALESCE($4, -1)
       AND tstzrange(date_start, COALESCE(date_return, 'infinity'), '[)')
           && tstzrange($2::timestamptz, COALESCE($3::timestamptz, 'infinity'), '[)');`,
  qAddEquipmentUse: `
    INSERT INTO equipment_use (id_employee, id_equipment, date_start, date_return, observation,
                               id_user_create, id_last_user_change)
    VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id;`,
  qUpdateEquipmentUse: `
    UPDATE equipment_use
       SET id_employee = $1, id_equipment = $2, date_start = $3, date_return = $4, observation = $5,
           id_last_user_change = $6
     WHERE id = $7 RETURNING id;`,
  qReturnEquipmentUse: `
    UPDATE equipment_use SET date_return = $1, id_last_user_change = $2
     WHERE id = $3 AND date_return IS NULL RETURNING id;`,
  qDeleteEquipmentUse: `DELETE FROM equipment_use WHERE id = $1 RETURNING id, id_equipment;`,

  //
  //
  // ATTENDANCE

  qSelectAttendanceByPeriod: `
    SELECT ${ATTENDANCE_COLUMNS} ${ATTENDANCE_JOINS}
     WHERE a.date BETWEEN $1 AND $2 AND ($3::int IS NULL OR a.id_employee = $3)
     ORDER BY a.date ASC, e.name ASC;`,
  qSelectAttendanceByEmployee: `
    SELECT ${ATTENDANCE_COLUMNS} ${ATTENDANCE_JOINS} WHERE a.id_employee = $1 ORDER BY a.date DESC;`,
  qSelectAttendanceByEmployeeAndDate: `
    SELECT ${ATTENDANCE_COLUMNS} ${ATTENDANCE_JOINS} WHERE a.id_employee = $1 AND a.date = $2;`,
  qSelectAttendanceById: `
    SELECT id, id_employee, id_attendance_status, to_char(date, 'YYYY-MM-DD') AS date, observation
      FROM attendance WHERE id = $1;`,
  // Dados do funcionário necessários para validar um registro de presença
  qSelectAttendanceEmployeeById: `
    SELECT e.id, e.name, e.status_active, to_char(e.date_admission, 'YYYY-MM-DD') AS date_admission,
           sh.name AS shift_name, sh.days_of_week
      FROM employee e INNER JOIN shift sh ON sh.id = e.id_shift
     WHERE e.id = $1;`,
  qSelectAttendanceStatusById: `SELECT id, name FROM attendance_status WHERE id = $1;`,
  qSelectPresentStatus: `SELECT id FROM attendance_status WHERE name = 'Presente';`,
  qAddAttendance: `
    INSERT INTO attendance (id_employee, id_attendance_status, date, observation, id_user_create, id_last_user_change)
    VALUES ($1, $2, $3, $4, $5, $5) RETURNING id;`,
  qUpdateAttendance: `
    UPDATE attendance SET id_attendance_status = $1, observation = $2, id_last_user_change = $3
     WHERE id = $4 RETURNING id;`,
  qDeleteAttendance: `DELETE FROM attendance WHERE id = $1 RETURNING id;`,
  // Marca como presentes apenas funcionários ativos, já admitidos e cujo turno vale no dia
  qMarkAllEmployeesPresent: `
    INSERT INTO attendance (id_employee, id_attendance_status, date, observation, id_user_create, id_last_user_change)
    SELECT e.id, $3, $1::date, NULL, $2, $2
      FROM employee e
      INNER JOIN shift sh ON sh.id = e.id_shift
     WHERE e.status_active = TRUE
       AND e.date_admission <= $1::date
       AND EXTRACT(DOW FROM $1::date)::smallint = ANY (sh.days_of_week)
    ON CONFLICT (id_employee, date) DO NOTHING
    RETURNING id;`,

  //
  //
  // DASHBOARD

  qDashboardEmployees: `
    SELECT COUNT(*)::int AS registered,
           COUNT(*) FILTER (WHERE status_active)::int AS active_now,
           COUNT(*) FILTER (WHERE NOT status_active)::int AS inactive_now
      FROM employee;`,
  qDashboardAttendanceByStatus: `
    SELECT ast.id, ast.name AS status, COUNT(a.id)::int AS quantity
      FROM attendance_status ast
      LEFT JOIN attendance a ON a.id_attendance_status = ast.id AND a.date BETWEEN $1 AND $2
     GROUP BY ast.id, ast.name ORDER BY ast.id;`,
  // Funcionários ativos hoje (já admitidos até o fim do período) ou com registros no período
  qDashboardAttendanceByEmployee: `
    SELECT e.id, e.name, p.name AS position_name, e.status_active,
           to_char(e.date_admission, 'YYYY-MM-DD') AS date_admission,
           COALESCE(jsonb_object_agg(ast.name, cnt.quantity) FILTER (WHERE ast.name IS NOT NULL), '{}'::jsonb) AS counts
      FROM employee e
      INNER JOIN position p ON p.id = e.id_position
      LEFT JOIN (
        SELECT id_employee, id_attendance_status, COUNT(*)::int AS quantity
          FROM attendance WHERE date BETWEEN $1 AND $2
         GROUP BY id_employee, id_attendance_status
      ) cnt ON cnt.id_employee = e.id
      LEFT JOIN attendance_status ast ON ast.id = cnt.id_attendance_status
     WHERE (e.status_active AND e.date_admission <= $2) OR cnt.id_employee IS NOT NULL
     GROUP BY e.id, e.name, p.name, e.status_active, e.date_admission
     ORDER BY e.status_active DESC, e.name ASC;`,
  qDashboardEquipmentByStatus: `
    SELECT es.id AS id_status, es.name AS status, COUNT(e.id)::int AS quantity
      FROM equipment_status es
      LEFT JOIN equipment e ON e.id_equipment_status = es.id AND e.date_deleted IS NULL
     GROUP BY es.id, es.name ORDER BY es.name;`,
  qDashboardEquipmentSummary: `
    SELECT COUNT(*)::int AS total,
           COUNT(ou.id)::int AS in_use
      FROM equipment e
      LEFT JOIN equipment_use ou ON ou.id_equipment = e.id AND ou.date_return IS NULL
     WHERE e.date_deleted IS NULL;`,
};

module.exports = { queries };
