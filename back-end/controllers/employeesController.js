// Controller file for employee related queries

const db = require("../db");
const { queries: q } = require("./queries/queries");
const validate = require("../helpers/dataValidation");

const optionalText = (value, max) => {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== "string" && typeof value !== "number") return { error: true };
  const text = String(value).trim();
  if (!text) return { value: null };
  if (text.length > max) return { error: true };
  return { value: text };
};

/** Valida e normaliza o corpo de criação/edição. */
const parseEmployeeBody = async (body) => {
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (!validate.validateName(name)) {
    return { error: "Informe um nome válido (somente letras, 3 a 80 caracteres)." };
  }
  if (!validate.isPositiveInt(body.id_position)) return { error: "Selecione o cargo." };
  if (!validate.isPositiveInt(body.id_shift)) return { error: "Selecione o turno." };

  const idSector =
    body.id_sector === undefined || body.id_sector === null || body.id_sector === ""
      ? null
      : Number(body.id_sector);
  if (idSector !== null && !validate.isPositiveInt(idSector)) return { error: "Setor inválido." };

  if (!validate.validateDate(body.date_admission)) {
    return { error: "Informe a data de admissão/início no formato AAAA-MM-DD." };
  }

  const code = optionalText(body.code_employee, 15);
  const login = optionalText(body.login_main_system, 15);
  if (code.error) return { error: "A matrícula deve ter no máximo 15 caracteres." };
  if (login.error) return { error: "O usuário JMS deve ter no máximo 15 caracteres." };

  const [position, shift, sector] = await Promise.all([
    db.query(q.qSelectPositionById, [Number(body.id_position)]),
    db.query(q.qSelectShiftById, [Number(body.id_shift)]),
    idSector === null ? null : db.query(q.qSelectSectorById, [idSector]),
  ]);
  if (!position.rowCount) return { error: "Cargo não encontrado." };
  if (!shift.rowCount) return { error: "Turno não encontrado." };
  if (sector && !sector.rowCount) return { error: "Setor não encontrado." };

  return {
    value: {
      name,
      idPosition: Number(body.id_position),
      code: code.value,
      login: login.value,
      idSector,
      idShift: Number(body.id_shift),
      dateAdmission: body.date_admission,
    },
  };
};

const getAllEmployees = async (req, res) => {
  try {
    const { rows } = await db.query(q.qSelectEmployees);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao buscar funcionários." });
  }
};

const getEmployeeByID = async (req, res) => {
  if (!validate.isPositiveInt(req.params.id)) return res.status(400).json({ message: "ID inválido." });

  try {
    const { rows } = await db.query(q.qSelectEmployeeFullById, [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ message: "Funcionário não encontrado." });
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao buscar funcionário." });
  }
};

const addEmployee = async (req, res) => {
  const userId = Number(req.userId);

  try {
    const parsed = await parseEmployeeBody(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const statusActive =
      req.body.status_active === undefined ? true : validate.parseBoolean(req.body.status_active);
    if (statusActive === null) return res.status(400).json({ message: "Status inválido." });

    const v = parsed.value;
    const { rows } = await db.query(q.qAddEmployee, [
      v.name,
      v.idPosition,
      v.code,
      v.login,
      v.idSector,
      v.idShift,
      statusActive,
      v.dateAdmission,
      userId,
    ]);
    const { rows: created } = await db.query(q.qSelectEmployeeById, [rows[0].id]);

    return res.status(201).json({ message: "Funcionário cadastrado com sucesso.", employee: created[0] });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(400).json({ message: "Cargo, setor ou turno não encontrado." });
    }
    console.error(err);
    return res.status(500).json({ message: "Erro ao cadastrar funcionário." });
  }
};

