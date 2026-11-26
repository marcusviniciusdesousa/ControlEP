require("dotenv").config({ quiet: true });

const { Pool } = require("pg");

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase e a maioria dos provedores exigem SSL; em banco local use DATABASE_SSL=false.
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
});

// Evita que um erro de conexão ociosa derrube o processo.
db.on("error", (err) => {
  console.error("Erro inesperado no pool do PostgreSQL:", err.message);
});

/**
 * Executa `fn` dentro de uma transação. Faz COMMIT se `fn` terminar sem erro
 * e ROLLBACK caso contrário, sempre devolvendo a conexão ao pool.
 */
const withTransaction = async (fn) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

module.exports = db;
module.exports.withTransaction = withTransaction;
