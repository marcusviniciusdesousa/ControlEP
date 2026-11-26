// Controller file for role related queries

// Importing database
const db = require("../db");

// Importing queries file
const { queries: q } = require("./queries/queries");

// Importing validation helper functions
const validate = require("../helpers/dataValidation");
const { isMasterRoleName } = require("../helpers/masterRole");

// Só pode existir um papel "Master" (o sistema permite apenas um usuário Master)
const otherMasterRoleExists = async (exceptId) => {
  const { rows } = await db.query(
    `SELECT id FROM role WHERE LOWER(TRIM(name)) LIKE 'master%' AND id <> $1`,
    [exceptId ?? -1],
  );
  return rows.length > 0;
};

// Function to list all roles
const getAllRoles = async (req, res) => {
  try {
    // Creating array with results
    const { rows } = await db.query(q.qSelectRoles);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao buscar papéis." });
  }
};

// Function to get a role data by their ID
const getRoleByID = async (req, res) => {
  // ID for role being searched for
  const id = req.params.id;

  // Finding role
  try {
    // Searching for role
    const { rows } = await db.query(q.qSelectRoleById, [id]);
    const role = rows[0];

    // Send error message if role isn't found
    if (!role) {
      return res.status(400).json({
        message: `Papel não encontrado`,
      });
    }

    res.json(role);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao buscar papel." });
  }
};

// Function to create role
const addRole = async (req, res) => {
  let { name } = req.body;

  if (typeof name !== "string" || !validate.validateLabel(name, 30)) {
    return res.status(400).json({
      message: "Informe um nome de papel válido (2 a 30 caracteres).",
    });
  }

  const formattedName = name.trim();

  try {
    if (isMasterRoleName(formattedName) && (await otherMasterRoleExists(null))) {
      return res.status(409).json({ message: "Já existe um papel Master; o sistema permite apenas um." });
    }

    const { rows: existingRoles } = await db.query(q.qSelectRoleByName, [
      formattedName,
    ]);

    if (existingRoles.length > 0) {
      return res.status(409).json({
        message: `Papel já cadastrado`,
      });
    }

    const { rows } = await db.query(q.qAddRole, [formattedName]);

    return res.status(201).json({
      message: "Papel cadastrado com sucesso",
      role: rows[0],
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Erro ao cadastrar papel.",
    });
  }
};

// Function to update role
const updateRole = async (req, res) => {
  let { id, name } = req.body;

  if (!validate.isPositiveInt(id) || typeof name !== "string" || !validate.validateLabel(name, 30)) {
    return res.status(400).json({
      message: "Informe um nome de papel válido (2 a 30 caracteres).",
    });
  }

  const formattedName = name.trim();

  try {
    const { rows } = await db.query(q.qSelectRoleById, [Number(id)]);
    const currentRoleData = rows[0];

    if (!currentRoleData) {
      return res.status(400).json({
        message: `Papel não encontrado`,
      });
    }

    if (isMasterRoleName(formattedName) && (await otherMasterRoleExists(Number(id)))) {
      return res.status(409).json({ message: "Já existe um papel Master; o sistema permite apenas um." });
    }
    if (isMasterRoleName(currentRoleData.name) && !isMasterRoleName(formattedName)) {
      return res.status(409).json({ message: "O papel Master não pode ser renomeado." });
    }

    const { rows: duplicate } = await db.query(q.qSelectRoleByNameExceptId, [formattedName, Number(id)]);
    if (duplicate.length > 0) {
      return res.status(409).json({ message: "Já existe um papel com esse nome." });
    }

    await db.query(q.qUpdateRole, [formattedName, Number(id)]);

    res.status(200).json({
      message: "Dados de papel atualizados",
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Já existe um papel com esse nome." });
    }
    console.error(err);

    res.status(500).json({
      message: "Erro ao atualizar papel.",
    });
  }
};

// Function to delete role from database
const deleteRole = async (req, res) => {
  // ID for role being deleted
  const id = req.params.id;

  // Validating data
  if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
    return res.status(400).json({
      message: "ID de papel inválido.",
    });
  }

  try {
    // Finding role
    const { rows: roleRows } = await db.query(q.qSelectRoleById, [Number(id)]);

    // If role doesn't exist, return error
    if (!roleRows[0]) {
      return res.status(404).json({
        message: "Papel não encontrado.",
      });
    }

    // Checking whether the role is assigned to any user
    const { rows: userRows } = await db.query(q.qSelectUsersByRole, [
      Number(id),
    ]);

    if (userRows.length > 0) {
      return res.status(409).json({
        message:
          "Não é possível excluir este papel, pois existem usuários associados a ele.",
      });
    }

    // Removing role-permission associations and the role atomically
    const deletedRows = await db.withTransaction(async (client) => {
      await client.query(q.qDeleteAllRolePermissions, [Number(id)]);
      const { rows } = await client.query(q.qDeleteRole, [Number(id)]);
      if (rows.length === 0) throw Object.assign(new Error("role in use"), { code: "ROLE_IN_USE" });
      return rows;
    }).catch((err) => {
      if (err.code === "ROLE_IN_USE") return [];
      throw err;
    });

    if (deletedRows.length === 0) {
      return res.status(409).json({
        message: "Não foi possível excluir o papel.",
      });
    }

    // Sending successful status
    return res.status(200).json({
      message: "Papel excluído com sucesso.",
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Erro ao excluir papel.",
    });
  }
};

// Exporting role functions
module.exports = {
  getAllRoles,
  getRoleByID,
  addRole,
  updateRole,
  deleteRole,
};
