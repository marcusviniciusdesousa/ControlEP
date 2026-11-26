// Authentication controller, for user login

const bcrypt = require("bcrypt");
const db = require("../db");
const { queries: q } = require("./queries/queries");
const validate = require("../helpers/dataValidation");
const { issueSession } = require("./sessionHelpers");

const INVALID_CREDENTIALS = "E-mail ou senha inválidos.";

const handleLogin = async (req, res) => {
  const { email_usuario, senha_usuario } = req.body || {};

  if (typeof email_usuario !== "string" || typeof senha_usuario !== "string" || !email_usuario || !senha_usuario) {
    return res.status(400).json({ message: "E-mail e senha são necessários." });
  }

  if (!validate.validateEmail(email_usuario.trim())) {
    return res.status(400).json({ message: "Informe um e-mail válido." });
  }

  try {
    const { rows } = await db.query(q.qSelectUserByEmail, [email_usuario.trim().toLowerCase()]);
    const user = rows[0];

    // Mesma resposta para usuário inexistente ou senha incorreta (não revela e-mails cadastrados)
    if (!user || !(await bcrypt.compare(senha_usuario, user.password_hash))) {
      return res.status(401).json({ message: INVALID_CREDENTIALS });
    }

    // A senha está correta: agora é seguro informar a situação do cadastro
    if (user.approval_status === "Pendente") {
      return res.status(403).json({
        message: "Seu cadastro ainda está aguardando aprovação de um administrador.",
        code: "USER_PENDING",
      });
    }
    if (user.approval_status === "Rejeitado") {
      return res.status(403).json({
        message: "Sua solicitação de acesso foi recusada. Procure um administrador.",
        code: "USER_REJECTED",
      });
    }
    if (!user.status_active) {
      return res.status(403).json({
        message: "Seu acesso está desativado. Procure um administrador.",
        code: "USER_INACTIVE",
      });
    }

    // Limpeza oportunista de sessões vencidas
    await db.query(q.qDeleteRefreshTokenByExpirationDate);

    const session = await issueSession(res, user);
    return res.status(200).json(session);
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ message: "Não foi possível iniciar a sessão." });
  }
};

module.exports = { handleLogin };
