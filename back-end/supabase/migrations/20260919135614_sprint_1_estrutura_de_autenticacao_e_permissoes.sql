-- =========================================================
-- CONTROL EP
-- Migration: Estrutura inicial de autenticação e permissões
-- Sprint 1
-- =========================================================


-- =========================================================
-- TABELA ROLE
-- Tabela responsável pelo cadastro dos papéis disponíveis
-- para atribuição aos usuários do sistema
-- =========================================================

CREATE TABLE role (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE
);


-- =========================================================
-- TABELA PERMISSION
-- Tabela responsável pelo cadastro das permissões que serão
-- atribuídas a cada papel do sistema
-- =========================================================

CREATE TABLE permission (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE
);


-- =========================================================
-- TABELA USER
-- Tabela responsável pelo cadastro dos usuários do sistema
-- e pela associação de cada usuário ao seu respectivo papel
-- =========================================================

CREATE TABLE "user" (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    id_role INTEGER NOT NULL,
    status_active BOOLEAN NOT NULL DEFAULT FALSE,
    date_register TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_change_status TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_role_id
        FOREIGN KEY (id_role)
        REFERENCES role(id)
);


-- =========================================================
-- TABELA ROLE_PERMISSION
-- Tabela responsável por relacionar os papéis às permissões
-- atribuídas a cada um deles
-- =========================================================

CREATE TABLE role_permission (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_role INTEGER NOT NULL,
    id_permission INTEGER NOT NULL,

    CONSTRAINT fk_role_permission_role_id
        FOREIGN KEY (id_role)
        REFERENCES role(id),

    CONSTRAINT fk_role_permission_permission_id
        FOREIGN KEY (id_permission)
        REFERENCES permission(id),

    UNIQUE (id_role, id_permission)
);


-- =========================================================
-- FUNÇÃO DE ATUALIZAÇÃO DO STATUS
-- Atualiza a data da última alteração do status do usuário
-- =========================================================

CREATE OR REPLACE FUNCTION update_user_status_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.date_change_status = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- TRIGGER DE ALTERAÇÃO DO STATUS
-- Executa a função sempre que status_active for alterado
-- =========================================================

CREATE TRIGGER trg_user_status_change
BEFORE UPDATE OF status_active ON "user"
FOR EACH ROW
WHEN (OLD.status_active IS DISTINCT FROM NEW.status_active)
EXECUTE FUNCTION update_user_status_date();