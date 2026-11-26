// Controller file for equipment related queries

const db = require("../db");
const { queries: q } = require("./queries/queries");
const validate = require("../helpers/dataValidation");
const { STATUS_IN_USE } = require("./equipmentStatusHelpers");

const sendError = (res, status, message) => res.status(status).json({ message });

/** Valida e normaliza os campos comuns de criação/edição. */
const parseEquipmentBody = async (body) => {
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const heritageCode = typeof body?.heritage_code === "string" ? body.heritage_code.trim() : "";
  const observation =
    typeof body?.observation === "string" ? body.observation.trim() || null : null;
  const idSector =
    body?.id_sector === "" || body?.id_sector === undefined || body?.id_sector === null
      ? null
      : Number(body.id_sector);

  if (!validate.validateLabel(name, 40)) return { error: "Informe um nome válido (2 a 40 caracteres)." };
  if (!validate.isPositiveInt(body.id_equipment_type)) return { error: "Selecione o tipo do equipamento." };
  if (!heritageCode || heritageCode.length > 20) {
    return { error: "Informe o código patrimonial (até 20 caracteres)." };
  }
  if (observation !== null && observation.length > 20) {
    return { error: "A observação deve ter no máximo 20 caracteres." };
  }
  if (idSector !== null && !validate.isPositiveInt(idSector)) return { error: "Setor inválido." };

  const { rows: typeRows } = await db.query(q.qSelectEquipmentTypeById, [Number(body.id_equipment_type)]);
  if (!typeRows.length) return { error: "Tipo de equipamento não encontrado." };

  if (idSector !== null) {
    const { rows: sectorRows } = await db.query(q.qSelectSectorById, [idSector]);
    if (!sectorRows.length) return { error: "Setor não encontrado." };
  }

  return {
    value: { name, idType: Number(body.id_equipment_type), heritageCode, idSector, observation },
  };
};

/** Valida um status escolhido manualmente ("Em uso" só é definido por empréstimos). */
const resolveManualStatus = async (idStatus) => {
  if (!validate.isPositiveInt(idStatus)) return { error: "Selecione o status do equipamento." };
  const { rows } = await db.query(q.qSelectEquipmentStatusById, [Number(idStatus)]);
  if (!rows.length) return { error: "Status de equipamento não encontrado." };
  if (rows[0].name === STATUS_IN_USE) {
    return {
      error: 'O status "Em uso" é definido automaticamente ao registrar um empréstimo em Uso de Equipamentos.',
    };
  }
  return { value: rows[0] };
};

const getAllEquipment = async (req, res) => {
  try {
    const { rows } = await db.query(q.qSelectAllEquipment);
    return res.status(200).json({ equipment: rows });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Erro ao listar equipamentos.");
  }
};

const getEquipmentByID = async (req, res) => {
  if (!validate.isPositiveInt(req.params.id)) return sendError(res, 400, "ID inválido.");

  try {
    const { rows } = await db.query(q.qSelectEquipmentById, [Number(req.params.id)]);
    if (!rows.length) return sendError(res, 404, "Equipamento não encontrado.");
    return res.status(200).json({ equipment: rows[0] });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Erro ao buscar equipamento.");
  }
};

const addEquipment = async (req, res) => {
  try {
    const parsed = await parseEquipmentBody(req.body);
    if (parsed.error) return sendError(res, 400, parsed.error);

    const status = await resolveManualStatus(req.body.id_equipment_status);
    if (status.error) return sendError(res, 400, status.error);

    const v = parsed.value;
    const { rows: dup } = await db.query(q.qCheckDuplicateHeritageCode, [v.heritageCode, -1]);
    if (dup.length) return sendError(res, 409, "Código patrimonial já cadastrado.");

    const { rows } = await db.query(q.qAddEquipment, [
      v.name,
      v.idType,
      status.value.id,
      v.heritageCode,
      v.idSector,
      v.observation,
      Number(req.userId),
    ]);
    const { rows: created } = await db.query(q.qSelectEquipmentById, [rows[0].id]);

    return res.status(201).json({ message: "Equipamento cadastrado com sucesso.", equipment: created[0] });
  } catch (err) {
    if (err.code === "23505") return sendError(res, 409, "Código patrimonial já cadastrado.");
    if (err.code === "23503") return sendError(res, 400, "Uma das referências informadas não existe.");
    console.error(err);
    return sendError(res, 500, "Erro ao cadastrar equipamento.");
  }
};

