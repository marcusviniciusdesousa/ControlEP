-- =========================================================
-- CONTROL EP
-- Migration: Estrutura de Equipamentos
-- Sprint 3
-- =========================================================


-- TABELA EQUIPMENT_TYPE
-- Cadastro dos tipos disponíveis para classificação
-- dos equipamentos

CREATE TABLE equipment_type (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(40) NOT NULL UNIQUE
);


-- TABELA EQUIPMENT_STATUS
-- Cadastro dos status disponíveis para os equipamentos

CREATE TABLE equipment_status (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(40) NOT NULL UNIQUE
);


-- TABELA EQUIPMENT
-- Cadastro dos equipamentos e associação com tipo,
-- status, setor e usuários responsáveis pelo registro

CREATE TABLE equipment (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(40) NOT NULL,
    id_equipment_type INTEGER NOT NULL,
    id_equipment_status INTEGER NOT NULL,
    heritage_code VARCHAR(20) NOT NULL UNIQUE,
    id_sector INTEGER,
    observation VARCHAR(20),
    date_register TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_change_status TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_user_create INTEGER NOT NULL,
    id_last_user_change INTEGER NOT NULL,

    CONSTRAINT fk_equipment_type_id
        FOREIGN KEY (id_equipment_type)
        REFERENCES equipment_type(id),

    CONSTRAINT fk_equipment_status_id
        FOREIGN KEY (id_equipment_status)
        REFERENCES equipment_status(id),

    CONSTRAINT fk_equipment_sector_id
        FOREIGN KEY (id_sector)
        REFERENCES sector(id),

    CONSTRAINT fk_equipment_user_create_id
        FOREIGN KEY (id_user_create)
        REFERENCES "user"(id),

    CONSTRAINT fk_equipment_last_user_change_id
        FOREIGN KEY (id_last_user_change)
        REFERENCES "user"(id)
);


-- TRIGGER DE ALTERAÇÃO DE STATUS DO EQUIPAMENTO
-- Atualiza automaticamente a data da última alteração
-- quando o status do equipamento for modificado

CREATE OR REPLACE FUNCTION update_equipment_status_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.date_change_status = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_equipment_status_change
BEFORE UPDATE OF id_equipment_status ON equipment
FOR EACH ROW
WHEN (OLD.id_equipment_status IS DISTINCT FROM NEW.id_equipment_status)
EXECUTE FUNCTION update_equipment_status_date();