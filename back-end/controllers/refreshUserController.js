// Devolve os dados do usuário autenticado (usado ao recarregar a página).

const db = require("../db");
const { queries: q } = require("./queries/queries");
const { isUserAllowed } = require("./sessionHelpers");

const handleRefreshUser = async (req, res) => {
  const userId = Number(req.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(401).json({ message: "Sessão expirada." });
  }

  try {
    const { rows } = await db.query(q.qSelectUserByID, [userId]);
    const user = rows[0];

    if (!user || !isUserAllowed(user)) {
      return res.status(401).json({ message: "Sessão expirada." });
    }

    return res.status(200).json({
      userId,
      id: userId,
      username: user.name,
      name: user.name,
      email: user.email,
      role: user.id_role,
      id_role: user.id_role,
      role_name: user.role_name,
      permissions: req.permissions || [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao atualizar dados do usuário." });
  }
};

module.exports = { handleRefreshUser };
