"""
Koneksi PostgreSQL menggunakan psycopg2.
Context manager untuk memastikan koneksi selalu ditutup dengan benar.
"""
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from app.core.config import settings


@contextmanager
def get_db_connection():
    """
    Context manager koneksi DB.
    Penggunaan:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(...)
    """
    conn = psycopg2.connect(
        settings.DATABASE_URL,
        cursor_factory=psycopg2.extras.RealDictCursor
    )
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
