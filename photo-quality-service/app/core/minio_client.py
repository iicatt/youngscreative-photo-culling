"""
Singleton MinIO client — digunakan bersama oleh semua analyzer.
"""
import io
import os
import urllib.request
from minio import Minio
from app.core.config import settings


def get_minio_client() -> Minio:
    """Buat koneksi ke MinIO menggunakan kredensial dari environment."""
    return Minio(
        endpoint=f"{settings.MINIO_ENDPOINT}:{settings.MINIO_PORT}",
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_USE_SSL,
    )


def download_image_bytes(bucket: str, object_key: str) -> bytes:
    """
    Download via Image Proxy (thumbnail 800px) jika tersedia — jauh lebih cepat.
    Fallback ke MinIO langsung jika proxy tidak bisa diakses.

    Thumbnail 800px cukup untuk:
    - Deteksi blur (Laplacian variance tidak butuh full-res)
    - Deteksi mata tertutup (face detection akurat di 640px+)
    - Perceptual hash untuk duplikat (hash paling akurat di 256px)
    """
    proxy_base = os.environ.get("IMAGE_PROXY_URL", "").rstrip("/")

    if proxy_base:
        # Gunakan preset medium (800px) via image proxy internal
        proxy_url = f"{proxy_base}/proxy/{bucket}/{object_key}?preset=medium&wm=0&fmt=jpeg"
        try:
            req = urllib.request.Request(proxy_url, headers={"User-Agent": "quality-service/2.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                if len(data) > 1000:  # valid image
                    return data
        except Exception as e:
            import logging
            logging.getLogger("photo-quality").warning(
                f"[Proxy] Gagal download via proxy ({e}), fallback ke MinIO langsung"
            )

    # Fallback: download langsung dari MinIO
    client = get_minio_client()
    response = client.get_object(bucket, object_key)
    try:
        data = response.read()
    finally:
        response.close()
        response.release_conn()
    return data
