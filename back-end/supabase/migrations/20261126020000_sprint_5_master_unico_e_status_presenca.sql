-- =========================================================
-- CONTROL EP
-- Migration: Master único e novo status de presença
-- Sprint 5
--
-- Idempotente: pode ser executada mais de uma vez.
-- =========================================================


-- =========================================================
-- 1. NOVO STATUS DE PRESENÇA
-- =========================================================

INSERT INTO attendance_status (name)
VALUES ('Dispensa baixa volumetria')
ON CONFLICT (name) DO NOTHING;


-- =========================================================
-- 2. APENAS UM USUÁRIO MASTER
--
-- O papel Master é identificado pelo nome (começando por "Master",
-- sem diferenciar maiúsculas). A regra impede que um SEGUNDO usuário
-- passe a ter esse papel, seja por cadastro, aprovação ou troca de papel.
--
-- Usuários Master que já existirem em duplicidade NÃO são alterados
-- automaticamente: escolha qual permanece e altere o papel dos demais
-- (a tela de Usuários avisa quando houver mais de um).
-- =========================================================

CREATE OR REPLACE FUNCTION is_master_role(p_role_id INTEGER)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM role WHERE id = p_role_id AND LOWER(TRIM(name)) LIKE 'master%'
    );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION enforce_single_master()
RETURNS TRIGGER AS $$
DECLARE
    v_existing TEXT;
BEGIN
    IF is_master_role(NEW.id_role)
       AND (TG_OP = 'INSERT' OR OLD.id_role IS DISTINCT FROM NEW.id_role) THEN

        SELECT u.name INTO v_existing
          FROM "user" u
         WHERE u.id <> NEW.id AND is_master_role(u.id_role)
         LIMIT 1;

        IF v_existing IS NOT NULL THEN
            RAISE EXCEPTION 'Já existe um usuário Master (%). O sistema permite apenas um.', v_existing
                USING ERRCODE = 'P0001', CONSTRAINT = 'single_master';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_single_master ON "user";

CREATE TRIGGER trg_user_single_master
BEFORE INSERT OR UPDATE OF id_role ON "user"
FOR EACH ROW
EXECUTE FUNCTION enforce_single_master();
