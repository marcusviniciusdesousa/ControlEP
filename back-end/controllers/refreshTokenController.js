// Renovação de sessão com rotação do refresh token (janela deslizante).

const jwt = require("jsonwebtoken");
require("dotenv").config({ quiet: true });

const db = require("../db");
const { queries: q } = require("./queries/queries");
const { REFRESH_ROTATION_GRACE_MS, clearAuthCookies } = require("../config/auth");
const { hashToken, issueSession, isUserAllowed } = require("./sessionHelpers");

const sessionExpired = (res, message = "Sua sessão expirou. Entre novamente.") => {
  clearAuthCookies(res);
  return res.status(401).json({ message, code: "SESSION_EXPIRED" });
};

const handleRefreshToken = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) return sessionExpired(res);

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch {
    return sessionExpired(res);
  }

  try {
    const { rows } = await db.query(q.qSelectRefreshToken, [hashToken(refreshToken)]);
    const session = rows[0];

    if (!session || Number(decoded.userId) !== Number(session.id_user)) {
      return sessionExpired(res);
    }

    if (!isUserAllowed(session)) {
      await db.query(q.qDeleteRefreshTokenByID, [session.id_user]);
      return sessionExpired(res, "Seu acesso foi desativado. Procure um administrador.");
    }

    // Rotação: novo par de tokens; o anterior continua válido por poucos segundos
    // para requisições concorrentes (outra aba) não derrubarem a sessão.
    await db.query(q.qExpireRefreshTokenSoon, [
      session.id_session,
      new Date(Date.now() + REFRESH_ROTATION_GRACE_MS),
    ]);
    const result = await issueSession(res, session);

    return res.status(200).json(result);
  } catch (err) {
    console.error("Erro ao renovar sessão:", err);
    return res.status(500).json({ message: "Não foi possível renovar a sessão." });
  }
};

module.exports = { handleRefreshToken };
