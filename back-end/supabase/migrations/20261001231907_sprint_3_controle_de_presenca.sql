-- =========================================================
-- CONTROL EP
-- Migration: Controle de Presença
-- Sprint 3
-- =========================================================


-- TABELA ATTENDANCE_STATUS
-- Cadastro dos status disponíveis para classificação
-- da presença dos funcionários

CREATE TABLE attendance_status (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE
);


-- TABELA ATTENDANCE
-- Registro diário da situação de presença dos funcionários,
-- incluindo observação e usuários responsáveis pelo registro

CREATE TABLE attendance (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_employee INTEGER NOT NULL,
    id_attendance_status INTEGER NOT NULL,
    date DATE NOT NULL,
    observation VARCHAR(255),
    date_register TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_last_change TIMESTAMPTZ,
    id_user_create INTEGER NOT NULL,
    id_last_user_change INTEGER NOT NULL,

    CONSTRAINT fk_attendance_employee_id
        FOREIGN KEY (id_employee)
        REFERENCES employee(id),

    CONSTRAINT fk_attendance_status_id
        FOREIGN KEY (id_attendance_status)
        REFERENCES attendance_status(id),

    CONSTRAINT fk_attendance_user_create_id
        FOREIGN KEY (id_user_create)
        REFERENCES "user"(id),

    CONSTRAINT fk_attendance_last_user_change_id
        FOREIGN KEY (id_last_user_change)
        REFERENCES "user"(id),

    UNIQUE (id_employee, date)
);


-- TRIGGER DE ÚLTIMA ALTERAÇÃO DA PRESENÇA
-- Atualiza automaticamente a data da última alteração
-- sempre que um registro de presença for modificado

CREATE OR REPLACE FUNCTION update_attendance_last_change_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.date_last_change = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_attendance_last_change
BEFORE UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION update_attendance_last_change_date();


-- STATUS INICIAIS DE PRESENÇA
-- Valores definidos para o funcionamento do controle de presença

INSERT INTO attendance_status (name)
VALUES
    ('Presente'),
    ('Falta injustificada'),
    ('Atestado'),
    ('Banco de horas'),
    ('Afastado'),
    ('Férias');