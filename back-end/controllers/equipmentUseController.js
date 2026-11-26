// Controller de uso/empréstimo de equipamentos (tabela equipment_use).
// Toda alteração roda em transação e sincroniza o status do equipamento.

const db = require("../db");
const { queries: q } = require("./queries/queries");
const validate = require("../helpers/dataValidation");
const { isBlockingStatus, syncEquipmentStatus } = require("./equipmentStatusHelpers");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const parseTimestamp = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const optionalId = (value) =>
  value === undefined || value === null || value === "" ? null : validate.isPositiveInt(value) ? Number(value) : undefined;

const handleError = (res, err, fallback) => {
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err.code === "23505") {
    return res.status(409).json({ message: "Este equipamento já possui um empréstimo em aberto." });
  }
  if (err.code === "23514") {
    return res.status(400).json({ message: "A devolução deve ser igual ou posterior ao início." });
  }
  if (err.code === "23503") {
    return res.status(409).json({ message: "O registro possui vínculos (ex.: solicitações de alteração) e não pode ser removido." });
  }
  console.error(err);
  return res.status(500).json({ message: fallback });
};

/** Valida o corpo de criação/edição e as regras de negócio. */
const validateUse = async (client, body, currentId = null) => {
  const idEquipment = Number(body?.id_equipment);
  const idEmployee = Number(body?.id_employee);
  const start = parseTimestamp(body?.date_start) ?? (currentId ? undefined : new Date());
  const end = parseTimestamp(body?.date_return);
  const observation = typeof body?.observation === "string" ? body.observation.trim() || null : null;

  if (!validate.isPositiveInt(idEquipment)) throw new HttpError(400, "Selecione o equipamento.");
  if (!validate.isPositiveInt(idEmployee)) throw new HttpError(400, "Selecione o funcionário.");
  if (!start) throw new HttpError(400, "Informe uma data/hora de início válida.");
  if (end === undefined) throw new HttpError(400, "Informe uma data/hora de devolução válida.");
  if (end && end < start) throw new HttpError(400, "A devolução deve ser igual ou posterior ao início.");
  if (start > new Date(Date.now() + 5 * 60 * 1000)) {
    throw new HttpError(400, "O início do uso não pode estar no futuro.");
  }
  if (observation && observation.length > 255) {
    throw new HttpError(400, "A observação deve ter no máximo 255 caracteres.");
  }

  const { rows: equipmentRows } = await client.query(q.qLockEquipment, [idEquipment]);
  const equipment = equipmentRows[0];
  if (!equipment || equipment.date_deleted) throw new HttpError(404, "Equipamento não encontrado.");

  const { rows: employeeRows } = await client.query(q.qSelectAttendanceEmployeeById, [idEmployee]);
  const employee = employeeRows[0];
  if (!employee) throw new HttpError(404, "Funcionário não encontrado.");

  // Um novo empréstimo em aberto exige equipamento utilizável e funcionário ativo
  if (!end) {
    if (!employee.status_active) {
      throw new HttpError(409, "Funcionário inativo não pode receber equipamentos.");
    }
    if (isBlockingStatus(equipment.equipment_status)) {
      throw new HttpError(409, `O equipamento está com status "${equipment.equipment_status}" e não pode ser emprestado.`);
    }
    const { rows: open } = await client.query(q.qSelectOpenUseByEquipment, [idEquipment, currentId]);
    if (open.length) throw new HttpError(409, "Este equipamento já possui um empréstimo em aberto.");
  }

  // Períodos do mesmo equipamento não podem se sobrepor
  const { rows: overlap } = await client.query(q.qSelectOverlappingUse, [idEquipment, start, end, currentId]);
  if (overlap.length) {
    throw new HttpError(409, "Já existe outro registro de uso deste equipamento nesse período.");
  }

  return { idEquipment, idEmployee, start, end, observation };
};

// GET /equipment-uses?from=AAAA-MM-DD&to=AAAA-MM-DD&id_equipment=&id_employee=
const getEquipmentUses = async (req, res) => {
  const { from, to } = req.query;
  const idEquipment = optionalId(req.query.id_equipment);
  const idEmployee = optionalId(req.query.id_employee);

  if ((from && !validate.validateDate(from)) || (to && !validate.validateDate(to)) || (from && to && from > to)) {
    return res.status(400).json({ message: "Período inválido." });
  }
  if (idEquipment === undefined || idEmployee === undefined) {
    return res.status(400).json({ message: "Filtro inválido." });
  }

  try {
    const { rows } = await db.query(q.qSelectEquipmentUses, [to || null, from || null, idEquipment, idEmployee]);
    return res.status(200).json({ uses: rows });
  } catch (err) {
    return handleError(res, err, "Erro ao listar usos de equipamentos.");
  }
};

