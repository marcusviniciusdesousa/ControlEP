-- =========================================================
-- CONTROL EP
-- Migration: Estrutura de Funcionários
-- Sprint 2
-- =========================================================


-- =========================================================
-- TABELA POSITION
-- Tabela responsável pelo cadastro dos cargos disponíveis
-- para atribuição aos funcionários
-- =========================================================

CREATE TABLE position (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE
);


-- =========================================================
-- TABELA SECTOR
-- Tabela responsável pelo cadastro dos setores da empresa
-- =========================================================

CREATE TABLE sector (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE
);


-- =========================================================
-- TABELA SHIFT
-- Tabela responsável pelo cadastro dos turnos e seus
-- respectivos horários de início e término
-- =========================================================

CREATE TABLE shift (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE,
    hour_start TIME NOT NULL,
    hour_end TIME NOT NULL
);


-- =========================================================
-- TABELA EMPLOYEE
-- Tabela responsável pelo cadastro dos funcionários e pela
-- associação com cargo, setor, turno e usuários responsáveis
-- =========================================================

CREATE TABLE employee (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    id_position INTEGER NOT NULL,
    code_employee VARCHAR(15),
    login_main_system VARCHAR(15),
    id_sector INTEGER,
    id_shift INTEGER NOT NULL,
    status_active BOOLEAN NOT NULL,
    date_register TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_change_status TIMESTAMPTZ,
    id_user_create INTEGER NOT NULL,
    id_last_user_change INTEGER NOT NULL,

    CONSTRAINT fk_employee_position_id
        FOREIGN KEY (id_position)
        REFERENCES position(id),

    CONSTRAINT fk_employee_sector_id
        FOREIGN KEY (id_sector)
        REFERENCES sector(id),

    CONSTRAINT fk_employee_shift_id
        FOREIGN KEY (id_shift)
        REFERENCES shift(id),

    CONSTRAINT fk_employee_user_create_id
        FOREIGN KEY (id_user_create)
        REFERENCES "user"(id),

    CONSTRAINT fk_employee_last_user_change_id
        FOREIGN KEY (id_last_user_change)
        REFERENCES "user"(id)
);