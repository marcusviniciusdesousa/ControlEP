// Controller file for attendance related queries

const db = require("../db");
const { queries: q } = require("./queries/queries");
const validate = require("../helpers/dataValidation");

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MAX_PERIOD_DAYS = 62;

const formatDateBR = (iso) => iso.split("-").reverse().join("/");

const daysBetween = (from, to) =>
  Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000) + 1;

/**
 * Regras de negócio de um registro de presença. Devolve uma mensagem de erro ou null.
 * - a data não pode ser anterior à admissão do funcionário;
 * - o turno do funcionário precisa valer no dia da semana da data.
 * (A regra considera apenas a data: presença é diária e o turno é identificado
 *  pelo dia de início, inclusive em turnos que atravessam a meia-noite.)
 */
const validateAttendanceRules = (employee, date) => {
  if (date < employee.date_admission) {
    return `Não é possível registrar presença em ${formatDateBR(date)}: a admissão de ${employee.name} é em ${formatDateBR(employee.date_admission)}.`;
  }
  const weekday = validate.weekdayOf(date);
  if (!employee.days_of_week.map(Number).includes(weekday)) {
    return `O turno ${employee.shift_name} de ${employee.name} não é válido às ${WEEKDAYS[weekday]}s.`;
  }
  return null;
};

