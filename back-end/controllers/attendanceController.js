// Controller file for attendance related queries

const db = require("../db");
const { queries: q } = require("./queries/queries");
const validate = require("../helpers/dataValidation");

// Function to list attendance
const getAttendance = async (req, res) => {
  const date = req.query?.date ?? req.body?.date;
  const id_employee = req.query?.id_employee ?? req.body?.id_employee;

  try {
    let result;

    if (id_employee !== undefined && date !== undefined) {
      if (
        !/^[1-9]\d*$/.test(String(id_employee)) ||
        !validate.validateDate(date)
      ) {
        return res.status(400).json({
          message: "Parâmetros de consulta inválidos.",
        });
      }

      result = await db.query(q.qSelectAttendanceByEmployeeAndDate, [
        Number(id_employee),
        date,
      ]);
    } else if (date !== undefined) {
      if (!validate.validateDate(date)) {
        return res.status(400).json({
          message: "Data inválida.",
        });
      }

      result = await db.query(q.qSelectAttendanceByDate, [date]);
    } else if (id_employee !== undefined) {
      if (!/^[1-9]\d*$/.test(String(id_employee))) {
        return res.status(400).json({
          message: "ID de funcionário inválido.",
        });
      }

      result = await db.query(q.qSelectAttendanceByEmployee, [
        Number(id_employee),
      ]);
    } else {
      return res.status(400).json({
        message: "Informe uma data, um funcionário ou ambos.",
      });
    }

    return res.status(200).json({
      attendance: result.rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Erro ao consultar presença.",
    });
  }
};

// Function to add attendance (delegates to updateAttendance if record ID is present)
const addAttendance = async (req, res) => {
  if (req.body.id !== undefined && req.body.id !== null && req.body.id !== "") {
    return updateAttendance(req, res);
  }

  const { id_employee, id_attendance_status, date, observation } = req.body;
  const userId = Number(req.userId);

  if (
    !Number.isInteger(Number(id_employee)) ||
    Number(id_employee) <= 0 ||
    !Number.isInteger(Number(id_attendance_status)) ||
    Number(id_attendance_status) <= 0 ||
    !validate.validateDate(date) ||
    (observation != null &&
      (typeof observation !== "string" || observation.length > 255)) ||
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return res.status(400).json({
      message: "Dados inválidos.",
    });
  }

  try {
    const { rows: employees } = await db.query(
      q.qSelectAttendanceEmployeeById,
      [Number(id_employee)],
    );

    if (!employees.length) {
      return res.status(404).json({
        message: "Funcionário não encontrado.",
      });
    }

    const { rows: statuses } = await db.query(q.qSelectAttendanceStatusById, [
      Number(id_attendance_status),
    ]);

    if (!statuses.length) {
      return res.status(400).json({
        message: "Status de presença não encontrado.",
      });
    }

    const { rows: existing } = await db.query(
      q.qSelectAttendanceByEmployeeAndDate,
      [Number(id_employee), date],
    );

    if (existing.length) {
      const { rows } = await db.query(q.qUpdateAttendance, [
        Number(id_attendance_status),
        observation?.trim() || null,
        userId,
        Number(existing[0].id),
      ]);

      return res.status(200).json({
        message: "Presença atualizada com sucesso.",
        attendance: rows[0],
      });
    }

    const { rows } = await db.query(q.qAddAttendance, [
      Number(id_employee),
      Number(id_attendance_status),
      date,
      observation?.trim() || null,
      userId,
    ]);

    return res.status(201).json({
      message: "Presença registrada com sucesso.",
      attendance: rows[0],
    });
  } catch (err) {
    console.error(err);

    if (err.code === "23503") {
      return res.status(400).json({
        message: "Uma das referências informadas não existe.",
      });
    }

    return res.status(500).json({
      message: "Erro ao registrar presença.",
    });
  }
};

