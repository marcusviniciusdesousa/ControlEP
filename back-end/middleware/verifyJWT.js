// Verifica o access token enviado no cookie httpOnly.
// 401 = sem sessão válida (o front-end tenta renovar via /refresh).
// 403 fica reservado para "autenticado, mas sem permissão" (verifyRoles).

const jwt = require("jsonwebtoken");
require("dotenv").config({ quiet: true });

const verifyJWT = (req, res, next) => {
  const token = req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({ message: "Sessão expirada.", code: "TOKEN_MISSING" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err || !decoded?.userInfo) {
      return res.status(401).json({
        message: "Sessão expirada.",
        code: err?.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
      });
    }

    req.userId = Number(decoded.userInfo.userId);
    req.user = decoded.userInfo.username;
    req.role = decoded.userInfo.role;
    req.permissions = decoded.userInfo.permissions || [];
    next();
  });
};

module.exports = verifyJWT;
