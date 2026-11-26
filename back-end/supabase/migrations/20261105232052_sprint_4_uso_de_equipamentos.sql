CREATE TABLE equipment_use (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    id_employee INTEGER NOT NULL,
    id_equipment INTEGER NOT NULL,

    date_start TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_return TIMESTAMPTZ,

    observation VARCHAR(255),

    date_register TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_last_change TIMESTAMPTZ,

    id_user_create INTEGER NOT NULL,
    id_last_user_change INTEGER NOT NULL,

    CONSTRAINT fk_equipment_use_employee
        FOREIGN KEY (id_employee)
        REFERENCES employee(id),

    CONSTRAINT fk_equipment_use_equipment
        FOREIGN KEY (id_equipment)
        REFERENCES equipment(id),

    CONSTRAINT fk_equipment_use_user_create
        FOREIGN KEY (id_user_create)
        REFERENCES "user"(id),

    CONSTRAINT fk_equipment_use_last_user_change
        FOREIGN KEY (id_last_user_change)
        REFERENCES "user"(id),

    CONSTRAINT chk_equipment_use_return
        CHECK (
            date_return IS NULL
            OR date_return >= date_start
        )
);

CREATE UNIQUE INDEX uq_equipment_use_active_equipment
ON equipment_use (id_equipment)
WHERE date_return IS NULL;

CREATE OR REPLACE FUNCTION update_equipment_use_last_change_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.date_last_change = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_equipment_use_last_change
BEFORE UPDATE ON equipment_use
FOR EACH ROW
EXECUTE FUNCTION update_equipment_use_last_change_date();