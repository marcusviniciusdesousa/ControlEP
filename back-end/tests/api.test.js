// Testes de integração da API contra um PostgreSQL real.
// Executar: TEST_DATABASE_URL=postgresql://postgres@localhost:5432/controlep_test npm test

const assert = require("node:assert/strict");
const { before, after, describe, test } = require("node:test");
const { setupDatabase, query, createApprovedUser, startServer, Agent } = require("./helpers");

const ADMIN = { name: "Admin Teste", email: "admin@teste.com", password: "Senha@123", role: "Master" };
const LEADER = { name: "Lider Teste", email: "lider@teste.com", password: "Senha@123", role: "Líder" };

let server;
let admin;
let lookups;
let shifts;

const idOf = (list, name) => list.find((item) => item.name === name)?.id;

before(async () => {
  await setupDatabase();
  await createApprovedUser(ADMIN);
  await createApprovedUser(LEADER);
  server = await startServer();
  admin = new Agent(server.baseUrl);
  const login = await admin.login(ADMIN.email, ADMIN.password);
  assert.equal(login.status, 200, JSON.stringify(login.data));
  lookups = (await admin.get("/lookups")).data;
  shifts = (await admin.get("/shifts")).data;
});

after(async () => {
  await server?.close();
});

describe("autenticação e sessão", () => {
  test("rotas protegidas sem sessão retornam 401 (o front-end tenta renovar)", async () => {
    const anonymous = new Agent(server.baseUrl);
    const res = await anonymous.get("/shifts");
    assert.equal(res.status, 401);
  });

  test("login com senha errada não revela se o e-mail existe", async () => {
    const agent = new Agent(server.baseUrl);
    const wrong = await agent.login(ADMIN.email, "Errada@123");
    const unknown = await agent.login("naoexiste@teste.com", "Errada@123");
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.data.message, unknown.data.message);
  });

  test("refresh renova e rotaciona a sessão; o token anterior tem tolerância curta", async () => {
    const agent = new Agent(server.baseUrl);
    await agent.login(ADMIN.email, ADMIN.password);
    const oldRefresh = agent.cookies.get("refreshToken");

    const refreshed = await agent.get("/refresh");
    assert.equal(refreshed.status, 200);
    assert.notEqual(agent.cookies.get("refreshToken"), oldRefresh, "refresh token deve ser rotacionado");

    // Requisição concorrente com o token antigo (outra aba) ainda funciona
    const otherTab = new Agent(server.baseUrl);
    otherTab.cookies.set("refreshToken", oldRefresh);
    assert.equal((await otherTab.get("/refresh")).status, 200);

    // Após o período de tolerância, o token antigo deixa de valer
    await query("UPDATE user_session SET expires_at = NOW() - INTERVAL '1 second' WHERE expires_at < NOW() + INTERVAL '2 minutes'");
    const late = new Agent(server.baseUrl);
    late.cookies.set("refreshToken", oldRefresh);
    assert.equal((await late.get("/refresh")).status, 401);

    // A sessão atual continua válida
    assert.equal((await agent.get("/refresh")).status, 200);
  });

  test("access token ausente/expirado + refresh válido mantém o usuário conectado", async () => {
    const agent = new Agent(server.baseUrl);
    await agent.login(ADMIN.email, ADMIN.password);
    agent.cookies.delete("accessToken"); // simula expiração do cookie de 15 min
    assert.equal((await agent.get("/shifts")).status, 401);
    assert.equal((await agent.get("/refresh")).status, 200);
    assert.equal((await agent.get("/shifts")).status, 200);
  });

  test("logout encerra a sessão do navegador", async () => {
    const agent = new Agent(server.baseUrl);
    await agent.login(ADMIN.email, ADMIN.password);
    const refreshToken = agent.cookies.get("refreshToken");
    assert.equal((await agent.get("/logout")).status, 204);
    const reuse = new Agent(server.baseUrl);
    reuse.cookies.set("refreshToken", refreshToken);
    assert.equal((await reuse.get("/refresh")).status, 401);
  });

  test("usuário sem permissão recebe 403 (e não 401)", async () => {
    const leader = new Agent(server.baseUrl);
    assert.equal((await leader.login(LEADER.email, LEADER.password)).status, 200);
    assert.equal((await leader.get("/users")).status, 403);
  });
});

