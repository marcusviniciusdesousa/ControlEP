# Control EP

Controle de presença de funcionários e de uso/empréstimo de equipamentos.

```text
ControlEP/
├── back-end/    # API Node.js + Express + PostgreSQL (Supabase)
│   ├── supabase/migrations/   # histórico do banco (não editar migrations antigas)
│   ├── supabase/seed.sql      # dados de referência para um banco novo
│   ├── scripts/migrate.js     # aplica migrations pendentes
│   └── tests/                 # testes de integração da API
└── front-end/   # React + Vite + TypeScript (ver front-end/README.md)
```

Cada aplicação tem seu próprio `package.json`/`package-lock.json`; não há dependências na raiz.

## Primeira execução

Requer Node.js 22.12+ e um PostgreSQL (local ou Supabase).

```sh
# 1. API
cd back-end
npm ci
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
# edite DATABASE_URL e os segredos ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET
npm run db:migrate -- --seed  # banco novo: cria as tabelas e os dados de referência
npm run dev                   # http://localhost:4500

# 2. Front-end (outro terminal)
cd front-end
npm ci
cp .env.example .env
npm run dev                   # http://localhost:5173
```

**Banco já existente (criado pelo editor SQL do Supabase):** registre uma única vez as migrations antigas e aplique só as novas:

```sh
npm run db:migrate -- --baseline=20261105232914
```

Quem usa o Supabase CLI pode aplicar com `supabase db push`. A migration `20261125220000_sprint_5_auditoria_e_correcoes.sql` é idempotente e também pode ser colada no editor SQL.

**Primeiro administrador:** cadastre-se pela tela de cadastro e aprove o usuário diretamente no banco:

```sql
UPDATE "user" SET approval_status = 'Aprovado', status_active = TRUE,
       id_role = (SELECT id FROM role WHERE name = 'Master')
 WHERE email = 'seu-email@exemplo.com';
```

## Testes

```sh
cd back-end
# Banco descartável: é APAGADO e recriado a cada execução (o nome precisa conter "test")
TEST_DATABASE_URL=postgresql://postgres:senha@localhost:5432/controlep_test npm test

cd ../front-end
npm run typecheck && npm test && npm run build
```
