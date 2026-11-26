CREATE TABLE change_request (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    id_attendance INTEGER,
    id_equipment_use INTEGER,

    requested_data JSONB NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'Pendente',

    id_user_request INTEGER NOT NULL,
    date_request TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    id_user_decision INTEGER,
    date_decision TIMESTAMPTZ,

    CONSTRAINT fk_change_request_attendance
        FOREIGN KEY (id_attendance)
        REFERENCES attendance(id),

    CONSTRAINT fk_change_request_equipment_use
        FOREIGN KEY (id_equipment_use)
        REFERENCES equipment_use(id),

    CONSTRAINT fk_change_request_user_request
        FOREIGN KEY (id_user_request)
        REFERENCES "user"(id),

    CONSTRAINT fk_change_request_user_decision
        FOREIGN KEY (id_user_decision)
        REFERENCES "user"(id),

    CONSTRAINT chk_change_request_target
        CHECK (
            (id_attendance IS NOT NULL AND id_equipment_use IS NULL)
            OR
            (id_attendance IS NULL AND id_equipment_use IS NOT NULL)
        ),

    CONSTRAINT chk_change_request_status
        CHECK (
            status IN ('Pendente', 'Aprovada', 'Rejeitada')
        ),

    CONSTRAINT chk_change_request_decision
        CHECK (
            (
                status = 'Pendente'
                AND id_user_decision IS NULL
                AND date_decision IS NULL
            )
            OR
            (
                status IN ('Aprovada', 'Rejeitada')
                AND id_user_decision IS NOT NULL
                AND date_decision IS NOT NULL
            )
        )
);