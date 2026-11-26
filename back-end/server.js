// Main server file
require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const verifyJWT = require("./middleware/verifyJWT");
const corsOptions = require("./config/corsOptions");
const verifyCredentials = require("./middleware/credentials");
const { errorHandler, notFound } = require("./middleware/errorHandler");

// Falha cedo se variáveis obrigatórias estiverem ausentes (ver .env.example)
const REQUIRED_ENV = ["DATABASE_URL", "ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"];
const missingEnv = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missingEnv.length) {
  console.error(`Variáveis de ambiente ausentes: ${missingEnv.join(", ")}. Copie .env.example para .env.`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4500;

app.disable("x-powered-by");

// Checking credentials before cors
app.use(verifyCredentials);
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

// Health check (sem autenticação)
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// Rotas públicas
app.use("/register", require("./routes/register"));
app.use("/auth", require("./routes/auth"));
app.use("/refresh", require("./routes/refresh"));
app.use("/logout", require("./routes/logout"));
app.use("/password-reset", require("./routes/passwordReset"));

// Todas as rotas abaixo exigem access token válido
app.use(verifyJWT);

app.use("/users", require("./routes/api/users"));
app.use("/employees", require("./routes/api/employees"));
app.use("/roles", require("./routes/api/roles"));
app.use("/permissions", require("./routes/api/permissions"));
app.use("/equipments", require("./routes/api/equipment"));
app.use("/equipment-uses", require("./routes/api/equipmentUse"));
app.use("/presence", require("./routes/api/attendance"));
app.use("/dashboard", require("./routes/api/dashboard"));
app.use("/shifts", require("./routes/api/shifts"));
app.use("/lookups", require("./routes/api/lookups"));
app.use("/refreshUser", require("./routes/refreshUser"));

app.use(notFound);
app.use(errorHandler);

// Permite importar o app nos testes sem abrir a porta
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    require("./config/mail").checkMailConnection();
  });
}

module.exports = app;