// POST /equipment-uses  { id_equipment, id_employee, date_start?, date_return?, observation? }
const addEquipmentUse = async (req, res) => {
  try {
    const id = await db.withTransaction(async (client) => {
      const v = await validateUse(client, req.body);
      const { rows } = await client.query(q.qAddEquipmentUse, [
        v.idEmployee,
        v.idEquipment,
        v.start,
        v.end,
        v.observation,
        Number(req.userId),
      ]);
      await syncEquipmentStatus(client, v.idEquipment, Number(req.userId));
      return rows[0].id;
    });

    const { rows } = await db.query(q.qSelectEquipmentUseById, [id]);
    return res.status(201).json({ message: "Uso registrado.", use: rows[0] });
  } catch (err) {
    return handleError(res, err, "Erro ao registrar uso do equipamento.");
  }
};

// PUT /equipment-uses/:id  (edição completa)
const updateEquipmentUse = async (req, res) => {
  const id = req.params.id;
  if (!validate.isPositiveInt(id)) return res.status(400).json({ message: "ID inválido." });

  try {
    await db.withTransaction(async (client) => {
      const { rows } = await client.query(q.qLockEquipmentUse, [Number(id)]);
      const current = rows[0];
      if (!current) throw new HttpError(404, "Registro de uso não encontrado.");

      const v = await validateUse(
        client,
        { ...req.body, date_start: req.body?.date_start ?? current.date_start.toISOString() },
        Number(id),
      );
      await client.query(q.qUpdateEquipmentUse, [
        v.idEmployee,
        v.idEquipment,
        v.start,
        v.end,
        v.observation,
        Number(req.userId),
        Number(id),
      ]);

      await syncEquipmentStatus(client, v.idEquipment, Number(req.userId));
      if (current.id_equipment !== v.idEquipment) {
        await syncEquipmentStatus(client, current.id_equipment, Number(req.userId));
      }
    });

    const { rows } = await db.query(q.qSelectEquipmentUseById, [Number(id)]);
    return res.status(200).json({ message: "Registro de uso atualizado.", use: rows[0] });
  } catch (err) {
    return handleError(res, err, "Erro ao atualizar uso do equipamento.");
  }
};

// PUT /equipment-uses/:id/return  { date_return? }  (padrão: agora)
const returnEquipmentUse = async (req, res) => {
  const id = req.params.id;
  if (!validate.isPositiveInt(id)) return res.status(400).json({ message: "ID inválido." });

  const returnDate = parseTimestamp(req.body?.date_return) ?? new Date();
  if (returnDate === undefined) return res.status(400).json({ message: "Data de devolução inválida." });

  try {
    await db.withTransaction(async (client) => {
      const { rows } = await client.query(q.qLockEquipmentUse, [Number(id)]);
      const current = rows[0];
      if (!current) throw new HttpError(404, "Registro de uso não encontrado.");
      if (current.date_return) throw new HttpError(409, "Este equipamento já foi devolvido.");
      if (returnDate < current.date_start) {
        throw new HttpError(400, "A devolução deve ser igual ou posterior ao início.");
      }

      await client.query(q.qReturnEquipmentUse, [returnDate, Number(req.userId), Number(id)]);
      await syncEquipmentStatus(client, current.id_equipment, Number(req.userId));
    });

    const { rows } = await db.query(q.qSelectEquipmentUseById, [Number(id)]);
    return res.status(200).json({ message: "Devolução registrada.", use: rows[0] });
  } catch (err) {
    return handleError(res, err, "Erro ao registrar devolução.");
  }
};

// DELETE /equipment-uses/:id  (correção de lançamento indevido)
const deleteEquipmentUse = async (req, res) => {
  const id = req.params.id;
  if (!validate.isPositiveInt(id)) return res.status(400).json({ message: "ID inválido." });

  try {
    await db.withTransaction(async (client) => {
      const { rows } = await client.query(q.qDeleteEquipmentUse, [Number(id)]);
      if (!rows.length) throw new HttpError(404, "Registro de uso não encontrado.");
      await syncEquipmentStatus(client, rows[0].id_equipment, Number(req.userId));
    });
    return res.status(200).json({ message: "Registro de uso excluído." });
  } catch (err) {
    return handleError(res, err, "Erro ao excluir registro de uso.");
  }
};

module.exports = {
  getEquipmentUses,
  addEquipmentUse,
  updateEquipmentUse,
  returnEquipmentUse,
  deleteEquipmentUse,
};
