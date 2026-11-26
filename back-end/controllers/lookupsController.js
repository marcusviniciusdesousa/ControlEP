// Tabelas de referência usadas pelos formulários (cargos, setores, tipos e status).

const db = require("../db");
const { queries: q } = require("./queries/queries");

const getLookups = async (req, res) => {
  try {
    const [positions, sectors, equipmentTypes, equipmentStatuses, attendanceStatuses] = await Promise.all([
      db.query(q.qSelectPositions),
      db.query(q.qSelectSectors),
      db.query(q.qSelectEquipmentTypes),
      db.query(q.qSelectEquipmentStatuses),
      db.query(q.qSelectAttendanceStatuses),
    ]);

    return res.status(200).json({
      positions: positions.rows,
      sectors: sectors.rows,
      equipment_types: equipmentTypes.rows,
      equipment_statuses: equipmentStatuses.rows,
      attendance_statuses: attendanceStatuses.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao carregar dados de referência." });
  }
};

module.exports = { getLookups };
