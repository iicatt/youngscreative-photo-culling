"""
Konfigurasi terpusat — semua nilai dibaca dari environment variable.
Nilai default aman untuk development lokal.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # ── MinIO ─────────────────────────────────────────────────
    MINIO_ENDPOINT: str  = os.getenv("MINIO_ENDPOINT", "localhost")
    MINIO_PORT: int      = int(os.getenv("MINIO_PORT", "9000"))
    MINIO_USE_SSL: bool  = os.getenv("MINIO_USE_SSL", "false").lower() == "true"
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin123")

    # ── Database PostgreSQL ────────────────────────────────────
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:irsandoni123@localhost:5432/cfc-foto"
    )

    # ── Threshold analisis kualitas ────────────────────────────
    # Nilai di bawah threshold = gambar dianggap buram
    BLUR_THRESHOLD: float    = float(os.getenv("BLUR_THRESHOLD", "100.0"))
    # EAR (Eye Aspect Ratio) di bawah threshold = mata dianggap tertutup
    EAR_THRESHOLD: float     = float(os.getenv("EAR_THRESHOLD", "0.21"))
    # Hamming distance di bawah/sama dengan threshold = dianggap duplikat
    HAMMING_THRESHOLD: int   = int(os.getenv("HAMMING_THRESHOLD", "5"))

    # ── Server ────────────────────────────────────────────────
    PORT: int = int(os.getenv("PORT", "6000"))


settings = Settings()
