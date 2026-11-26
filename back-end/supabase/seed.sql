-- =========================================================
-- CONTROL EP
-- Dados de referência para um ambiente novo
--
-- Execute depois de todas as migrations. É idempotente: pode ser
-- executado novamente sem duplicar nem alterar registros.
-- Não cria usuários: o primeiro usuário administrador deve ser
-- cadastrado pela tela de cadastro e aprovado manualmente
-- (ver README do back-end).
-- =========================================================

-- Permissões verificadas pelo back-end (config/rolesPermissionsList.js).
-- Os nomes precisam ser exatamente estes.
INSERT INTO permission (name) VALUES
    ('Usuários'),
    ('Funcionários'),
    ('Equipamentos'),
    ('Turnos'),
    ('Papéis'),
    ('Relatórios'),
    ('Presença')
ON CONFLICT (name) DO NOTHING;

-- Papéis iniciais
INSERT INTO role (name) VALUES ('Master'), ('Líder')
ON CONFLICT (name) DO NOTHING;

-- Master recebe todas as permissões
INSERT INTO role_permission (id_role, id_permission)
SELECT r.id, p.id
FROM role r CROSS JOIN permission p
WHERE r.name = 'Master'
ON CONFLICT (id_role, id_permission) DO NOTHING;

-- Líder: operação do dia a dia
INSERT INTO role_permission (id_role, id_permission)
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN ('Funcionários', 'Equipamentos', 'Presença', 'Relatórios')
WHERE r.name = 'Líder'
ON CONFLICT (id_role, id_permission) DO NOTHING;

-- Cargos e setores
INSERT INTO position (name) VALUES ('Operador'), ('Líder'), ('Supervisor')
ON CONFLICT (name) DO NOTHING;

INSERT INTO sector (name) VALUES ('Operações'), ('Administrativo')
ON CONFLICT (name) DO NOTHING;

-- Turnos padrão (segunda a sexta)
INSERT INTO shift (name, hour_start, hour_end, days_of_week) VALUES
    ('Manhã', '07:00', '13:00', ARRAY[1, 2, 3, 4, 5]::SMALLINT[]),
    ('Tarde', '13:00', '19:00', ARRAY[1, 2, 3, 4, 5]::SMALLINT[]),
    ('Noite', '19:00', '01:00', ARRAY[1, 2, 3, 4, 5]::SMALLINT[])
ON CONFLICT DO NOTHING;

-- Equipamentos
INSERT INTO equipment_type (name) VALUES
    ('PDA'), ('Notebook'), ('Rádio'), ('Tablet'), ('Celular'), ('Outro')
ON CONFLICT (name) DO NOTHING;

INSERT INTO equipment_status (name) VALUES
    ('Disponível'), ('Em uso'), ('Manutenção'), ('Inativo')
ON CONFLICT (name) DO NOTHING;
