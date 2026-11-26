// Regra do papel Master: o sistema permite apenas UM usuário com esse papel.
// O papel é identificado pelo nome (começando por "Master", sem diferenciar maiúsculas),
// a mesma regra usada pela função is_master_role() no banco.

const db = require("../db");

const isMasterRoleName = (name) => /^master/i.test(String(name || "").trim());

/** Nome de outro usuário Master, se existir (ignorando `exceptUserId`). */
const findOtherMaster = async (exceptUserId) => {
  const { rows } = await db.query(
    `SELECT u.id, u.name FROM "user" u JOIN role r ON r.id = u.id_role
      WHERE LOWER(TRIM(r.name)) LIKE 'master%' AND u.id <> $1
      ORDER BY u.id LIMIT 1`,
    [exceptUserId ?? -1],
  );
  return rows[0] || null;
};

const roleIsMaster = async (roleId) => {
  const { rows } = await db.query(`SELECT name FROM role WHERE id = $1`, [roleId]);
  return rows.length > 0 && isMasterRoleName(rows[0].name);
};

/** Mensagem de conflito quando já existe outro Master, ou null se a atribuição é permitida. */
const masterConflictMessage = async (targetUserId, roleId) => {
  if (!(await roleIsMaster(roleId))) return null;
  const other = await findOtherMaster(targetUserId);
  return other ? `Já existe um usuário Master (${other.name}). O sistema permite apenas um.` : null;
};

/** Erro lançado pelo trigger trg_user_single_master no banco. */
const isSingleMasterViolation = (err) => err?.code === "P0001" && /Master/.test(err.message || "");

module.exports = {
  isMasterRoleName,
  findOtherMaster,
  roleIsMaster,
  masterConflictMessage,
  isSingleMasterViolation,
};
