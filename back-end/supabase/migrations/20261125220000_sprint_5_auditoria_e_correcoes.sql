-- =========================================================
-- CONTROL EP
-- Migration: Auditoria e correções
-- Sprint 5
--
-- Esta migration não altera migrations anteriores. Todas as
-- instruções são idempotentes (IF NOT EXISTS / ON CONFLICT /
-- blocos DO) para que possa ser aplicada com segurança em
-- ambientes que já receberam ajustes manuais.
-- =========================================================


-- =========================================================
-- 1. TURNOS: dias da semana de validade e unicidade
-- =========================================================

-- Dias da semana no padrão do PostgreSQL (EXTRACT(DOW)) e do
-- JavaScript (Date#getDay): 0 = domingo ... 6 = sábado.
-- Turnos já existentes passam a valer todos os dias, preservando
-- o comportamento anterior.
ALTER TABLE shift
    ADD COLUMN IF NOT EXISTS days_of_week SMALLINT[] NOT NULL
        DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[];

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_shift_days_of_week'
    ) THEN
        ALTER TABLE shift
            ADD CONSTRAINT chk_shift_days_of_week CHECK (
                cardinality(days_of_week) BETWEEN 1 AND 7
                AND days_of_week <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[]
            );
    END IF;
END $$;

-- Nome único sem diferenciar maiúsculas/minúsculas e espaços
-- (a constraint UNIQUE original diferencia "Manhã" de "manhã").
-- Horário de início + término único.
-- Os índices só são criados se os dados atuais já forem
-- consistentes; caso contrário, a migration não falha e avisa
-- para que os duplicados sejam tratados manualmente. A API
-- valida as mesmas regras em qualquer cenário.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM shift GROUP BY LOWER(TRIM(name)) HAVING COUNT(*) > 1
    ) THEN
        RAISE NOTICE 'Existem turnos com nomes duplicados; índice uq_shift_name_ci não criado.';
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_name_ci ON shift (LOWER(TRIM(name)));
    END IF;

    IF EXISTS (
        SELECT 1 FROM shift GROUP BY hour_start, hour_end HAVING COUNT(*) > 1
    ) THEN
        RAISE NOTICE 'Existem turnos com o mesmo horário; índice uq_shift_hours não criado.';
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_hours ON shift (hour_start, hour_end);
    END IF;
END $$;


-- =========================================================
-- 2. FUNCIONÁRIOS: data de admissão/início
-- =========================================================

ALTER TABLE employee ADD COLUMN IF NOT EXISTS date_admission DATE;

-- Preenche registros antigos com a data mais antiga conhecida do
-- funcionário (cadastro, presença ou uso de equipamento), para que
-- a nova validação não invalide históricos já gravados.
UPDATE employee e
SET date_admission = LEAST(
    e.date_register::DATE,
    COALESCE((SELECT MIN(a.date) FROM attendance a WHERE a.id_employee = e.id), e.date_register::DATE),
    COALESCE((SELECT MIN(u.date_start)::DATE FROM equipment_use u WHERE u.id_employee = e.id), e.date_register::DATE)
)
WHERE e.date_admission IS NULL;

ALTER TABLE employee ALTER COLUMN date_admission SET NOT NULL;


-- =========================================================
-- 3. USUÁRIOS: fluxo de aprovação
-- =========================================================

-- status_active continua indicando se o acesso está ativo.
-- approval_status registra a decisão administrativa sobre o
-- cadastro, permitindo diferenciar pendente, aprovado e rejeitado.
ALTER TABLE "user"
    ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS id_user_approval INTEGER,
    ADD COLUMN IF NOT EXISTS date_approval TIMESTAMPTZ;

-- Usuários ativos já estavam aprovados. Inativos não podem ser
-- distinguidos com segurança entre "pendente" e "desativado";
-- ficam como pendentes para revisão na tela de aprovações.
UPDATE "user"
SET approval_status = CASE WHEN status_active THEN 'Aprovado' ELSE 'Pendente' END
WHERE approval_status IS NULL;

ALTER TABLE "user" ALTER COLUMN approval_status SET DEFAULT 'Pendente';
ALTER TABLE "user" ALTER COLUMN approval_status SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_approval_status') THEN
        ALTER TABLE "user"
            ADD CONSTRAINT chk_user_approval_status
            CHECK (approval_status IN ('Pendente', 'Aprovado', 'Rejeitado'));
    END IF;

    -- Só pode estar ativo quem foi aprovado.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_active_requires_approval') THEN
        ALTER TABLE "user"
            ADD CONSTRAINT chk_user_active_requires_approval
            CHECK (status_active = FALSE OR approval_status = 'Aprovado');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_approval_user_id') THEN
        ALTER TABLE "user"
            ADD CONSTRAINT fk_user_approval_user_id
            FOREIGN KEY (id_user_approval) REFERENCES "user"(id);
    END IF;
END $$;


-- =========================================================
-- 4. EQUIPAMENTOS: exclusão lógica e status obrigatórios
-- =========================================================

ALTER TABLE equipment
    ADD COLUMN IF NOT EXISTS date_deleted TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS id_user_delete INTEGER;

DO $$
DECLARE
    v_constraint TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_equipment_user_delete_id') THEN
        ALTER TABLE equipment
            ADD CONSTRAINT fk_equipment_user_delete_id
            FOREIGN KEY (id_user_delete) REFERENCES "user"(id);
    END IF;

    -- O código patrimonial passa a ser único apenas entre os
    -- equipamentos não excluídos, permitindo reaproveitar o código
    -- de um equipamento excluído logicamente.
    SELECT c.conname INTO v_constraint
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = 'equipment'::regclass
      AND c.contype = 'u'
      AND a.attname = 'heritage_code'
      AND cardinality(c.conkey) = 1;

    IF v_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE equipment DROP CONSTRAINT %I', v_constraint);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_heritage_code_active
    ON equipment (heritage_code)
    WHERE date_deleted IS NULL;

-- Status dos quais a regra de empréstimo depende. Já existiam no
-- banco em uso; o INSERT apenas garante sua presença em ambientes
-- novos e não altera os registros existentes.
INSERT INTO equipment_status (name)
VALUES ('Disponível'), ('Em uso')
ON CONFLICT (name) DO NOTHING;

-- Sincroniza o status com os empréstimos em aberto já registrados.
UPDATE equipment e
SET id_equipment_status = (SELECT id FROM equipment_status WHERE name = 'Em uso')
WHERE EXISTS (
    SELECT 1 FROM equipment_use u WHERE u.id_equipment = e.id AND u.date_return IS NULL
)
AND e.id_equipment_status <> (SELECT id FROM equipment_status WHERE name = 'Em uso');


-- =========================================================
-- 5. ÍNDICES DE APOIO
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_user_session_user ON user_session (id_user);
CREATE INDEX IF NOT EXISTS idx_user_session_expires ON user_session (expires_at);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance (date);
CREATE INDEX IF NOT EXISTS idx_equipment_use_employee ON equipment_use (id_employee);
CREATE INDEX IF NOT EXISTS idx_equipment_use_start ON equipment_use (date_start);
