-- =============================================================
-- Migration: Tambah kolom mode_seleksi pada tabel sesi
-- Jalankan setelah migrate_quality.sql
-- =============================================================

-- Buat ENUM type untuk pilihan mode
DO $$ BEGIN
    CREATE TYPE mode_seleksi_enum AS ENUM (
        'pilih_sendiri',   -- Klien memilih foto sendiri
        'oleh_fotografer', -- Fotografer sudah memilihkan, klien hanya menyetujui
        'lihat_saja'       -- Klien hanya melihat hasil foto tanpa bisa memilih
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Tambah kolom ke tabel sesi
ALTER TABLE sesi
    ADD COLUMN IF NOT EXISTS mode_seleksi mode_seleksi_enum NOT NULL DEFAULT 'pilih_sendiri';

-- Index untuk query berdasarkan mode
CREATE INDEX IF NOT EXISTS idx_sesi_mode_seleksi ON sesi(mode_seleksi);

DO $$
BEGIN
    RAISE NOTICE 'Migration selesai. Kolom mode_seleksi ditambahkan ke tabel sesi.';
END $$;
