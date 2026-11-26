// Controller file for dashboard related queries

const db = require("../db");
const { queries: q } = require("./queries/queries");
const validate = require("../helpers/dataValidation");

const today = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

// GET /dashboard?from=AAAA-MM-DD&to=AAAA-MM-DD  (padrão: hoje)
//
// - employees.active_now / registered: situação ATUAL, não depende do período;
// - attendance.*: registros dentro do período;
// - attendance_by_employee: funcionários ativos já admitidos até o fim do período
//   e, para manter o histórico, inativos que tenham registros no período;
// - equipment: situação atual do inventário (não depende do período).
const getDashboard = async (req, res) => {
  const from = req.query.from ?? req.query.date ?? today();
  const to = req.query.to ?? req.query.date ?? from;

  if (!validate.validateDate(from) || !validate.validateDate(to) || from > to) {
    return res.status(400).json({ message: "Período inválido. Use AAAA-MM-DD." });
  }

  try {
    const [employees, attendanceByStatus, attendanceByEmployee, equipmentSummary, equipmentByStatus] =
      await Promise.all([
        db.query(q.qDashboardEmployees),
        db.query(q.qDashboardAttendanceByStatus, [from, to]),
        db.query(q.qDashboardAttendanceByEmployee, [from, to]),
        db.query(q.qDashboardEquipmentSummary),
        db.query(q.qDashboardEquipmentByStatus),
      ]);

    const summary = equipmentSummary.rows[0];

    return res.status(200).json({
      period: { from, to },
      employees: employees.rows[0],
      attendance: {
        byStatus: attendanceByStatus.rows,
        byEmployee: attendanceByEmployee.rows,
      },
      equipment: {
        total: summary.total,
        in_use: summary.in_use,
        byStatus: equipmentByStatus.rows,
      },
    });
  } catch (error) {
    console.error("Erro ao carregar painel:", error);
    return res.status(500).json({ message: "Não foi possível carregar as informações do painel." });
  }
};

module.exports = { getDashboard };
