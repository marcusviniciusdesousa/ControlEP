import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let App;
let MemoryRouter;

// Smoke test de composição: renderiza rotas, contextos e páginas reais sem precisar de backend.
// Não substitui a verificação visual em navegador.
before(async () => {
  globalThis.window = { innerWidth: 1280 };
  server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: {
      noExternal: ['react-router-dom', 'react-router'],
      resolve: { conditions: ['module', 'module-sync', 'node', 'development'] },
    },
  });
  MemoryRouter = (await server.ssrLoadModule('react-router-dom')).MemoryRouter;
  App = (await server.ssrLoadModule('/src/App.tsx')).default;
});
after(async () => {
  await server?.close();
  delete globalThis.window;
});

const render = (path) =>
  renderToString(
    React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(App)),
  );

// Páginas públicas renderizam diretamente
const publicRoutes = [
  ['/login', 'Bem-vindo de volta'],
  ['/cadastro', 'Crie sua conta'],
  ['/recuperar-senha', 'Recuperar senha'],
  ['/redefinir-senha', 'Link de recuperação inválido'],
];
for (const [path, title] of publicRoutes) {
  test(`rota pública ${path} renderiza a página esperada`, () => {
    const html = render(path);
    assert.ok(html.includes(`<h1>${title}</h1>`));
    assert.ok(!html.includes('class="sidebar"'));
  });
}

// Páginas internas ficam protegidas até a sessão ser confirmada pela API
const protectedRoutes = [
  '/',
  '/funcionarios',
  '/equipamentos',
  '/presenca',
  '/uso-equipamentos',
  '/usuarios',
  '/aprovacoes',
  '/gestao',
  '/pagina-inexistente',
];
for (const path of protectedRoutes) {
  test(`rota protegida ${path} não expõe conteúdo antes de validar a sessão`, () => {
    const html = render(path);
    assert.ok(html.includes('Verificando sessão'));
    assert.ok(!html.includes('class="sidebar"'));
  });
}

test('API: status de usuário, renovação apenas em 401 e empréstimo em aberto', async () => {
  const api = await server.ssrLoadModule('/src/services/api.ts');
  assert.equal(
    api.mapUserStatus({ approval_status: 'Pendente', status_active: false }),
    'Pendente',
  );
  assert.equal(
    api.mapUserStatus({ approval_status: 'Rejeitado', status_active: false }),
    'Rejeitado',
  );
  assert.equal(api.mapUserStatus({ approval_status: 'Aprovado', status_active: false }), 'Inativo');
  assert.equal(api.mapUserStatus({ approval_status: 'Aprovado', status_active: true }), 'Ativo');
  assert.equal(api.isAuthStatus(401), true);
  assert.equal(api.isAuthStatus(403), false);
  const eq = api.mapApiEquipment({
    id: 1,
    name: 'NB',
    equipment_status: 'Em uso',
    open_use_id: 4,
    open_use_employee: 'Rai',
  });
  assert.equal(eq.openUseEmployee, 'Rai');
});
