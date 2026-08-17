-- =============================================================
-- CFC (Culling Foto Creative) - Database Initialization Script
-- PostgreSQL 16+
-- =============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- ENUM TYPES
-- =============================================================
DO $$ BEGIN
    CREATE TYPE status_sesi_enum AS ENUM ('aktif', 'selesai');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE status_seleksi_enum AS ENUM ('belum_ditinjau', 'siap_edit', 'ditolak', 'revisi');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================
-- TABLE: users
-- Menyimpan data akun fotografer
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,   -- bcrypt hash
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index untuk lookup email cepat (login)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================================
-- TABLE: sesi
-- Satu sesi = satu proyek foto untuk satu klien
-- =============================================================
CREATE TABLE IF NOT EXISTS sesi (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nama_sesi       VARCHAR(255) NOT NULL,
    nama_klien      VARCHAR(255) NOT NULL,
    nama_bucket     VARCHAR(63)  NOT NULL,   -- MinIO bucket name (DNS-safe)
    token_akses     VARCHAR(64)  NOT NULL UNIQUE,
    status_sesi     status_sesi_enum NOT NULL DEFAULT 'aktif',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sesi_user_id     ON sesi(user_id);
CREATE INDEX IF NOT EXISTS idx_sesi_token_akses ON sesi(token_akses);

-- =============================================================
-- TABLE: foto
-- Metadata setiap foto yang diunggah ke MinIO
-- =============================================================
CREATE TABLE IF NOT EXISTS foto (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesi_id         UUID NOT NULL REFERENCES sesi(id) ON DELETE CASCADE,
    nama_file       VARCHAR(500) NOT NULL,
    object_key      VARCHAR(1000) NOT NULL,  -- path di dalam MinIO bucket
    ukuran_file     BIGINT NOT NULL,         -- bytes
    tipe_file       VARCHAR(100) NOT NULL,   -- MIME type, e.g. image/jpeg
    status_seleksi  status_seleksi_enum NOT NULL DEFAULT 'belum_ditinjau',
    catatan_klien   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foto_sesi_id        ON foto(sesi_id);
CREATE INDEX IF NOT EXISTS idx_foto_status_seleksi ON foto(status_seleksi);
CREATE INDEX IF NOT EXISTS idx_foto_object_key     ON foto(object_key);

-- =============================================================
-- TRIGGER: auto-update updated_at pada setiap UPDATE
-- =============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    CREATE TRIGGER set_updated_at_users
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER set_updated_at_sesi
        BEFORE UPDATE ON sesi
        FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER set_updated_at_foto
        BEFORE UPDATE ON foto
        FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================
-- SEED: Demo user (password: "password123")
-- Hash dihasilkan dengan bcrypt cost 12
-- =============================================================
INSERT INTO users (nama, email, password)
VALUES (
    'Demo Fotografer',
    'fotografer@demo.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMqJqhcanFp8.ot0tyI5mvtWci'
)
ON CONFLICT (email) DO NOTHING;
