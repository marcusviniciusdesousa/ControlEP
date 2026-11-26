// Controller file for shift related queries

const db = require("../db");
const { queries: q } = require("./queries/queries");
const validate = require("../helpers/dataValidation");

const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const normalizeTime = (value) => (typeof value === "string" ? value.slice(0, 5) : value);

/** Valida o corpo de criação/edição e devolve os dados normalizados ou uma mensagem de erro. */
const parseShiftBody = (body) => {
  const { name } = body || {};
  const hourStart = normalizeTime(body?.hour_start);
  const hourEnd = normalizeTime(body?.hour_end);

  if (typeof name !== "string" || !validate.validateLabel(name, 30)) {
    return { error: "Informe um nome de turno válido (2 a 30 caracteres)." };
  }
  if (!validate.validateTime(hourStart) || !validate.validateTime(hourEnd)) {
    return { error: "Informe horários de início e término válidos (HH:MM)." };
  }
  if (hourStart === hourEnd) {
    return { error: "O horário de término deve ser diferente do horário de início." };
  }

  // Compatibilidade: clientes antigos não enviam os dias -> todos os dias
  const days =
    body.days_of_week === undefined
      ? [0, 1, 2, 3, 4, 5, 6]
      : validate.normalizeDaysOfWeek(body.days_of_week);
  if (!days) {
    return { error: "Selecione ao menos um dia da semana válido para o turno." };
  }

  return { value: { name: name.trim().replace(/\s+/g, " "), hourStart, hourEnd, days } };
};

/** Verifica unicidade de nome e de horário, ignorando o próprio turno na edição. */
const findConflict = async ({ name, hourStart, hourEnd }, ignoreId = null) => {
  const byName = await db.query(q.qSelectShiftByNameExceptId, [name, ignoreId ?? -1]);
  if (byName.rowCount > 0) return "Já existe um turno com esse nome.";

  const byHours = await db.query(q.qSelectShiftByHoursExceptId, [hourStart, hourEnd, ignoreId ?? -1]);
  if (byHours.rowCount > 0) {
    return `Já existe um turno com o mesmo horário de início e término (${byHours.rows[0].name}).`;
  }
  return null;
};

const uniqueViolationMessage = (error) =>
  error.constraint === "uq_shift_hours"
    ? "Já existe um turno com o mesmo horário de início e término."
    : "Já existe um turno com esse nome.";

const getAllShifts = async (req, res) => {
  try {
    const result = await db.query(q.qSelectShifts);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Erro ao listar turnos:", error);
    return res.status(500).json({ message: "Não foi possível recuperar os turnos." });
  }
};

const addShift = async (req, res) => {
  const parsed = parseShiftBody(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });

  try {
    const conflict = await findConflict(parsed.value);
    if (conflict) return res.status(409).json({ message: conflict });

    const { name, hourStart, hourEnd, days } = parsed.value;
    const result = await db.query(q.qAddShift, [name, hourStart, hourEnd, days]);

    return res.status(201).json({ message: "Turno registrado.", shift: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ message: uniqueViolationMessage(error) });
    console.error("Erro ao registrar turno:", error);
    return res.status(500).json({ message: "Não foi possível registrar o turno." });
  }
};

const updateShift = async (req, res) => {
  const id = req.body?.id;
  if (!validate.isPositiveInt(id)) return res.status(400).json({ message: "ID de turno inválido." });

  const parsed = parseShiftBody(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });

  const shiftId = Number(id);

  try {
    const existingShift = await db.query(q.qSelectShiftById, [shiftId]);
    if (existingShift.rowCount === 0) return res.status(404).json({ message: "Turno não encontrado." });

    const conflict = await findConflict(parsed.value, shiftId);
    if (conflict) return res.status(409).json({ message: conflict });

    const { name, hourStart, hourEnd, days } = parsed.value;
    const result = await db.query(q.qUpdateShift, [name, hourStart, hourEnd, days, shiftId]);

    return res.status(200).json({ message: "Turno atualizado.", shift: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ message: uniqueViolationMessage(error) });
    console.error("Erro ao atualizar turno:", error);
    return res.status(500).json({ message: "Não foi possível atualizar o turno." });
  }
};

const deleteShift = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "ID inválido." });

  try {
    const existingShift = await db.query(q.qSelectShiftById, [id]);
    if (existingShift.rowCount === 0) return res.status(404).json({ message: "Turno não encontrado." });

    const usage = await db.query(q.qSelectShiftEmployeeUsage, [id]);
    if (usage.rows[0].total > 0) {
      return res.status(409).json({
        message: `Não é possível excluir: ${usage.rows[0].total} funcionário(s) vinculado(s) a este turno.`,
      });
    }

    const result = await db.query(q.qDeleteShift, [id]);
    return res.status(200).json({ message: "Turno excluído.", shift: result.rows[0] });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({ message: "Não é possível excluir um turno com funcionários associados." });
    }
    console.error("Erro ao deletar turno:", error);
    return res.status(500).json({ message: "Não foi possível excluir o turno." });
  }
};

module.exports = { getAllShifts, addShift, updateShift, deleteShift, WEEKDAY_NAMES };
