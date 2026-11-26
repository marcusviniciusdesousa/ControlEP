const nodemailer = require("nodemailer");
require("dotenv").config({ quiet: true });

const port = Number(process.env.EMAIL_PORT) || 465;
const user = (process.env.EMAIL_USER || "").trim();
// Senha de app do Google (espaços copiados junto são removidos)
const pass = (process.env.EMAIL_PASSWORD || "").replace(/\s+/g, "");

// Sem usuário/senha não há como enviar o código de recuperação
const isMailConfigured = Boolean(user && pass);

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port,
  // 465 = SSL direto; 587 = STARTTLS. EMAIL_SECURE=true/false força o modo.
  secure:
    process.env.EMAIL_SECURE === "true" ? true : process.env.EMAIL_SECURE === "false" ? false : port === 465,
  auth: { user, pass },
});

/** Testa a conexão/autenticação com o servidor SMTP (usado na inicialização). */
const checkMailConnection = async () => {
  if (!isMailConfigured) {
    console.warn(
      "[e-mail] EMAIL_USER/EMAIL_PASSWORD não configurados: a recuperação de senha está desativada.",
    );
    return false;
  }
  try {
    await transporter.verify();
    console.log(`[e-mail] Conectado ao servidor SMTP como ${user}.`);
    return true;
  } catch (err) {
    console.error(`[e-mail] Falha ao conectar no servidor SMTP: ${err.message}`);
    return false;
  }
};

module.exports = { transporter, isMailConfigured, checkMailConnection };