describe("cadastro e aprovação de usuários", () => {
  let pendingId;

  test("cadastro fica pendente, aparece na listagem e não consegue entrar", async () => {
    const anonymous = new Agent(server.baseUrl);
    const roleId = idOf((await admin.get("/roles")).data, "Líder");
    const reg = await anonymous.post("/register", {
      nome_usuario: "Novo Usuario",
      email_usuario: "novo@teste.com",
      senha_usuario: "Senha@123",
      id_funcao: roleId,
    });
    assert.equal(reg.status, 201, JSON.stringify(reg.data));

    const duplicate = await anonymous.post("/register", {
      nome_usuario: "Novo Usuario",
      email_usuario: "novo@teste.com",
      senha_usuario: "Senha@123",
      id_funcao: roleId,
    });
    assert.equal(duplicate.status, 409);

    const users = (await admin.get("/users")).data;
    const pending = users.find((u) => u.email === "novo@teste.com");
    assert.ok(pending, "usuário pendente deve aparecer na listagem");
    assert.equal(pending.approval_status, "Pendente");
    assert.equal(pending.status_active, false);
    assert.equal(pending.name, "Novo Usuario", "nome do usuário não pode ser sobrescrito pelo nome do papel");
    pendingId = pending.id;

    const login = await anonymous.login("novo@teste.com", "Senha@123");
    assert.equal(login.status, 403);
    assert.equal(login.data.code, "USER_PENDING");
  });

  test("ativação direta de pendente é bloqueada; aprovação atribui papel e libera acesso", async () => {
    assert.equal((await admin.put(`/users/${pendingId}/status`, { status_active: true })).status, 409);

    const roles = (await admin.get("/roles")).data;
    const masterId = idOf(roles, "Master");
    const leaderId = idOf(roles, "Líder");
    assert.equal((await admin.put(`/users/${pendingId}/approve`, {})).status, 400);

    // Já existe um Master (o administrador): aprovar outro como Master é bloqueado
    const secondMaster = await admin.put(`/users/${pendingId}/approve`, { id_role: masterId });
    assert.equal(secondMaster.status, 409);
    assert.match(secondMaster.data.message, /apenas um/);

    const approved = await admin.put(`/users/${pendingId}/approve`, { id_role: leaderId });
    assert.equal(approved.status, 200);

    const user = (await admin.get("/users")).data.find((u) => u.id === pendingId);
    assert.equal(user.approval_status, "Aprovado");
    assert.equal(user.status_active, true);
    assert.equal(user.id_role, leaderId);

    assert.equal((await new Agent(server.baseUrl).login("novo@teste.com", "Senha@123")).status, 200);
  });

  test("desativar encerra sessões; reativar funciona", async () => {
    const agent = new Agent(server.baseUrl);
    await agent.login("novo@teste.com", "Senha@123");
    assert.equal((await admin.put(`/users/${pendingId}/status`, { status_active: false })).status, 200);
    assert.equal((await agent.get("/refresh")).status, 401);
    assert.equal((await admin.put(`/users/${pendingId}/status`, { status_active: true })).status, 200);
  });

  test("rejeição é persistida", async () => {
    const anonymous = new Agent(server.baseUrl);
    const roleId = idOf((await admin.get("/roles")).data, "Líder");
    await anonymous.post("/register", {
      nome_usuario: "Recusado Teste",
      email_usuario: "recusado@teste.com",
      senha_usuario: "Senha@123",
      id_funcao: roleId,
    });
    const id = (await admin.get("/users")).data.find((u) => u.email === "recusado@teste.com").id;
    assert.equal((await admin.put(`/users/${id}/reject`)).status, 200);
    const { rows } = await query(`SELECT approval_status, status_active FROM "user" WHERE id = $1`, [id]);
    assert.deepEqual(rows[0], { approval_status: "Rejeitado", status_active: false });
    assert.equal((await anonymous.login("recusado@teste.com", "Senha@123")).data.code, "USER_REJECTED");
  });

  test("apenas um Master: troca de papel, cadastro e banco bloqueiam o segundo", async () => {
    const roles = (await admin.get("/roles")).data;
    const masterId = idOf(roles, "Master");
    const user = (await admin.get("/users")).data.find((u) => u.email === "novo@teste.com");

    const change = await admin.put("/users", { id: user.id, name: user.name, email: user.email, id_role: masterId });
    assert.equal(change.status, 409);

    const register = await new Agent(server.baseUrl).post("/register", {
      nome_usuario: "Quer Ser Master",
      email_usuario: "master2@teste.com",
      senha_usuario: "Senha@123",
      id_funcao: masterId,
    });
    assert.equal(register.status, 400);

    // Mesmo um UPDATE direto no banco é recusado pelo trigger
    await assert.rejects(query(`UPDATE "user" SET id_role = $1 WHERE id = $2`, [masterId, user.id]), /apenas um/);

    // Não é possível criar um segundo papel Master
    assert.equal((await admin.post("/roles", { name: "Master 2" })).status, 409);
  });

  test("administrador não pode desativar a si mesmo", async () => {
    const me = (await admin.get("/refreshUser")).data;
    assert.equal((await admin.put(`/users/${me.id}/status`, { status_active: false })).status, 409);
  });
});

