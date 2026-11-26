// Infraestrutura dos testes de integração: cria um banco PostgreSQL limpo,
// aplica as migrations + seed e sobe a API em uma porta aleatória.
//
// Requer TEST_DATABASE_URL apontando para um servidor PostgreSQL onde o usuário
// possa criar bancos, ex.: postgresql://postgres@localhost:5432/controlep_test
// O banco informado é APAGADO e recriado a cada execução.

const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { Client } = require("pg");
const bcrypt = require("bcrypt");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const setupDatabase = async () => {
  if (!TEST_DATABASE_URL) {
    throw new Error("Defina TEST_DATABASE_URL para executar os testes de integração.");
  }
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  if (!/test/i.test(dbName)) throw new Error("Por segurança, o nome do banco de teste deve conter 'test'.");

  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  execFileSync(process.execPath, [path.join(__dirname, "..", "scripts", "migrate.js"), "--seed"], {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DATABASE_SSL: "false" },
    stdio: "pipe",
  });
};

const query = async (sql, params) => {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
};

/** Cria um usuário aprovado com o papel informado (por nome). */
const createApprovedUser = async ({ name, email, password, role }) => {
  const hash = await bcrypt.hash(password, 4);
  const { rows } = await query(
    `INSERT INTO "user" (name, email, password_hash, id_role, status_active, approval_status)
     SELECT $1, $2, $3, id, TRUE, 'Aprovado' FROM role WHERE name = $4 RETURNING id`,
    [name, email, hash, role],
  );
  return rows[0].id;
};

const startServer = async () => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.DATABASE_SSL = "false";
  process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
  process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
  const app = require("../server");
  const db = require("../db");
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    baseUrl,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await db.end();
    },
  };
};

/** Cliente HTTP com "pote" de cookies, simulando um navegador. */
class Agent {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
  }

  storeCookies(res) {
    for (const header of res.headers.getSetCookie()) {
      const [pair, ...attrs] = header.split(";");
      const [name, ...rest] = pair.split("=");
      const value = rest.join("=");
      const expired = attrs.some((a) => /expires=thu, 01 jan 1970/i.test(a.trim())) || value === "";
      if (expired) this.cookies.delete(name.trim());
      else this.cookies.set(name.trim(), value);
    }
  }

  async request(method, path, body) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.cookies.size) {
      headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    }
    const res = await fetch(this.baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    this.storeCookies(res);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }
    return { status: res.status, data };
  }

  get(path) { return this.request("GET", path); }
  post(path, body) { return this.request("POST", path, body); }
  put(path, body) { return this.request("PUT", path, body); }
  delete(path) { return this.request("DELETE", path); }

  login(email, password) {
    return this.post("/auth", { email_usuario: email, senha_usuario: password });
  }
}

module.exports = { setupDatabase, query, createApprovedUser, startServer, Agent };
