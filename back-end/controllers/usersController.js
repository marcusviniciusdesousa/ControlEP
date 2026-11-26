// Controller file for user related queries

const db = require("../db");
const { queries: q } = require("./queries/queries");
const validate = require("../helpers/dataValidation");
const {
  isMasterRoleName,
  masterConflictMessage,
  isSingleMasterViolation,
} = require("../helpers/masterRole");

/** Somente o próprio Master pode alterar outro usuário Master. */
const blockedByMasterProtection = async (req, target) => {
  if (!isMasterRoleName(target.role_name)) return null;
  const requester = await findUser(req.userId);
  if (requester && isMasterRoleName(requester.role_name)) return null;
  return "Apenas um usuário Master pode alterar outro usuário Master.";
};

const parseId = (value) => (validate.isPositiveInt(value) ? Number(value) : null);

const findUser = async (id) => {
  const { rows } = await db.query(q.qSelectUserByID, [id]);
  return rows[0] || null;
};

const roleExists = async (id) => {
  const { rows } = await db.query(q.qSelectRoleById, [id]);
  return rows.length > 0;
};

// Lista todos os usuários (pendentes primeiro), inclusive inativos e rejeitados
const getAllUsers = async (req, res) => {
  try {
    const { rows } = await db.query(q.qSelectAllUsers);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao buscar usuários." });
  }
};

const getUserByID = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "ID de usuário inválido." });

  try {
    const user = await findUser(id);
    if (!user) return res.status(404).json({ message: "Usuário não encontrado." });
    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao buscar usuário." });
  }
};

// Atualiza nome, e-mail e papel
const updateUser = async (req, res) => {
  const { name, email, id_role } = req.body || {};
  const id = parseId(req.body?.id);

  if (
    !id ||
    typeof name !== "string" ||
    !validate.validateName(name.trim()) ||
    typeof email !== "string" ||
    !validate.validateEmail(email.trim()) ||
    !validate.isPositiveInt(id_role)
  ) {
    return res.status(400).json({ message: "Dados inválidos." });
  }

  try {
    const current = await findUser(id);
    if (!current) return res.status(404).json({ message: "Usuário não encontrado." });

    if (id === req.userId && Number(id_role) !== Number(current.id_role)) {
      return res.status(409).json({ message: "Você não pode alterar o seu próprio papel." });
    }
    if (!(await roleExists(Number(id_role)))) {
      return res.status(400).json({ message: "Papel não encontrado." });
    }

    const protection = await blockedByMasterProtection(req, current);
    if (protection) return res.status(403).json({ message: protection });

    if (Number(id_role) !== Number(current.id_role)) {
      const conflict = await masterConflictMessage(id, Number(id_role));
      if (conflict) return res.status(409).json({ message: conflict });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { rows: dup } = await db.query(q.qSelectUserByEmailExceptId, [normalizedEmail, id]);
    if (dup.length) return res.status(409).json({ message: "Já existe um usuário com este e-mail." });

    await db.query(q.qUpdateUser, [name.trim(), normalizedEmail, Number(id_role), id]);
    return res.status(200).json({ message: "Dados do usuário atualizados." });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Já existe um usuário com este e-mail." });
    }
    if (isSingleMasterViolation(err)) return res.status(409).json({ message: err.message });
    console.error(err);
    return res.status(500).json({ message: "Erro ao atualizar usuário." });
  }
};

// Aprova um cadastro pendente (ou previamente rejeitado) atribuindo o papel
const approveUser = async (req, res) => {
  const id = parseId(req.params.id);
  const idRole = parseId(req.body?.id_role);
  if (!id) return res.status(400).json({ message: "ID de usuário inválido." });
  if (!idRole) return res.status(400).json({ message: "Selecione o papel do usuário." });

  try {
    const user = await findUser(id);
    if (!user) return res.status(404).json({ message: "Usuário não encontrado." });
    if (user.approval_status === "Aprovado") {
      return res.status(409).json({ message: "Este usuário já está aprovado." });
    }
    if (!(await roleExists(idRole))) return res.status(400).json({ message: "Papel não encontrado." });

    const conflict = await masterConflictMessage(id, idRole);
    if (conflict) return res.status(409).json({ message: conflict });

    await db.query(q.qApproveUser, [idRole, req.userId, id]);
    return res.status(200).json({ message: "Usuário aprovado." });
  } catch (err) {
    if (isSingleMasterViolation(err)) return res.status(409).json({ message: err.message });
    console.error(err);
    return res.status(500).json({ message: "Erro ao aprovar usuário." });
  }
};

// Rejeita a solicitação (persistida; o registro é mantido para auditoria)
const rejectUser = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "ID de usuário inválido." });
  if (id === req.userId) return res.status(409).json({ message: "Você não pode rejeitar o seu próprio acesso." });

  try {
    const user = await findUser(id);
    if (!user) return res.status(404).json({ message: "Usuário não encontrado." });
    if (user.approval_status !== "Pendente") {
      return res.status(409).json({ message: "Apenas solicitações pendentes podem ser recusadas." });
    }

    await db.query(q.qRejectUser, [req.userId, id]);
    await db.query(q.qDeleteRefreshTokenByID, [id]);
    return res.status(200).json({ message: "Solicitação recusada." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao recusar solicitação." });
  }
};

// Ativa/desativa um usuário já aprovado. Body: { status_active: boolean }.
// Sem body, alterna o status atual (compatibilidade com PUT /users/:id).
const setUserStatus = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "ID de usuário inválido." });
  if (id === req.userId) {
    return res.status(409).json({ message: "Você não pode alterar o status do seu próprio usuário." });
  }

  try {
    const user = await findUser(id);
    if (!user) return res.status(404).json({ message: "Usuário não encontrado." });
    if (user.approval_status !== "Aprovado") {
      return res.status(409).json({ message: "Aprove a solicitação antes de ativar o usuário." });
    }
    const protection = await blockedByMasterProtection(req, user);
    if (protection) return res.status(403).json({ message: protection });

    const requested =
      req.body && req.body.status_active !== undefined
        ? validate.parseBoolean(req.body.status_active)
        : !user.status_active;
    if (requested === null) return res.status(400).json({ message: "Status inválido." });

    await db.query(q.qUpdateUserStatus, [requested, id]);
    // Ao desativar, encerra imediatamente as sessões do usuário
    if (!requested) await db.query(q.qDeleteRefreshTokenByID, [id]);

    return res.status(200).json({
      message: requested ? "Usuário ativado." : "Usuário desativado.",
      status_active: requested,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao alterar status do usuário." });
  }
};

const deleteUser = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: "ID de usuário inválido." });
  if (id === req.userId) return res.status(409).json({ message: "Você não pode excluir o seu próprio usuário." });

  try {
    const target = await findUser(id);
    if (!target) return res.status(404).json({ message: "Usuário não encontrado." });
    const protection = await blockedByMasterProtection(req, target);
    if (protection) return res.status(403).json({ message: protection });

    await db.query(q.qDeleteRefreshTokenByID, [id]);
    const { rows } = await db.query(q.qDeleteUser, [id]);
    if (!rows.length) return res.status(404).json({ message: "Usuário não encontrado." });
    return res.status(200).json({ message: "Usuário excluído." });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({
        message: "Este usuário possui registros vinculados e não pode ser excluído. Desative-o.",
      });
    }
    console.error(err);
    return res.status(500).json({ message: "Erro ao excluir usuário." });
  }
};

module.exports = {
  getAllUsers,
  getUserByID,
  updateUser,
  approveUser,
  rejectUser,
  setUserStatus,
  deactivateUser: setUserStatus,
  deleteUser,
};