const updateEmployee = async (req, res) => {
  const id = req.body?.id;
  if (!validate.isPositiveInt(id)) return res.status(400).json({ message: "ID de funcionário inválido." });

  try {
    const { rows: current } = await db.query(q.qSelectEmployeeById, [Number(id)]);
    if (!current[0]) return res.status(404).json({ message: "Funcionário não encontrado." });

    const parsed = await parseEmployeeBody(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const v = parsed.value;

    // A admissão não pode ficar posterior a registros de presença já existentes
    const { rows: first } = await db.query(q.qSelectEmployeeFirstAttendanceDate, [Number(id)]);
    if (first[0]?.first_date && v.dateAdmission > first[0].first_date) {
      return res.status(409).json({
        message: `Já existem presenças registradas a partir de ${first[0].first_date}. A data de admissão não pode ser posterior a essa data.`,
      });
    }

    const statusActive =
      req.body.status_active === undefined ? null : validate.parseBoolean(req.body.status_active);
    if (req.body.status_active !== undefined && statusActive === null) {
      return res.status(400).json({ message: "Status inválido." });
    }

    await db.withTransaction(async (client) => {
      await client.query(q.qUpdateEmployee, [
        v.name,
        v.idPosition,
        v.code,
        v.login,
        v.idSector,
        v.idShift,
        v.dateAdmission,
        Number(req.userId),
        Number(id),
      ]);
      if (statusActive !== null) {
        await client.query(q.qUpdateEmployeeStatus, [statusActive, Number(req.userId), Number(id)]);
      }
    });

    const { rows: updated } = await db.query(q.qSelectEmployeeById, [Number(id)]);
    return res.status(200).json({ message: "Dados do funcionário atualizados.", employee: updated[0] });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(400).json({ message: "Cargo, setor ou turno não encontrado." });
    }
    console.error(err);
    return res.status(500).json({ message: "Erro ao atualizar funcionário." });
  }
};

// PUT /employees/:id/status  { status_active: boolean }
const setEmployeeStatus = async (req, res) => {
  const id = req.params.id;
  if (!validate.isPositiveInt(id)) return res.status(400).json({ message: "ID de funcionário inválido." });

  // A rota legada PUT /employees/:id/:id_user apenas desativava
  const requested =
    req.body && req.body.status_active !== undefined
      ? validate.parseBoolean(req.body.status_active)
      : req.params.id_user
        ? false
        : null;
  if (requested === null) return res.status(400).json({ message: "Informe status_active (true ou false)." });

  try {
    // O usuário responsável é sempre o da sessão, nunca um ID vindo da URL
    const { rows } = await db.query(q.qUpdateEmployeeStatus, [requested, Number(req.userId), Number(id)]);
    if (!rows.length) return res.status(404).json({ message: "Funcionário não encontrado." });

    return res.status(200).json({
      message: requested ? "Funcionário ativado." : "Funcionário desativado.",
      status_active: requested,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao alterar status do funcionário." });
  }
};

const deleteEmployee = async (req, res) => {
  const id = req.params.id;
  if (!validate.isPositiveInt(id)) return res.status(400).json({ message: "ID de funcionário inválido." });

  try {
    const { rows: refs } = await db.query(q.qSelectEmployeeReferences, [Number(id)]);
    if (refs[0].attendance > 0 || refs[0].equipment_use > 0) {
      return res.status(409).json({
        message:
          "Este funcionário possui histórico de presença ou de uso de equipamentos e não pode ser excluído. Altere o status para Inativo.",
      });
    }

    const { rows } = await db.query(q.qDeleteEmployee, [Number(id)]);
    if (!rows.length) return res.status(404).json({ message: "Funcionário não encontrado." });
    return res.status(200).json({ message: "Funcionário excluído." });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({
        message: "Este funcionário possui registros vinculados e não pode ser excluído. Altere o status para Inativo.",
      });
    }
    console.error(err);
    return res.status(500).json({ message: "Erro ao excluir funcionário." });
  }
};

module.exports = {
  getAllEmployees,
  getEmployeeByID,
  addEmployee,
  updateEmployee,
  setEmployeeStatus,
  deactivateEmployee: setEmployeeStatus,
  deleteEmployee,
};
