"""
Singleton MinIO client — digunakan bersama oleh semua analyzer.
"""
import io
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
    Unduh objek dari MinIO dan kembalikan sebagai bytes.
    Digunakan oleh semua analyzer agar tidak perlu mengunduh berkali-kali.
    """
    client = get_minio_client()
    response = client.get_object(bucket, object_key)
    try:
        data = response.read()
    finally:
        response.close()
        response.release_conn()
    return data
