// Configuração centralizada de sessão e cookies de autenticação.
require("dotenv").config({ quiet: true });

const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// Access token curto (enviado em todas as requisições) e refresh token
// mais longo, renovado a cada uso (janela deslizante): enquanto o usuário
// estiver utilizando o sistema, a sessão é mantida; após REFRESH_TOKEN_TTL_HOURS
// sem nenhuma renovação, é necessário entrar novamente.
const ACCESS_TOKEN_TTL_MS =
  toPositiveNumber(process.env.ACCESS_TOKEN_TTL_MINUTES, 15) * 60 * 1000;
const REFRESH_TOKEN_TTL_MS =
  toPositiveNumber(process.env.REFRESH_TOKEN_TTL_HOURS, 12) * 60 * 60 * 1000;

// Tempo em que o refresh token anterior continua válido após a rotação,
// para não derrubar requisições concorrentes (ex.: duas abas).
const REFRESH_ROTATION_GRACE_MS = 60 * 1000;

const isProduction = process.env.NODE_ENV === "production";

const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction || process.env.COOKIE_SECURE === "true",
  sameSite: process.env.COOKIE_SAMESITE || "lax",
  path: "/",
};

const accessCookieOptions = { ...baseCookieOptions, maxAge: ACCESS_TOKEN_TTL_MS };
const refreshCookieOptions = { ...baseCookieOptions, maxAge: REFRESH_TOKEN_TTL_MS };

const clearAuthCookies = (res) => {
  res.clearCookie("accessToken", baseCookieOptions);
  res.clearCookie("refreshToken", baseCookieOptions);
};

module.exports = {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  REFRESH_ROTATION_GRACE_MS,
  baseCookieOptions,
  accessCookieOptions,
  refreshCookieOptions,
  clearAuthCookies,
};
