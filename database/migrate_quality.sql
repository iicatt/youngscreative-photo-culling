-- =============================================================
-- Migration: Tambah kolom analisis kualitas foto
-- Jalankan SETELAH init.sql sudah dieksekusi
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Tambah kolom hasil analisis ke tabel foto
--    Semua kolom nullable karena analisis berjalan async —
--    saat foto baru diinsert, kolom ini masih NULL sampai
--    photo-quality-service selesai memproses.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE foto
    -- Penanda apakah analisis sudah pernah dijalankan
    ADD COLUMN IF NOT EXISTS quality_analyzed  BOOLEAN     DEFAULT FALSE,

    -- Hasil deteksi blur (cv2.Laplacian variance)
    ADD COLUMN IF NOT EXISTS is_blurry         BOOLEAN     DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS blur_score        FLOAT       DEFAULT NULL,

    -- Hasil deteksi mata tertutup (MediaPipe Face Mesh + EAR)
    ADD COLUMN IF NOT EXISTS face_detected     BOOLEAN     DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS eyes_closed       BOOLEAN     DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ear_score         FLOAT       DEFAULT NULL,

    -- Hasil deteksi duplikat (imagehash pHash + Hamming distance)
    ADD COLUMN IF NOT EXISTS is_duplicate      BOOLEAN     DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS duplicate_of      UUID        DEFAULT NULL
        REFERENCES foto(id) ON DELETE SET NULL;

-- Index untuk query badge di galeri (filter foto bermasalah)
CREATE INDEX IF NOT EXISTS idx_foto_is_blurry    ON foto(is_blurry)    WHERE is_blurry = TRUE;
CREATE INDEX IF NOT EXISTS idx_foto_eyes_closed  ON foto(eyes_closed)  WHERE eyes_closed = TRUE;
CREATE INDEX IF NOT EXISTS idx_foto_is_duplicate ON foto(is_duplicate) WHERE is_duplicate = TRUE;
CREATE INDEX IF NOT EXISTS idx_foto_quality_done ON foto(quality_analyzed);

-- ─────────────────────────────────────────────────────────────
-- 2. Tabel baru: foto_hash
--    Menyimpan pHash setiap foto per sesi untuk perbandingan
--    Hamming distance saat foto baru diunggah.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS foto_hash (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    foto_id     UUID        NOT NULL UNIQUE REFERENCES foto(id) ON DELETE CASCADE,
    sesi_id     UUID        NOT NULL REFERENCES sesi(id) ON DELETE CASCADE,
    phash_value VARCHAR(64) NOT NULL,   -- hex string pHash 64-bit
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foto_hash_sesi_id ON foto_hash(sesi_id);
CREATE INDEX IF NOT EXISTS idx_foto_hash_foto_id ON foto_hash(foto_id);

-- ─────────────────────────────────────────────────────────────
-- Verifikasi: tampilkan kolom tabel foto yang baru
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
    RAISE NOTICE 'Migration selesai. Kolom baru di tabel foto:';
    RAISE NOTICE '  quality_analyzed, is_blurry, blur_score,';
    RAISE NOTICE '  face_detected, eyes_closed, ear_score,';
    RAISE NOTICE '  is_duplicate, duplicate_of';
    RAISE NOTICE 'Tabel baru: foto_hash';
END $$;
