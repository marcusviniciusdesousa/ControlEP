// Tratamento centralizado de erros não capturados pelas rotas.

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "JSON inválido na requisição." });
  }

  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "Origem não autorizada." });
  }

  console.error(err);
  if (res.headersSent) return;
  return res.status(500).json({ message: "Erro interno do servidor." });
};

const notFound = (req, res) => {
  res.status(404).json({ message: "Rota não encontrada." });
};

module.exports = { errorHandler, notFound };