// GET /presence?date=  |  ?from=&to=  |  ?id_employee=  (combináveis)
const getAttendance = async (req, res) => {
  const { date, id_employee: idEmployee } = req.query;
  const from = req.query.from ?? date;
  const to = req.query.to ?? date;

  try {
    if (idEmployee !== undefined && !validate.isPositiveInt(idEmployee)) {
      return res.status(400).json({ message: "ID de funcionário inválido." });
    }

    if (from === undefined && to === undefined) {
      if (idEmployee === undefined) {
        return res.status(400).json({ message: "Informe uma data, um período ou um funcionário." });
      }
      const result = await db.query(q.qSelectAttendanceByEmployee, [Number(idEmployee)]);
      return res.status(200).json({ attendance: result.rows });
    }

    if (!validate.validateDate(from) || !validate.validateDate(to) || from > to) {
      return res.status(400).json({ message: "Período inválido. Use AAAA-MM-DD." });
    }
    if (daysBetween(from, to) > MAX_PERIOD_DAYS) {
      return res.status(400).json({ message: `O período máximo de consulta é de ${MAX_PERIOD_DAYS} dias.` });
    }

    const result = await db.query(q.qSelectAttendanceByPeriod, [
      from,
      to,
      idEmployee === undefined ? null : Number(idEmployee),
    ]);
    return res.status(200).json({ attendance: result.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao consultar presença." });
  }
};

/**
 * Cria ou atualiza a presença.
 * Aceita { id, id_attendance_status, observation } (edição por ID) ou
 * { id_employee, date, id_attendance_status, observation } (upsert por funcionário + data).
 * POST e PUT usam a mesma regra.
 */
const saveAttendance = async (req, res) => {
  const { id, id_attendance_status: idStatus, observation } = req.body || {};
  const userId = Number(req.userId);

  if (!validate.isPositiveInt(idStatus)) {
    return res.status(400).json({ message: "Selecione um status de presença válido." });
  }
  if (observation != null && (typeof observation !== "string" || observation.length > 255)) {
    return res.status(400).json({ message: "A observação deve ter no máximo 255 caracteres." });
  }

  try {
    const { rows: statusRows } = await db.query(q.qSelectAttendanceStatusById, [Number(idStatus)]);
    if (!statusRows.length) return res.status(400).json({ message: "Status de presença não encontrado." });

    let idEmployee = req.body.id_employee;
    let date = req.body.date;
    let existingId = null;

    if (id !== undefined && id !== null && id !== "") {
      if (!validate.isPositiveInt(id)) return res.status(400).json({ message: "ID de presença inválido." });
      const { rows } = await db.query(q.qSelectAttendanceById, [Number(id)]);
      if (!rows.length) return res.status(404).json({ message: "Registro de presença não encontrado." });
      existingId = rows[0].id;
      idEmployee = rows[0].id_employee;
      date = rows[0].date;
    }

    if (!validate.isPositiveInt(idEmployee) || !validate.validateDate(date)) {
      return res.status(400).json({ message: "Informe o funcionário e a data (AAAA-MM-DD)." });
    }

    const { rows: employees } = await db.query(q.qSelectAttendanceEmployeeById, [Number(idEmployee)]);
    if (!employees.length) return res.status(404).json({ message: "Funcionário não encontrado." });

    const ruleError = validateAttendanceRules(employees[0], date);
    if (ruleError) return res.status(422).json({ message: ruleError });

    if (existingId === null) {
      const { rows: existing } = await db.query(q.qSelectAttendanceByEmployeeAndDate, [Number(idEmployee), date]);
      existingId = existing[0]?.id ?? null;
    }

    const note = typeof observation === "string" ? observation.trim() || null : null;

    if (existingId !== null) {
      await db.query(q.qUpdateAttendance, [Number(idStatus), note, userId, existingId]);
      return res.status(200).json({
        message: "Presença atualizada com sucesso.",
        attendance: { id: existingId, id_employee: Number(idEmployee), date, id_attendance_status: Number(idStatus) },
      });
    }

    const { rows } = await db.query(q.qAddAttendance, [Number(idEmployee), Number(idStatus), date, note, userId]);
    return res.status(201).json({
      message: "Presença registrada com sucesso.",
      attendance: { id: rows[0].id, id_employee: Number(idEmployee), date, id_attendance_status: Number(idStatus) },
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Já existe presença registrada para este funcionário nesta data." });
    }
    if (err.code === "23503") {
      return res.status(400).json({ message: "Uma das referências informadas não existe." });
    }
    console.error(err);
    return res.status(500).json({ message: "Erro ao salvar presença." });
  }
};

// DELETE /presence/:id  -> volta a célula para "Não informado"
const deleteAttendance = async (req, res) => {
  if (!validate.isPositiveInt(req.params.id)) return res.status(400).json({ message: "ID inválido." });

  try {
    const { rows } = await db.query(q.qDeleteAttendance, [Number(req.params.id)]);
    if (!rows.length) return res.status(404).json({ message: "Registro de presença não encontrado." });
    return res.status(200).json({ message: "Registro de presença removido." });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({ message: "Este registro possui solicitações de alteração vinculadas." });
    }
    console.error(err);
    return res.status(500).json({ message: "Erro ao remover presença." });
  }
};

// POST /presence/all  { date } ou { from, to }
// Marca "Presente" para funcionários ativos, já admitidos e com turno válido no dia,
// sem sobrescrever registros existentes.
const markAllPresent = async (req, res) => {
  const from = req.body?.from ?? req.body?.date;
  const to = req.body?.to ?? req.body?.date;
  const userId = Number(req.userId);

  if (!validate.validateDate(from) || !validate.validateDate(to) || from > to) {
    return res.status(400).json({ message: "Informe uma data ou um período válido." });
  }
  if (daysBetween(from, to) > MAX_PERIOD_DAYS) {
    return res.status(400).json({ message: `O período máximo é de ${MAX_PERIOD_DAYS} dias.` });
  }

  try {
    const { rows: statusRows } = await db.query(q.qSelectPresentStatus);
    if (!statusRows.length) {
      return res.status(500).json({ message: "O status 'Presente' não está cadastrado." });
    }

    let registeredCount = 0;
    await db.withTransaction(async (client) => {
      const cursor = new Date(`${from}T12:00:00Z`);
      const end = new Date(`${to}T12:00:00Z`);
      while (cursor <= end) {
        const day = cursor.toISOString().slice(0, 10);
        const { rowCount } = await client.query(q.qMarkAllEmployeesPresent, [day, userId, statusRows[0].id]);
        registeredCount += rowCount;
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    });

    return res.status(200).json({
      message:
        registeredCount > 0
          ? `${registeredCount} presença(s) registrada(s).`
          : "Nenhuma presença nova: os dias já estavam preenchidos ou fora da escala.",
      registeredCount,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao registrar presença." });
  }
};

module.exports = {
  getAttendance,
  addAttendance: saveAttendance,
  updateAttendance: saveAttendance,
  deleteAttendance,
  markAllPresent,
  validateAttendanceRules,
};
