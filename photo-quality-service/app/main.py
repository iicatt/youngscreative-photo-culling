"""
Photo Quality Service — FastAPI
================================
Optimasi performa vs versi sebelumnya:
  1. Gambar di-download SEKALI dari MinIO, lalu di-resize ke 640px.
  2. Tiga analyzer dijalankan PARALEL via ThreadPoolExecutor.
  3. MediaPipe FaceMesh diinisialisasi sekali (singleton di modul).
  4. Timeout per-analyzer 30 detik agar tidak bloking selamanya.

Estimasi waktu analisis:
  - Sebelumnya : ~5-15 detik per foto (full-res, sequential)
  - Sesudahnya : ~1-3 detik per foto (640px, parallel)
"""
import logging
import concurrent.futures
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from app.core.config       import settings
from app.core.minio_client import download_image_bytes
from app.core.database     import get_db_connection
from app.analyzers.image_utils      import load_and_resize
from app.analyzers.blur_detector    import detect_blur
from app.analyzers.eyes_detector    import detect_eyes
from app.analyzers.duplicate_detector import detect_duplicate

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("photo-quality")

# Pool thread bersama untuk semua analisis — hindari overhead buat thread baru
# setiap kali ada foto baru
_thread_pool = concurrent.futures.ThreadPoolExecutor(
    max_workers=4,
    thread_name_prefix="analyzer",
)

ANALYZER_TIMEOUT = 30  # detik maksimum per-analyzer


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Photo Quality Service dimulai.")
    logger.info(f"  Blur threshold    : {settings.BLUR_THRESHOLD}")
    logger.info(f"  EAR threshold     : {settings.EAR_THRESHOLD}")
    logger.info(f"  Hamming threshold : {settings.HAMMING_THRESHOLD}")
    logger.info(f"  Analyzer timeout  : {ANALYZER_TIMEOUT}s")
    yield
    _thread_pool.shutdown(wait=False)
    logger.info("Photo Quality Service dihentikan.")


