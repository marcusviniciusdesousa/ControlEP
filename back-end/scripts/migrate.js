// Aplica as migrations de supabase/migrations em ordem, registrando cada uma na
// tabela app_schema_migrations para não executá-la duas vezes.
//
// Uso:
//   npm run db:migrate                 aplica as migrations pendentes
//   npm run db:migrate -- --seed       aplica e depois executa supabase/seed.sql
//   npm run db:seed                    executa apenas supabase/seed.sql
//   npm run db:migrate -- --baseline=20261105232914
//       registra como já aplicadas (sem executar) as migrations até a versão
//       informada. Use uma única vez em bancos criados antes deste script, por
//       exemplo pelo editor SQL do Supabase.
//
// Quem usa o Supabase CLI pode continuar com `supabase db push`.
require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const MIGRATIONS_DIR = path.join(__dirname, "..", "supabase", "migrations");
const SEED_FILE = path.join(__dirname, "..", "supabase", "seed.sql");

const args = process.argv.slice(2);
const seedOnly = args.includes("--seed-only");
const withSeed = args.includes("--seed") || seedOnly;
const baselineArg = args.find((a) => a.startsWith("--baseline="));
const baseline = baselineArg ? baselineArg.split("=")[1] : null;

const run = async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não definida (.env).");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? false : process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    if (!seedOnly) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_schema_migrations (
          version VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );`);

      const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
      const { rows } = await client.query("SELECT version FROM app_schema_migrations");
      const applied = new Set(rows.map((r) => r.version));

      for (const file of files) {
        const version = file.split("_")[0];
        if (applied.has(version)) continue;

        if (baseline && version <= baseline) {
          await client.query("INSERT INTO app_schema_migrations (version) VALUES ($1)", [version]);
          console.log(`= ${file} (registrada como já aplicada)`);
          continue;
        }

        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
        await client.query("BEGIN");
        try {
          await client.query(sql);
          await client.query("INSERT INTO app_schema_migrations (version) VALUES ($1)", [version]);
          await client.query("COMMIT");
          console.log(`+ ${file}`);
        } catch (err) {
          await client.query("ROLLBACK");
          throw new Error(`Falha em ${file}: ${err.message}`);
        }
      }
    }

    if (withSeed) {
      await client.query(fs.readFileSync(SEED_FILE, "utf8"));
      console.log("+ seed.sql");
    }
    console.log("Banco atualizado.");
  } finally {
    await client.end();
  }
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
