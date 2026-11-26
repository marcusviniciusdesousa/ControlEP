require("dotenv").config({ quiet: true });

// Origens autorizadas a chamar a API com cookies (separadas por vírgula).
const whitelist = (process.env.FRONTEND_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = whitelist;
