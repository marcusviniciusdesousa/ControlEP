// Regras compartilhadas entre equipamentos e empréstimos (uso de equipamentos).
//
// "Em uso" é um status derivado: um equipamento está em uso se, e somente se,
// existe um registro de equipment_use sem data de devolução. Os demais status
// (Disponível, Manutenção, Inativo...) são definidos manualmente.

const { queries: q } = require("./queries/queries");

const STATUS_IN_USE = "Em uso";
const STATUS_AVAILABLE = "Disponível";

// Status que impedem um novo empréstimo
const BLOCKING_STATUSES = ["manutenção", "manutencao", "inativo", "baixado", "descartado"];

const isBlockingStatus = (name) => BLOCKING_STATUSES.includes(String(name || "").trim().toLowerCase());

const getStatusId = async (client, name) => {
  const { rows } = await client.query(q.qSelectEquipmentStatusByName, [name]);
  if (!rows.length) {
    const error = new Error(`O status de equipamento "${name}" não está cadastrado.`);
    error.status = 500;
    throw error;
  }
  return rows[0].id;
};

/**
 * Ajusta id_equipment_status conforme a existência de empréstimo em aberto.
 * Deve ser chamada dentro de uma transação, após inserir/alterar/remover usos.
 */
const syncEquipmentStatus = async (client, idEquipment, userId) => {
  const { rows: equipmentRows } = await client.query(q.qLockEquipment, [idEquipment]);
  const equipment = equipmentRows[0];
  if (!equipment) return;

  const { rows: openRows } = await client.query(q.qSelectOpenUseByEquipment, [idEquipment, null]);
  const inUseId = await getStatusId(client, STATUS_IN_USE);

  if (openRows.length && equipment.id_equipment_status !== inUseId) {
    await client.query(q.qUpdateEquipmentStatus, [inUseId, userId, idEquipment]);
  } else if (!openRows.length && equipment.id_equipment_status === inUseId) {
    const availableId = await getStatusId(client, STATUS_AVAILABLE);
    await client.query(q.qUpdateEquipmentStatus, [availableId, userId, idEquipment]);
  }
};

module.exports = {
  STATUS_IN_USE,
  STATUS_AVAILABLE,
  isBlockingStatus,
  getStatusId,
  syncEquipmentStatus,
};
