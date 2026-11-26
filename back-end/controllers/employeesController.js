// Controller file for employee related queries

const db = require("../db");
const { queries: q } = require("./queries/queries");
const validate = require("../helpers/dataValidation");

// Function to list all employees
const getAllEmployees = async (req, res) => {
  try {
    const { rows } = await db.query(q.qSelectEmployees);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao buscar funcionários." });
  }
};

// Function to get an employee data by their ID
const getEmployeeByID = async (req, res) => {
  const id = req.params.id;

  try {
    const { rows } = await db.query(q.qSelectEmployeeFullById, [id]);
    const employee = rows[0];

    if (!employee) {
      return res.status(400).json({
        message: "Funcionário não encontrado",
      });
    }

    res.json(employee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao buscar funcionário." });
  }
};

// Function to add new employees
const addEmployee = async (req, res) => {
  let {
    name,
    id_position,
    code_employee,
    login_main_system,
    id_sector,
    id_shift,
  } = req.body;

  const id_user_create = Number(req.userId);

  if (
    !validate.validateName(name) ||
    !Number.isInteger(Number(id_position)) ||
    Number(id_position) <= 0 ||
    !Number.isInteger(Number(id_shift)) ||
    Number(id_shift) <= 0 ||
    !Number.isInteger(id_user_create) ||
    id_user_create <= 0
  ) {
    return res.status(400).json({
      message: "Dados inválidos",
    });
  }

  try {
    const { rows } = await db.query(q.qAddEmployee, [
      name,
      Number(id_position),
      code_employee,
      login_main_system,
      id_sector === null || id_sector === "" ? null : Number(id_sector),
      Number(id_shift),
      id_user_create,
    ]);

    return res.status(201).json({
      message: "Funcionário cadastrado com sucesso",
      employee: rows[0],
    });
  } catch (err) {
    console.error(err);

    if (err.code === "23503") {
      return res.status(400).json({
        message: "Cargo, setor, turno ou usuário responsável não encontrado.",
      });
    }

    return res.status(500).json({
      message: "Erro ao cadastrar funcionário.",
    });
  }
};

// Function to update employee
const updateEmployee = async (req, res) => {
  let {
    id,
    name,
    id_position,
    code_employee,
    login_main_system,
    id_sector,
    id_shift,
  } = req.body;

  const id_last_user_change = Number(req.userId);

  if (!validate.validateName(name)) {
    return res.status(400).json({
      message: "Dados inválidos",
    });
  }

  try {
    const { rows } = await db.query(q.qSelectEmployeeById, [Number(id)]);
    const currentEmployeeData = rows[0];

    if (!currentEmployeeData) {
      return res.status(400).json({
        message: "Funcionário não encontrado",
      });
    }

    await db.query(q.qUpdateEmployee, [
      name.toLowerCase(),
      id_position,
      code_employee,
      login_main_system,
      id_sector === null || id_sector === "" ? null : Number(id_sector),
      id_shift,
      id_last_user_change,
      Number(id),
    ]);

    res.status(200).json({
      message: "Dados de funcionário atualizados",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Erro ao atualizar funcionário.",
    });
  }
};

// Function to deactivate employee
const deactivateEmployee = async (req, res) => {
  const id = req.params.id;
  const id_user = req.params.id_user || req.userId;

  try {
    await db.query(q.qDeactivateEmployee, [Number(id_user), Number(id)]);
    res.status(201).json({ message: "Funcionário desativado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao desativar funcionário." });
  }
};

// Function to delete employee from database
const deleteEmployee = async (req, res) => {
  const id = req.params.id;

  try {
    await db.query(q.qDeleteEmployee, [id]);
    res.status(201).json({ message: "Funcionário deletado." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao deletar funcionário." });
  }
};

module.exports = {
  getAllEmployees,
  getEmployeeByID,
  addEmployee,
  updateEmployee,
  deactivateEmployee,
  deleteEmployee,
};