app = FastAPI(
    title="CFC (Culling Foto Creative) — Photo Quality Service",
    version="2.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── Request model ─────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    foto_id:    str = Field(..., description="UUID foto di tabel foto")
    sesi_id:    str = Field(..., description="UUID sesi")
    object_key: str = Field(..., description="Object key di MinIO")
    bucket:     str = Field(..., description="Nama bucket MinIO")


# ── Core: pipeline analisis ───────────────────────────────────

def run_analysis(payload: AnalyzeRequest) -> None:
    """
    Pipeline analisis lengkap — dijalankan di background thread.

    Alur baru (optimasi):
    ┌─────────────────────────────────┐
    │ 1. Download dari MinIO          │  (sekali saja)
    │ 2. Resize ke 640px              │  (image_utils)
    │ 3. Jalankan 3 analyzer PARALEL  │  (ThreadPoolExecutor)
    │    ├── detect_blur(bgr_small)   │
    │    ├── detect_eyes(rgb_small)   │
    │    └── detect_duplicate(bytes)  │
    │ 4. Kumpulkan hasil              │
    │ 5. UPDATE tabel foto di DB      │
    └─────────────────────────────────┘
    """
    import time
    t_start = time.perf_counter()

    foto_id    = payload.foto_id
    sesi_id    = payload.sesi_id
    object_key = payload.object_key
    bucket     = payload.bucket

    logger.info(f"[Analisis] Mulai — foto_id={foto_id[:8]}…, key={object_key}")

    # ── Step 1: Download dari MinIO ───────────────────────────
    try:
        raw_bytes = download_image_bytes(bucket, object_key)
        logger.info(f"[Analisis] Download selesai — {len(raw_bytes)/1024:.0f} KB")
    except Exception as e:
        logger.error(f"[Analisis] GAGAL download: {e}")
        _tandai_error(foto_id)
        return

    # ── Step 2: Decode + resize sekali untuk semua analyzer ───
    try:
        bgr_small, rgb_small, bytes_small = load_and_resize(raw_bytes)
        logger.info(
            f"[Analisis] Resize selesai — "
            f"{bgr_small.shape[1]}×{bgr_small.shape[0]}px"
        )
    except Exception as e:
        logger.error(f"[Analisis] GAGAL resize: {e}")
        _tandai_error(foto_id)
        return

    # ── Step 3: Jalankan 3 analyzer secara paralel ────────────
    blur_result = eyes_result = dup_result = None

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
        # Submit ketiga task sekaligus
        f_blur = ex.submit(detect_blur, bgr_small)
        f_eyes = ex.submit(detect_eyes, rgb_small)
        f_dup  = ex.submit(detect_duplicate, bytes_small, foto_id, sesi_id)

        # Kumpulkan hasil dengan timeout individual
        for future, name in [(f_blur, "blur"), (f_eyes, "eyes"), (f_dup, "dup")]:
            try:
                result = future.result(timeout=ANALYZER_TIMEOUT)
                if   name == "blur": blur_result = result
                elif name == "eyes": eyes_result = result
                else:                dup_result  = result
                logger.info(f"[{name}] Selesai — {result}")
            except concurrent.futures.TimeoutError:
                logger.warning(f"[{name}] Timeout setelah {ANALYZER_TIMEOUT}s, dilewati.")
            except Exception as e:
                logger.error(f"[{name}] Error: {e}")

    # ── Step 4: Simpan ke DB ──────────────────────────────────
    _simpan_hasil(foto_id, blur_result, eyes_result, dup_result)

    elapsed = time.perf_counter() - t_start
    logger.info(f"[Analisis] SELESAI — foto_id={foto_id[:8]}… dalam {elapsed:.2f}s")


def _simpan_hasil(foto_id, blur_result, eyes_result, dup_result) -> None:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE foto SET
                        is_blurry        = COALESCE(%s, is_blurry),
                        blur_score       = COALESCE(%s, blur_score),
                        face_detected    = COALESCE(%s, face_detected),
                        eyes_closed      = COALESCE(%s, eyes_closed),
                        ear_score        = COALESCE(%s, ear_score),
                        is_duplicate     = COALESCE(%s, is_duplicate),
                        duplicate_of     = COALESCE(%s::uuid, duplicate_of),
                        quality_analyzed = TRUE,
                        updated_at       = NOW()
                    WHERE id = %s
                    """,
                    (
                        blur_result.is_blurry    if blur_result else None,
                        blur_result.blur_score   if blur_result else None,
                        eyes_result.face_detected if eyes_result else None,
                        eyes_result.eyes_closed   if eyes_result else None,
                        eyes_result.ear_score     if eyes_result else None,
                        dup_result.is_duplicate   if dup_result else None,
                        dup_result.duplicate_of   if dup_result else None,
                        foto_id,
                    )
                )
        logger.info(f"[DB] Tersimpan — foto_id={foto_id[:8]}…")
    except Exception as e:
        logger.error(f"[DB] GAGAL simpan: {e}")


def _tandai_error(foto_id: str) -> None:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE foto SET quality_analyzed = FALSE WHERE id = %s",
                    (foto_id,)
                )
    except Exception:
        pass


# ── Endpoints ─────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "photo-quality-service",
        "version": "2.0.0",
        "thresholds": {
            "blur":    settings.BLUR_THRESHOLD,
            "ear":     settings.EAR_THRESHOLD,
            "hamming": settings.HAMMING_THRESHOLD,
        },
    }


@app.post("/analyze", status_code=202)
async def analyze_photo(payload: AnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Terima request → kembalikan 202 Accepted langsung →
    jalankan analisis di background (fire-and-forget).
    """
    if not payload.object_key or not payload.bucket:
        raise HTTPException(400, "object_key dan bucket wajib diisi.")

    background_tasks.add_task(run_analysis, payload)

    logger.info(f"[Queue] Dijadwalkan — foto_id={payload.foto_id[:8]}…")
    return {
        "status":   "queued",
        "foto_id":  payload.foto_id,
        "message":  "Analisis berjalan di background.",
    }
