// Cadastro público: o usuário fica "Pendente" até ser aprovado por um administrador.

const bcrypt = require("bcrypt");
const db = require("../db");
const { queries: q } = require("./queries/queries");
const validate = require("../helpers/dataValidation");
const { isMasterRoleName } = require("../helpers/masterRole");

const registerUser = async (req, res) => {
  const { nome_usuario, email_usuario, senha_usuario, id_funcao } = req.body || {};

  if (!email_usuario || !senha_usuario) {
    return res.status(400).json({ message: "É necessário informar e-mail e senha." });
  }

  const name = typeof nome_usuario === "string" ? nome_usuario.trim() : "";
  const email = typeof email_usuario === "string" ? email_usuario.trim().toLowerCase() : "";

  if (!validate.validateName(name)) {
    return res.status(400).json({ message: "Informe um nome válido (somente letras, 3 a 80 caracteres)." });
  }
  if (!validate.validateEmail(email)) {
    return res.status(400).json({ message: "Informe um e-mail válido." });
  }
  if (typeof senha_usuario !== "string" || !validate.validatePassword(senha_usuario)) {
    return res.status(400).json({
      message:
        "A senha deve ter de 8 a 80 caracteres, com letra maiúscula, minúscula, número e símbolo.",
    });
  }
  if (!validate.isPositiveInt(id_funcao)) {
    return res.status(400).json({ message: "Papel solicitado inválido." });
  }

  try {
    // O papel é apenas uma solicitação: o administrador confirma ou altera ao aprovar.
    const { rows: roleRows } = await db.query(q.qSelectRoleById, [Number(id_funcao)]);
    if (!roleRows.length) {
      return res.status(400).json({ message: "Papel solicitado não encontrado." });
    }
    // O papel Master é único e não pode ser solicitado no autocadastro
    if (isMasterRoleName(roleRows[0].name)) {
      return res.status(400).json({ message: "Este papel não pode ser solicitado no cadastro." });
    }

    const hashedPwd = await bcrypt.hash(senha_usuario, 10);
    await db.query(q.qAddNewUser, [name, email, hashedPwd, Number(id_funcao)]);

    return res.status(201).json({
      message: "Cadastro enviado. O acesso será liberado após a aprovação de um administrador.",
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Já existe um cadastro com este e-mail." });
    }
    console.error("Erro no cadastro:", err);
    return res.status(500).json({ message: "Não foi possível concluir o cadastro." });
  }
};

module.exports = { registerUser };
