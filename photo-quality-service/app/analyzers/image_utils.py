"""
image_utils.py
==============
Utilitas bersama untuk semua analyzer.

Fungsi utama: resize gambar ke resolusi kerja yang lebih kecil
sebelum dianalisis, sehingga:
  - Blur detection: tidak perlu resolusi penuh
  - MediaPipe EAR : wajah tetap terdeteksi di 640px
  - pHash         : sudah melakukan resize internal ke 32px, jadi 640px cukup

Dengan resize ini, analisis 1 foto RAW 24MP (~10MB) turun dari
~4-8 detik menjadi ~0.5-1.5 detik.
"""
import io
import cv2
import numpy as np
from PIL import Image

# Lebar maksimum gambar yang dikirim ke analyzer.
# 640px sudah cukup untuk semua deteksi heuristik.
ANALYSIS_MAX_WIDTH = 640


def load_and_resize(image_bytes: bytes) -> tuple[np.ndarray, np.ndarray, bytes]:
    """
    Decode bytes gambar, resize ke ANALYSIS_MAX_WIDTH jika lebih besar.

    Returns:
        bgr_small   — numpy array BGR (untuk OpenCV blur detector)
        rgb_small   — numpy array RGB (untuk MediaPipe)
        bytes_small — bytes PIL/JPEG (untuk imagehash pHash)
    """
    # ── Decode via OpenCV (paling cepat) ──────────────────────
    nparr = np.frombuffer(image_bytes, np.uint8)
    bgr   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if bgr is None:
        raise ValueError("Gagal mendecode gambar. Format tidak didukung.")

    h, w = bgr.shape[:2]

    # Hanya resize jika lebar melebihi batas
    if w > ANALYSIS_MAX_WIDTH:
        scale     = ANALYSIS_MAX_WIDTH / w
        new_w     = ANALYSIS_MAX_WIDTH
        new_h     = int(h * scale)
        bgr_small = cv2.resize(bgr, (new_w, new_h), interpolation=cv2.INTER_AREA)
    else:
        bgr_small = bgr

    # Konversi ke RGB untuk MediaPipe
    rgb_small = cv2.cvtColor(bgr_small, cv2.COLOR_BGR2RGB)

    # Konversi ke bytes untuk imagehash (via PIL)
    pil_small  = Image.fromarray(rgb_small)
    buf        = io.BytesIO()
    pil_small.save(buf, format="JPEG", quality=85)
    bytes_small = buf.getvalue()

    return bgr_small, rgb_small, bytes_small
