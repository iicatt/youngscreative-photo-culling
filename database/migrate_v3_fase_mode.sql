-- =============================================================
-- Migration v3: Fase Pra/Pasca-Edit + Mode Klien + Hasil Edit
-- Jalankan setelah migrate_quality.sql dan migrate_mode_seleksi.sql
-- Aman untuk data lama — semua perubahan menggunakan IF NOT EXISTS
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. ENUM: fase_sesi
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE fase_sesi_enum AS ENUM ('pra_edit', 'pasca_edit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. Ubah mode_seleksi menjadi NULLABLE (klien yang memilih)
--    Sesi lama tetap dengan nilai yang ada (tidak di-reset)
--    Sesi baru akan NULL sampai klien memilih
-- ─────────────────────────────────────────────────────────────
-- Hapus DEFAULT dulu agar kolom bisa menerima NULL
ALTER TABLE sesi ALTER COLUMN mode_seleksi DROP DEFAULT;
ALTER TABLE sesi ALTER COLUMN mode_seleksi DROP NOT NULL;
-- Sesi lama yang mode_seleksi = 'pilih_sendiri' (nilai default lama) dibiarkan
-- karena mungkin fotografer memang sudah set. Hanya sesi baru yang NULL.

-- ─────────────────────────────────────────────────────────────
-- 3. Tambah kolom baru ke tabel sesi
-- ─────────────────────────────────────────────────────────────
ALTER TABLE sesi
    -- Fase sesi: pra_edit = sedang diseleksi, pasca_edit = hasil edit sudah ada
    ADD COLUMN IF NOT EXISTS fase_sesi fase_sesi_enum NOT NULL DEFAULT 'pra_edit',
    -- Flag: popup "terima kasih" sudah ditampilkan ke klien mode oleh_fotografer
    ADD COLUMN IF NOT EXISTS welcome_popup_shown BOOLEAN NOT NULL DEFAULT FALSE;

-- Sesi lama: fase default pra_edit (sudah di-handle oleh DEFAULT)

-- ─────────────────────────────────────────────────────────────
-- 4. Tabel foto_hasil_edit
--    Menyimpan metadata berkas hasil edit final yang diunggah fotografer
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS foto_hasil_edit (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sesi_id         UUID        NOT NULL REFERENCES sesi(id) ON DELETE CASCADE,
    -- Referensi ke foto asli (nullable: hasil edit bisa tanpa padanan)
    foto_asli_id    UUID        REFERENCES foto(id) ON DELETE SET NULL,
    nama_file       VARCHAR(500) NOT NULL,
    -- prefix: {sesi_id}/hasil-edit/{nama_file}
    object_key      VARCHAR(1000) NOT NULL,
    ukuran_file     BIGINT      NOT NULL,
    tipe_file       VARCHAR(100) NOT NULL,
    -- Tanggapan klien terhadap hasil edit (field terpisah dari catatan seleksi)
    catatan_hasil   TEXT,
    -- Status persetujuan klien terhadap hasil edit
    status_hasil    VARCHAR(20) NOT NULL DEFAULT 'menunggu'
                    CHECK (status_hasil IN ('menunggu', 'disetujui', 'perlu_revisi')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hasil_edit_sesi_id     ON foto_hasil_edit(sesi_id);
CREATE INDEX IF NOT EXISTS idx_hasil_edit_foto_asli   ON foto_hasil_edit(foto_asli_id);
CREATE INDEX IF NOT EXISTS idx_sesi_fase              ON sesi(fase_sesi);

-- Trigger updated_at untuk foto_hasil_edit
DO $$ BEGIN
    CREATE TRIGGER set_updated_at_foto_hasil_edit
        BEFORE UPDATE ON foto_hasil_edit
        FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────
-- 5. Tambah nilai enum baru ke mode_seleksi_enum
--    PostgreSQL tidak bisa hapus nilai enum, tapi bisa tambah
--    Nilai 'belum_ditentukan' tidak perlu — NULL sudah cukup
-- ─────────────────────────────────────────────────────────────
-- (tidak perlu ALTER TYPE karena NULL sudah merepresentasikan "belum ditentukan")

DO $$
BEGIN
    RAISE NOTICE 'Migration v3 selesai:';
    RAISE NOTICE '  - mode_seleksi sekarang nullable (klien yang memilih)';
    RAISE NOTICE '  - kolom fase_sesi ditambahkan (pra_edit default)';
    RAISE NOTICE '  - kolom welcome_popup_shown ditambahkan';
    RAISE NOTICE '  - tabel foto_hasil_edit dibuat';
END $$;