describe("turnos", () => {
  let shiftId;

  test("cria turno com dias da semana", async () => {
    const res = await admin.post("/shifts", {
      name: "Plantão Sábado",
      hour_start: "08:00",
      hour_end: "12:00",
      days_of_week: [6],
    });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    assert.deepEqual(res.data.shift.days_of_week, [6]);
    shiftId = res.data.shift.id;
  });

  test("bloqueia nome duplicado (sem diferenciar maiúsculas) e horário duplicado", async () => {
    const byName = await admin.post("/shifts", { name: "plantão sábado", hour_start: "09:00", hour_end: "10:00", days_of_week: [6] });
    assert.equal(byName.status, 409);
    assert.match(byName.data.message, /nome/);

    const byHours = await admin.post("/shifts", { name: "Outro", hour_start: "07:00", hour_end: "13:00", days_of_week: [1] });
    assert.equal(byHours.status, 409);
    assert.match(byHours.data.message, /horário/);
  });

  test("edição mantém os próprios dados e persiste alterações", async () => {
    const same = await admin.put("/shifts", { id: shiftId, name: "Plantão Sábado", hour_start: "08:00", hour_end: "12:00", days_of_week: [6] });
    assert.equal(same.status, 200);

    const changed = await admin.put("/shifts", { id: shiftId, name: "Plantão Fim de Semana", hour_start: "08:00", hour_end: "14:00", days_of_week: [0, 6] });
    assert.equal(changed.status, 200);
    const stored = (await admin.get("/shifts")).data.find((s) => s.id === shiftId);
    assert.deepEqual(stored, { id: shiftId, name: "Plantão Fim de Semana", hour_start: "08:00", hour_end: "14:00", days_of_week: [0, 6] });

    const conflict = await admin.put("/shifts", { id: shiftId, name: "Manhã", hour_start: "08:00", hour_end: "14:00", days_of_week: [0] });
    assert.equal(conflict.status, 409);
  });

  test("valida dias da semana", async () => {
    for (const days of [[], [7], [1, 1], "seg"]) {
      const res = await admin.post("/shifts", { name: "Inválido", hour_start: "01:00", hour_end: "02:00", days_of_week: days });
      assert.equal(res.status, 400, `dias ${JSON.stringify(days)}`);
    }
  });
});

