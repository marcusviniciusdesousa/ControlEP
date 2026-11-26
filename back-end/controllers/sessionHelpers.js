// Funções compartilhadas para criação/renovação de sessões (login e /refresh).

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
require("dotenv").config({ quiet: true });

const db = require("../db");
const { queries: q } = require("./queries/queries");
const {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  accessCookieOptions,
  refreshCookieOptions,
} = require("../config/auth");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const loadPermissions = async (roleId) => {
  const { rows } = await db.query(q.qSelectPermissionsByRoleId, [roleId]);
  return rows.map((p) => p.name);
};

/**
 * Emite access token + refresh token, grava o hash do refresh token no banco
 * e envia ambos como cookies httpOnly.
 */
const issueSession = async (res, user) => {
  const permissions = await loadPermissions(user.id_role);

  const accessToken = jwt.sign(
    { userInfo: { userId: user.id, username: user.name, role: user.id_role, permissions } },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000) },
  );

  const refreshToken = jwt.sign(
    // jti garante tokens distintos mesmo quando emitidos no mesmo segundo
    { userId: user.id, username: user.name, jti: crypto.randomUUID() },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: Math.floor(REFRESH_TOKEN_TTL_MS / 1000) },
  );

  await db.query(q.qAddRefreshToken, [
    user.id,
    hashToken(refreshToken),
    new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  ]);

  res.cookie("accessToken", accessToken, accessCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);

  return { userId: user.id, username: user.name, role: user.id_role, permissions };
};

const isUserAllowed = (user) => user.status_active === true && user.approval_status === "Aprovado";

module.exports = { hashToken, issueSession, isUserAllowed, loadPermissions };
