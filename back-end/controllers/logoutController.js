// Encerra a sessão atual: remove o refresh token do banco e apaga os cookies.

const db = require("../db");
const { queries: q } = require("./queries/queries");
const { clearAuthCookies } = require("../config/auth");
const { hashToken } = require("./sessionHelpers");

const handleLogout = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  try {
    if (refreshToken) {
      // Remove apenas a sessão deste navegador; outras sessões do usuário continuam válidas
      await db.query(q.qDeleteRefreshTokenByToken, [hashToken(refreshToken)]);
    }
  } catch (err) {
    console.error("Erro ao encerrar sessão:", err);
  } finally {
    clearAuthCookies(res);
  }

  return res.sendStatus(204);
};

module.exports = { handleLogout };
