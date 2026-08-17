"""
Modul Deteksi Blur — Variance of Laplacian (OpenCV)
====================================================
Menerima array BGR hasil resize dari image_utils,
bukan raw bytes — sehingga decode & resize tidak diulang.
"""
import cv2
import numpy as np
from dataclasses import dataclass
from app.core.config import settings


@dataclass
class BlurResult:
    is_blurry:  bool    # True jika gambar dianggap buram
    blur_score: float   # Variance Laplacian (makin tinggi = makin tajam)


def detect_blur(bgr_array: np.ndarray) -> BlurResult:
    """
    Analisis blur dari array BGR (hasil cv2.imdecode / resize).

    Menggunakan array yang sudah di-resize (640px) — jauh lebih cepat
    dibanding memproses gambar full-resolution.

    Args:
        bgr_array: numpy array BGR dari OpenCV

    Returns:
        BlurResult
    """
    if bgr_array is None or bgr_array.size == 0:
        return BlurResult(is_blurry=False, blur_score=-1.0)

    # Grayscale untuk Laplacian (1 channel lebih cepat)
    gray          = cv2.cvtColor(bgr_array, cv2.COLOR_BGR2GRAY)
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    return BlurResult(
        is_blurry  = laplacian_var < settings.BLUR_THRESHOLD,
        blur_score = round(laplacian_var, 4),
    )
