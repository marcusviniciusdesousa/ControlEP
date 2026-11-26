// Controller file for permission related queries

// Importing database
const db = require("../db");

// Importing queries file
const { queries: q } = require("./queries/queries");

// Function to list all permissions
const getAllPermissions = async (req, res) => {
  try {
    // Creating array with results
    const { rows } = await db.query(q.qSelectPermissions);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao buscar permissões." });
  }
};

// Function to get all permissions related to a role
const getPermissionsByRoleID = async (req, res) => {
  // ID for permission being searched for
  const id_role = req.params.id_role;

  // Finding permissions
  try {
    // Searching for permissions
    const { rows } = await db.query(q.SelectPermissionsByRole, [id_role]);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao buscar permissões." });
  }
};

// Function to add permission to role
const addPermissionToRole = async (req, res) => {
  // IDs for connection being created
  const id_role = Number(req.params.id_role);
  const id_permission = Number(req.params.id_permission);

  if (!Number.isInteger(id_role) || id_role <= 0 || !Number.isInteger(id_permission) || id_permission <= 0) {
    return res.status(400).json({ message: "Papel ou permissão inválidos." });
  }

  try {
    // Adding permission
    await db.query(q.qAddRolePermission, [id_role, id_permission]);

    // Return message for sucesseful creation
    res.status(201).json({ message: "Permissão adicionada." });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(404).json({ message: "Papel ou permissão não encontrados." });
    }
    console.error(err);
    res.status(500).json({ message: "Erro ao adicionar permissão." });
  }
};

// Function to delete permission from database
const deletePermissionFromRole = async (req, res) => {
  // ID for permission being deleted
  const id_role = req.params.id_role;
  const id_permission = req.params.id_permission;

  try {
    // Deleting permission
    await db.query(q.qDeleteRolePermission, [id_role, id_permission]);

    // Return message for sucesseful deletion
    res.status(201).json({ message: "Permissão removida." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao remover permissão." });
  }
};

// Exporting permission functions
module.exports = {
  getAllPermissions,
  getPermissionsByRoleID,
  addPermissionToRole,
  deletePermissionFromRole,
};
