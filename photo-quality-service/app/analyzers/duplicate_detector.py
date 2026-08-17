"""
Modul Deteksi Duplikat — imagehash pHash + Hamming Distance
============================================================
Optimasi:
 - Menerima bytes gambar yang sudah di-resize (640px) dari image_utils
   sehingga imagehash tidak perlu membaca gambar full-resolution.
 - pHash internal hanya butuh 32x32 — resize 640px sudah lebih dari cukup.
"""
import io
import imagehash
from PIL import Image
from dataclasses import dataclass
from typing import Optional
from app.core.config import settings
from app.core.database import get_db_connection


@dataclass
class DuplicateResult:
    is_duplicate:     bool
    duplicate_of:     Optional[str]
    hamming_distance: Optional[int]
    phash_value:      str


def detect_duplicate(
    small_bytes: bytes,   # bytes gambar YANG SUDAH DI-RESIZE
    foto_id: str,
    sesi_id: str,
) -> DuplicateResult:
    """
    Deteksi duplikat menggunakan pHash perceptual hash.

    Args:
        small_bytes: bytes gambar ukuran kecil (hasil image_utils)
        foto_id:     UUID foto baru
        sesi_id:     UUID sesi

    Returns:
        DuplicateResult
    """
    # Hitung hash dari gambar kecil (sangat cepat)
    pil_img      = Image.open(io.BytesIO(small_bytes)).convert("RGB")
    new_hash     = imagehash.phash(pil_img)
    new_hash_str = str(new_hash)

    result = DuplicateResult(
        is_duplicate=False, duplicate_of=None,
        hamming_distance=None, phash_value=new_hash_str,
    )

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Ambil semua hash sesi yang sama (kecuali foto ini)
            cur.execute(
                "SELECT foto_id, phash_value FROM foto_hash "
                "WHERE sesi_id = %s AND foto_id != %s",
                (sesi_id, foto_id)
            )
            rows = cur.fetchall()

            min_dist        = float("inf")
            closest_foto_id = None

            for row in rows:
                dist = new_hash - imagehash.hex_to_hash(row["phash_value"])
                if dist < min_dist:
                    min_dist        = dist
                    closest_foto_id = str(row["foto_id"])

            # Simpan hash foto baru
            cur.execute(
                "INSERT INTO foto_hash (foto_id, sesi_id, phash_value) "
                "VALUES (%s, %s, %s) "
                "ON CONFLICT (foto_id) DO UPDATE SET phash_value = EXCLUDED.phash_value",
                (foto_id, sesi_id, new_hash_str)
            )

            if rows and min_dist <= settings.HAMMING_THRESHOLD:
                result.is_duplicate    = True
                result.duplicate_of    = closest_foto_id
                result.hamming_distance = int(min_dist)
            elif rows:
                result.hamming_distance = int(min_dist)

    return result
