-- =============================================================
-- CFC (Culling Foto Creative) - Database Initialization Script
-- PostgreSQL 16+ — Schema Lengkap (sudah include semua migration)
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- ENUM TYPES
-- =============================================================
DO $$ BEGIN
    CREATE TYPE status_sesi_enum AS ENUM ('aktif', 'selesai');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE status_seleksi_enum AS ENUM ('belum_ditinjau', 'siap_edit', 'ditolak', 'revisi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE mode_seleksi_enum AS ENUM ('pilih_sendiri', 'oleh_fotografer', 'lihat_saja');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE fase_sesi_enum AS ENUM ('pra_edit', 'pasca_edit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================
-- TABLE: users
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =============================================================
-- TABLE: sesi
-- =============================================================
CREATE TABLE IF NOT EXISTS sesi (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nama_sesi            VARCHAR(255) NOT NULL,
    nama_klien           VARCHAR(255) NOT NULL,
    nama_bucket          VARCHAR(63)  NOT NULL,
    token_akses          VARCHAR(64)  NOT NULL UNIQUE,
    status_sesi          status_sesi_enum NOT NULL DEFAULT 'aktif',
    mode_seleksi         mode_seleksi_enum DEFAULT NULL,
    fase_sesi            fase_sesi_enum NOT NULL DEFAULT 'pra_edit',
    welcome_popup_shown  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sesi_user_id        ON sesi(user_id);
CREATE INDEX IF NOT EXISTS idx_sesi_token_akses    ON sesi(token_akses);
CREATE INDEX IF NOT EXISTS idx_sesi_mode_seleksi   ON sesi(mode_seleksi);
CREATE INDEX IF NOT EXISTS idx_sesi_fase           ON sesi(fase_sesi);

-- =============================================================
-- TABLE: foto
-- =============================================================
CREATE TABLE IF NOT EXISTS foto (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesi_id           UUID NOT NULL REFERENCES sesi(id) ON DELETE CASCADE,
    nama_file         VARCHAR(500) NOT NULL,
    object_key        VARCHAR(1000) NOT NULL,
    ukuran_file       BIGINT NOT NULL,
    tipe_file         VARCHAR(100) NOT NULL,
    status_seleksi    status_seleksi_enum NOT NULL DEFAULT 'belum_ditinjau',
    catatan_klien     TEXT,
    -- AI Quality columns
    quality_analyzed  BOOLEAN  DEFAULT FALSE,
    is_blurry         BOOLEAN  DEFAULT NULL,
    blur_score        FLOAT    DEFAULT NULL,
    face_detected     BOOLEAN  DEFAULT NULL,
    eyes_closed       BOOLEAN  DEFAULT NULL,
    ear_score         FLOAT    DEFAULT NULL,
    is_duplicate      BOOLEAN  DEFAULT NULL,
    duplicate_of      UUID     DEFAULT NULL REFERENCES foto(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_foto_sesi_id        ON foto(sesi_id);
CREATE INDEX IF NOT EXISTS idx_foto_status_seleksi ON foto(status_seleksi);
CREATE INDEX IF NOT EXISTS idx_foto_object_key     ON foto(object_key);
CREATE INDEX IF NOT EXISTS idx_foto_is_blurry      ON foto(is_blurry)    WHERE is_blurry = TRUE;
CREATE INDEX IF NOT EXISTS idx_foto_eyes_closed    ON foto(eyes_closed)  WHERE eyes_closed = TRUE;
CREATE INDEX IF NOT EXISTS idx_foto_is_duplicate   ON foto(is_duplicate) WHERE is_duplicate = TRUE;
CREATE INDEX IF NOT EXISTS idx_foto_quality_done   ON foto(quality_analyzed);

-- =============================================================
-- TABLE: foto_hash
-- =============================================================
CREATE TABLE IF NOT EXISTS foto_hash (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    foto_id      UUID NOT NULL UNIQUE REFERENCES foto(id) ON DELETE CASCADE,
    sesi_id      UUID NOT NULL REFERENCES sesi(id) ON DELETE CASCADE,
    phash_value  VARCHAR(64) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_foto_hash_sesi_id ON foto_hash(sesi_id);
CREATE INDEX IF NOT EXISTS idx_foto_hash_foto_id ON foto_hash(foto_id);

-- =============================================================
-- TABLE: foto_hasil_edit
-- =============================================================
CREATE TABLE IF NOT EXISTS foto_hasil_edit (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesi_id       UUID NOT NULL REFERENCES sesi(id) ON DELETE CASCADE,
    foto_asli_id  UUID REFERENCES foto(id) ON DELETE SET NULL,
    nama_file     VARCHAR(500) NOT NULL,
    object_key    VARCHAR(1000) NOT NULL,
    ukuran_file   BIGINT NOT NULL,
    tipe_file     VARCHAR(100) NOT NULL,
    catatan_hasil TEXT,
    status_hasil  VARCHAR(20) NOT NULL DEFAULT 'menunggu'
                  CHECK (status_hasil IN ('menunggu', 'disetujui', 'perlu_revisi')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hasil_edit_sesi_id   ON foto_hasil_edit(sesi_id);
CREATE INDEX IF NOT EXISTS idx_hasil_edit_foto_asli ON foto_hasil_edit(foto_asli_id);

-- =============================================================
-- TRIGGER: auto-update updated_at
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
        BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER set_updated_at_sesi
        BEFORE UPDATE ON sesi FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER set_updated_at_foto
        BEFORE UPDATE ON foto FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TRIGGER set_updated_at_foto_hasil_edit
        BEFORE UPDATE ON foto_hasil_edit FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================
-- SEED: Demo user (password: "password123", bcrypt cost 12)
-- =============================================================
INSERT INTO users (nama, email, password)
VALUES (
    'Demo Fotografer',
    'fotografer@demo.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMqJqhcanFp8.ot0tyI5mvtWci'
)
ON CONFLICT (email) DO NOTHING;
