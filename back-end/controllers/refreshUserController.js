// File for refreshing user data upon page reload

const db = require("../db");
const { queries: q } = require("./queries/queries");

// Function to handle refreshing user context (React auth)
const handleRefreshUser = async (req, res) => {
  const userId = Number(req.userId || req.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.sendStatus(401);
  }

  try {
    const { rows } = await db.query(q.qSelectUserByID, [userId]);
    const user = rows[0];

    if (!user) {
      return res.sendStatus(401);
    }

    return res.status(200).json({
      userId,
      id: userId,
      username: user.name,
      name: user.name,
      email: user.email,
      role: user.id_role,
      id_role: user.id_role,
      role_name: user.role_name || user.name,
      permissions: req.permissions || [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao atualizar dados do usuário." });
  }
};

module.exports = { handleRefreshUser };