describe("funcionários e presença", () => {
  let employeeId;
  const manha = () => idOf(shifts, "Manhã"); // segunda a sexta no seed
  const presentId = () => idOf(lookups.attendance_statuses, "Presente");

  test("cadastro exige data de admissão", async () => {
    const base = { name: "Maria Silva", id_position: lookups.positions[0].id, id_shift: manha() };
    assert.equal((await admin.post("/employees", base)).status, 400);
    const res = await admin.post("/employees", { ...base, date_admission: "2026-11-03" });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    assert.equal(res.data.employee.date_admission, "2026-11-03");
    assert.equal(res.data.employee.name, "Maria Silva");
    employeeId = res.data.employee.id;
  });

  test("não registra presença antes da admissão (inclusive via API direta)", async () => {
    const res = await admin.post("/presence", { id_employee: employeeId, date: "2026-11-02", id_attendance_status: presentId() });
    assert.equal(res.status, 422);
    assert.match(res.data.message, /admissão/);
  });

  test("não registra presença em dia fora da escala do turno", async () => {
    // 2026-11-08 é domingo
    const res = await admin.put("/presence", { id_employee: employeeId, date: "2026-11-08", id_attendance_status: presentId() });
    assert.equal(res.status, 422);
    assert.match(res.data.message, /domingo/);
  });

  test("registra, altera e remove presença válida", async () => {
    const created = await admin.post("/presence", { id_employee: employeeId, date: "2026-11-04", id_attendance_status: presentId() });
    assert.equal(created.status, 201);
    const absent = idOf(lookups.attendance_statuses, "Falta injustificada");
    const updated = await admin.post("/presence", { id: created.data.attendance.id, id_attendance_status: absent });
    assert.equal(updated.status, 200);

    const list = (await admin.get("/presence?from=2026-11-01&to=2026-11-30")).data.attendance;
    assert.equal(list.find((a) => a.id_employee === employeeId).attendance_status, "Falta injustificada");

    assert.equal((await admin.delete(`/presence/${created.data.attendance.id}`)).status, 200);
  });

  test("marcar todos presentes respeita admissão, escala e funcionários inativos", async () => {
    const inactive = await admin.post("/employees", {
      name: "Joao Inativo", id_position: lookups.positions[0].id, id_shift: manha(), date_admission: "2026-01-01", status_active: false,
    });
    assert.equal(inactive.status, 201);

    // 2026-11-02 (seg, antes da admissão de Maria) a 2026-11-08 (dom)
    const res = await admin.post("/presence/all", { from: "2026-11-02", to: "2026-11-08" });
    assert.equal(res.status, 200);
    const { rows } = await query(
      "SELECT id_employee, to_char(date,'YYYY-MM-DD') AS date FROM attendance WHERE date BETWEEN '2026-11-02' AND '2026-11-08' ORDER BY date",
    );
    assert.deepEqual(
      rows.map((r) => r.date),
      ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"],
    );
    assert.ok(rows.every((r) => r.id_employee === employeeId));
  });

  test("admissão não pode ser alterada para depois de presenças existentes", async () => {
    const employee = (await admin.get(`/employees/${employeeId}`)).data;
    const payload = { id: employeeId, name: employee.name, id_position: employee.id_position, id_shift: employee.id_shift, date_admission: "2026-11-05" };
    assert.equal((await admin.put("/employees", payload)).status, 409);
  });

  test("status do funcionário alterna nos dois sentidos", async () => {
    assert.equal((await admin.put(`/employees/${employeeId}/status`, { status_active: false })).status, 200);
    assert.equal((await admin.get(`/employees/${employeeId}`)).data.status_active, false);
    assert.equal((await admin.put(`/employees/${employeeId}/status`, { status_active: true })).status, 200);
    assert.equal((await admin.get(`/employees/${employeeId}`)).data.status_active, true);

    // Edição com status também persiste
    const employee = (await admin.get(`/employees/${employeeId}`)).data;
    const res = await admin.put("/employees", {
      id: employeeId, name: employee.name, id_position: employee.id_position, id_shift: employee.id_shift,
      date_admission: employee.date_admission, status_active: false,
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.employee.status_active, false);
    await admin.put(`/employees/${employeeId}/status`, { status_active: true });
  });

  test("dashboard: ativos atualmente ignoram o filtro de data e inativos não contam", async () => {
    const res = await admin.get("/dashboard?from=2026-11-01&to=2026-11-30");
    assert.equal(res.status, 200);
    assert.equal(res.data.employees.active_now, 1);
    assert.equal(res.data.employees.inactive_now, 1);
    const present = res.data.attendance.byStatus.find((s) => s.status === "Presente");
    assert.equal(present.quantity, 4);
    assert.ok(res.data.attendance.byEmployee.every((e) => e.status_active), "inativo sem registros no período não aparece");
  });

  test("funcionário com histórico não é excluído fisicamente", async () => {
    const res = await admin.delete(`/employees/${employeeId}`);
    assert.equal(res.status, 409);
  });
});

describe("equipamentos e empréstimos", () => {
  let equipmentId;
  let employeeId;
  let useId;
  const statusId = (name) => idOf(lookups.equipment_statuses, name);
  const typeId = (name) => idOf(lookups.equipment_types, name);

  const getEquipment = async (id) => (await admin.get(`/equipments/${id}`)).data.equipment;

  before(async () => {
    const res = await admin.post("/employees", {
      name: "Carlos Souza", id_position: lookups.positions[0].id, id_shift: idOf(shifts, "Tarde"), date_admission: "2026-01-01",
    });
    employeeId = res.data.employee.id;
  });

  test("status de presença 'Dispensa baixa volumetria' está disponível", async () => {
    assert.ok(idOf(lookups.attendance_statuses, "Dispensa baixa volumetria"));
  });

  test("tipos e status vêm do banco (sem IDs fixos no front-end)", async () => {
    assert.ok(typeId("Notebook"));
    assert.ok(statusId("Disponível"));
    assert.ok(statusId("Em uso"));
  });

  test("cadastra equipamento; 'Em uso' não pode ser definido manualmente", async () => {
    const base = { name: "Notebook 01", id_equipment_type: typeId("Notebook"), heritage_code: "PAT001" };
    assert.equal((await admin.post("/equipments", { ...base, id_equipment_status: statusId("Em uso") })).status, 400);
    const res = await admin.post("/equipments", { ...base, id_equipment_status: statusId("Disponível") });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    equipmentId = res.data.equipment.id;
  });

  test("edição com tipo válido persiste (corrige 'Tipo de equipamento não encontrado')", async () => {
    const res = await admin.put("/equipments", {
      id: equipmentId, name: "Notebook Teste Alterado", id_equipment_type: typeId("Notebook"), heritage_code: "PAT001", id_sector: null, observation: null,
    });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.equal((await getEquipment(equipmentId)).name, "Notebook Teste Alterado");
  });

  test("registrar uso muda o status para 'Em uso' e reflete na listagem e no dashboard", async () => {
    const res = await admin.post("/equipment-uses", { id_equipment: equipmentId, id_employee: employeeId });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    useId = res.data.use.id;

    const equipment = await getEquipment(equipmentId);
    assert.equal(equipment.equipment_status, "Em uso");
    assert.equal(equipment.open_use_employee, "Carlos Souza");

    const listed = (await admin.get("/equipments")).data.equipment.find((e) => e.id === equipmentId);
    assert.equal(listed.equipment_status, "Em uso");

    const dashboard = (await admin.get("/dashboard")).data;
    assert.equal(dashboard.equipment.in_use, 1);
    assert.equal(dashboard.equipment.byStatus.find((s) => s.status === "Em uso").quantity, 1);
  });

  test("não permite segundo empréstimo, troca manual de status nem exclusão enquanto em uso", async () => {
    assert.equal((await admin.post("/equipment-uses", { id_equipment: equipmentId, id_employee: employeeId })).status, 409);
    assert.equal((await admin.put("/equipments/status", { id: equipmentId, id_equipment_status: statusId("Manutenção") })).status, 409);
    assert.equal((await admin.delete(`/equipments/${equipmentId}`)).status, 409);
  });

  test("devolução volta o status para 'Disponível' e mantém o histórico", async () => {
    const res = await admin.put(`/equipment-uses/${useId}/return`, {});
    assert.equal(res.status, 200, JSON.stringify(res.data));
    assert.ok(res.data.use.date_return);
    assert.equal((await getEquipment(equipmentId)).equipment_status, "Disponível");
    assert.equal((await admin.put(`/equipment-uses/${useId}/return`, {})).status, 409);

    const history = (await admin.get(`/equipments/${equipmentId}/history`)).data.uses;
    assert.equal(history.length, 1);
    assert.equal((await admin.get("/dashboard")).data.equipment.in_use, 0);
  });

  test("equipamento em manutenção não pode ser emprestado", async () => {
    assert.equal((await admin.put("/equipments/status", { id: equipmentId, id_equipment_status: statusId("Manutenção") })).status, 200);
    assert.equal((await admin.post("/equipment-uses", { id_equipment: equipmentId, id_employee: employeeId })).status, 409);
    await admin.put("/equipments/status", { id: equipmentId, id_equipment_status: statusId("Disponível") });
  });

  test("exclusão: com histórico é lógica (preserva usos), sem histórico é física", async () => {
    const res = await admin.delete(`/equipments/${equipmentId}`);
    assert.equal(res.status, 200);
    assert.equal(res.data.logical, true);
    assert.equal((await admin.get(`/equipments/${equipmentId}`)).status, 404);
    assert.ok(!(await admin.get("/equipments")).data.equipment.some((e) => e.id === equipmentId));
    const { rows } = await query("SELECT COUNT(*)::int AS n FROM equipment_use WHERE id_equipment = $1", [equipmentId]);
    assert.equal(rows[0].n, 1);

    // O código patrimonial pode ser reutilizado após a exclusão lógica
    const reused = await admin.post("/equipments", {
      name: "Notebook Novo", id_equipment_type: typeId("Notebook"), heritage_code: "PAT001", id_equipment_status: statusId("Disponível"),
    });
    assert.equal(reused.status, 201);

    const physical = await admin.delete(`/equipments/${reused.data.equipment.id}`);
    assert.equal(physical.status, 200);
    assert.equal(physical.data.logical, false);
  });
});
