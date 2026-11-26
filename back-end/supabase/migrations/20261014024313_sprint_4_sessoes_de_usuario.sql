-- =========================================================
-- CONTROL EP
-- Migration: Sessões de Usuário
-- Sprint 4
-- =========================================================


-- TABELA USER_SESSION
-- Armazena as sessões de autenticação dos usuários,
-- incluindo token e data de expiração

CREATE TABLE user_session (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_user INTEGER NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_user_session_user_id
        FOREIGN KEY (id_user)
        REFERENCES "user"(id)
);