// Atualiza dados cadastrais; se id_equipment_status vier no corpo, também altera o status
const updateEquipment = async (req, res) => {
  const id = req.body?.id;
  if (!validate.isPositiveInt(id)) return sendError(res, 400, "ID de equipamento inválido.");

  try {
    const { rows: current } = await db.query(q.qSelectEquipmentById, [Number(id)]);
    if (!current.length) return sendError(res, 404, "Equipamento não encontrado.");

    const parsed = await parseEquipmentBody(req.body);
    if (parsed.error) return sendError(res, 400, parsed.error);
    const v = parsed.value;

    let newStatusId = null;
    if (
      req.body.id_equipment_status !== undefined &&
      req.body.id_equipment_status !== null &&
      Number(req.body.id_equipment_status) !== Number(current[0].id_equipment_status)
    ) {
      if (current[0].open_use_id) {
        return sendError(res, 409, "Registre a devolução do equipamento antes de alterar o status.");
      }
      const status = await resolveManualStatus(req.body.id_equipment_status);
      if (status.error) return sendError(res, 400, status.error);
      newStatusId = status.value.id;
    }

    const { rows: dup } = await db.query(q.qCheckDuplicateHeritageCode, [v.heritageCode, Number(id)]);
    if (dup.length) return sendError(res, 409, "Código patrimonial já cadastrado.");

    await db.withTransaction(async (client) => {
      await client.query(q.qUpdateEquipment, [
        v.name,
        v.idType,
        v.heritageCode,
        v.idSector,
        v.observation,
        Number(req.userId),
        Number(id),
      ]);
      if (newStatusId !== null) {
        await client.query(q.qUpdateEquipmentStatus, [newStatusId, Number(req.userId), Number(id)]);
      }
    });

    const { rows: updated } = await db.query(q.qSelectEquipmentById, [Number(id)]);
    return res.status(200).json({ message: "Equipamento atualizado com sucesso.", equipment: updated[0] });
  } catch (err) {
    if (err.code === "23505") return sendError(res, 409, "Código patrimonial já cadastrado.");
    if (err.code === "23503") return sendError(res, 400, "Uma das referências informadas não existe.");
    console.error(err);
    return sendError(res, 500, "Erro ao atualizar equipamento.");
  }
};

// PUT /equipments/status  { id, id_equipment_status }
const updateEquipmentStatus = async (req, res) => {
  const { id, id_equipment_status } = req.body || {};
  if (!validate.isPositiveInt(id)) return sendError(res, 400, "ID de equipamento inválido.");

  try {
    const { rows: current } = await db.query(q.qSelectEquipmentById, [Number(id)]);
    if (!current.length) return sendError(res, 404, "Equipamento não encontrado.");
    if (current[0].open_use_id) {
      return sendError(res, 409, "Registre a devolução do equipamento antes de alterar o status.");
    }

    const status = await resolveManualStatus(id_equipment_status);
    if (status.error) return sendError(res, 400, status.error);

    await db.query(q.qUpdateEquipmentStatus, [status.value.id, Number(req.userId), Number(id)]);
    const { rows } = await db.query(q.qSelectEquipmentById, [Number(id)]);
    return res.status(200).json({ message: "Status do equipamento atualizado.", equipment: rows[0] });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Erro ao atualizar status do equipamento.");
  }
};

// DELETE /equipments/:id
// Sem histórico de uso: exclusão física. Com histórico: exclusão lógica (o
// equipamento some das listagens, mas o histórico de empréstimos é preservado).
const deleteEquipment = async (req, res) => {
  const id = req.params.id;
  if (!validate.isPositiveInt(id)) return sendError(res, 400, "ID de equipamento inválido.");

  try {
    const result = await db.withTransaction(async (client) => {
      const { rows } = await client.query(q.qLockEquipment, [Number(id)]);
      if (!rows.length || rows[0].date_deleted) return { status: 404 };

      const { rows: open } = await client.query(q.qSelectOpenUseByEquipment, [Number(id), null]);
      if (open.length) return { status: 409 };

      const { rows: uses } = await client.query(q.qSelectEquipmentUseCount, [Number(id)]);
      if (uses[0].total > 0) {
        await client.query(q.qSoftDeleteEquipment, [Number(req.userId), Number(id)]);
        return { status: 200, logical: true };
      }

      await client.query(q.qDeleteEquipment, [Number(id)]);
      return { status: 200, logical: false };
    });

    if (result.status === 404) return sendError(res, 404, "Equipamento não encontrado.");
    if (result.status === 409) {
      return sendError(res, 409, "O equipamento está em uso. Registre a devolução antes de excluí-lo.");
    }

    return res.status(200).json({
      message: result.logical
        ? "Equipamento excluído. O histórico de uso foi preservado."
        : "Equipamento excluído.",
      logical: result.logical,
    });
  } catch (err) {
    if (err.code === "23503") {
      return sendError(res, 409, "O equipamento possui registros vinculados e não pode ser excluído.");
    }
    console.error(err);
    return sendError(res, 500, "Erro ao excluir equipamento.");
  }
};

// GET /equipments/:id/history
const getEquipmentHistory = async (req, res) => {
  if (!validate.isPositiveInt(req.params.id)) return sendError(res, 400, "ID inválido.");
  try {
    const { rows } = await db.query(q.qSelectEquipmentUsesByEquipment, [Number(req.params.id)]);
    return res.status(200).json({ uses: rows });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Erro ao buscar histórico do equipamento.");
  }
};

module.exports = {
  getAllEquipment,
  getEquipmentByID,
  addEquipment,
  updateEquipment,
  updateEquipmentStatus,
  deleteEquipment,
  getEquipmentHistory,
};