// Function to update or create attendance (supports both { id } and { id_employee, date })
const updateAttendance = async (req, res) => {
  const { id, id_employee, id_attendance_status, date, observation } = req.body;
  const userId = Number(req.userId);

  if (
    !Number.isInteger(Number(id_attendance_status)) ||
    Number(id_attendance_status) <= 0 ||
    (observation != null &&
      (typeof observation !== "string" || observation.length > 255)) ||
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return res.status(400).json({
      message: "Dados inválidos.",
    });
  }

  try {
    // Validate status
    const { rows: statusRows } = await db.query(q.qSelectAttendanceStatusById, [
      Number(id_attendance_status),
    ]);

    if (!statusRows.length) {
      return res.status(400).json({
        message: "Status de presença não encontrado.",
      });
    }

    // Case 1: Updating directly by attendance record ID
    if (id !== undefined && id !== null && id !== "") {
      if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
        return res.status(400).json({
          message: "Dados inválidos.",
        });
      }

      const { rows: attendanceRows } = await db.query(q.qSelectAttendanceById, [
        Number(id),
      ]);

      if (!attendanceRows.length) {
        return res.status(404).json({
          message: "Registro de presença não encontrado.",
        });
      }

      const { rows } = await db.query(q.qUpdateAttendance, [
        Number(id_attendance_status),
        observation?.trim() || null,
        userId,
        Number(id),
      ]);

      return res.status(200).json({
        message: "Presença atualizada com sucesso.",
        attendance: rows[0],
      });
    }

    // Case 2: Upsert by id_employee + date (sent by front-end)
    if (
      !Number.isInteger(Number(id_employee)) ||
      Number(id_employee) <= 0 ||
      !validate.validateDate(date)
    ) {
      return res.status(400).json({
        message: "Dados inválidos.",
      });
    }

    const { rows: employees } = await db.query(
      q.qSelectAttendanceEmployeeById,
      [Number(id_employee)],
    );

    if (!employees.length) {
      return res.status(404).json({
        message: "Funcionário não encontrado.",
      });
    }

    const { rows: existing } = await db.query(
      q.qSelectAttendanceByEmployeeAndDate,
      [Number(id_employee), date],
    );

    if (existing.length) {
      const { rows } = await db.query(q.qUpdateAttendance, [
        Number(id_attendance_status),
        observation?.trim() || null,
        userId,
        Number(existing[0].id),
      ]);

      return res.status(200).json({
        message: "Presença atualizada com sucesso.",
        attendance: rows[0],
      });
    }

    const { rows } = await db.query(q.qAddAttendance, [
      Number(id_employee),
      Number(id_attendance_status),
      date,
      observation?.trim() || null,
      userId,
    ]);

    return res.status(201).json({
      message: "Presença registrada com sucesso.",
      attendance: rows[0],
    });
  } catch (err) {
    console.error(err);

    if (err.code === "23503") {
      return res.status(400).json({
        message: "Uma das referências informadas não existe.",
      });
    }

    return res.status(500).json({
      message: "Erro ao atualizar presença.",
    });
  }
};

// Function to add attendance registry for all active employees, marking them as present
const markAllPresent = async (req, res) => {
  const { date } = req.body;
  const userId = Number(req.userId);

  if (
    !validate.validateDate(date) ||
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return res.status(400).json({
      message: "Data ou usuário inválido.",
    });
  }

  try {
    const { rows: statusRows } = await db.query(q.qSelectPresentStatus);

    if (!statusRows.length) {
      return res.status(500).json({
        message: "O status 'Presente' não está cadastrado.",
      });
    }

    const { rows } = await db.query(q.qMarkAllEmployeesPresent, [date, userId]);

    return res.status(200).json({
      message: "Presença em massa processada com sucesso.",
      date,
      registeredCount: rows.length,
      attendance: rows,
    });
  } catch (err) {
    console.error(err);

    if (err.code === "23503") {
      return res.status(400).json({
        message: "Uma das referências informadas não existe.",
      });
    }

    return res.status(500).json({
      message: "Erro ao registrar presença.",
    });
  }
};

module.exports = {
  getAttendance,
  addAttendance,
  updateAttendance,
  markAllPresent,
};