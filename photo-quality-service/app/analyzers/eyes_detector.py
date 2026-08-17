"""
Modul Deteksi Mata Tertutup — MediaPipe FaceLandmarker + EAR
=============================================================
MediaPipe 0.10+ menggunakan Tasks API, bukan mp.solutions.
Menggunakan FaceLandmarker dengan model face_landmarker.task.

Optimasi:
 - Singleton detector diinisialisasi sekali saat modul di-import
 - Model di-download otomatis dari MediaPipe ke direktori cache
 - max_num_faces=4, tidak pakai refine_landmarks (lebih cepat)

Fallback: jika model tidak tersedia, skip deteksi mata (return face_detected=False).

Rumus EAR: (||p2-p6|| + ||p3-p5||) / (2 × ||p1-p4||)
"""
import math
import os
import urllib.request
import numpy as np
from dataclasses import dataclass
from typing import List
from app.core.config import settings

# ── Index landmark mata FaceMesh 468 titik ─────────────────────
LEFT_EYE  = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33,  160, 158, 133, 153, 144]

# ── Coba inisialisasi MediaPipe Tasks API ──────────────────────
_detector = None
_mp_available = False

def _init_detector():
    """
    Inisialisasi FaceLandmarker sekali saat pertama dipanggil.
    Mendukung MediaPipe 0.10+ (Tasks API) dan fallback OpenCV.
    """
    global _detector, _mp_available

    # ── Coba MediaPipe Tasks API (0.10+) ──────────────────────
    try:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision as mp_vision
        model_dir  = os.path.join(os.path.dirname(__file__), '..', '..', 'models')
        model_path = os.path.join(model_dir, 'face_landmarker.task')

        if not os.path.exists(model_path):
            os.makedirs(model_dir, exist_ok=True)
            url = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
            print(f"[EyesDetector] Downloading face_landmarker model...")
            urllib.request.urlretrieve(url, model_path)
            print(f"[EyesDetector] Model tersimpan: {model_path}")

        base_opts = mp_python.BaseOptions(model_asset_path=model_path)
        opts = mp_vision.FaceLandmarkerOptions(
            base_options=base_opts,
            running_mode=mp_vision.RunningMode.IMAGE,
            num_faces=4,
            min_face_detection_confidence=0.45,
        )
        _detector = mp_vision.FaceLandmarker.create_from_options(opts)
        _mp_available = True
        print("[EyesDetector] MediaPipe Tasks API siap.")

    except Exception as e:
        # Fallback: gunakan OpenCV Haar Cascade (tidak bisa hitung EAR tapi tidak crash)
        print(f"[EyesDetector] MediaPipe Tasks API gagal ({e}), menggunakan OpenCV fallback.")
        _mp_available = False


@dataclass
class EyesResult:
    face_detected: bool
    eyes_closed:   bool
    ear_score:     float
    faces_count:   int = 0


def _dist(p1, p2) -> float:
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)


def _ear_from_landmarks(landmarks, indices: List[int], w: int, h: int) -> float:
    """Hitung EAR dari landmark MediaPipe (koordinat 0-1)."""
    pts = [(landmarks[i].x * w, landmarks[i].y * h) for i in indices]
    v   = _dist(pts[1], pts[5]) + _dist(pts[2], pts[4])
    hz  = 2.0 * _dist(pts[0], pts[3])
    return v / hz if hz > 0 else 0.0


def detect_eyes(rgb_array: np.ndarray) -> EyesResult:
    """
    Deteksi mata tertutup dari array RGB yang sudah di-resize.
    Menggunakan MediaPipe Tasks API jika tersedia.
    """
    global _detector, _mp_available

    # Lazy init
    if _detector is None and _mp_available is False:
        _init_detector()

    if not _mp_available or _detector is None:
        # Fallback OpenCV — deteksi wajah saja tanpa EAR
        return _detect_eyes_opencv(rgb_array)

    try:
        h, w = rgb_array.shape[:2]

        # MediaPipe 0.10+ Image — gunakan numpy array langsung
        import mediapipe as mp
        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=np.ascontiguousarray(rgb_array.astype(np.uint8)),
        )

        result = _detector.detect(mp_image)

        if not result.face_landmarks:
            return EyesResult(face_detected=False, eyes_closed=False, ear_score=0.0)

        min_ear    = float("inf")
        any_closed = False

        for face in result.face_landmarks:
            ear_l   = _ear_from_landmarks(face, LEFT_EYE,  w, h)
            ear_r   = _ear_from_landmarks(face, RIGHT_EYE, w, h)
            ear_avg = (ear_l + ear_r) / 2.0
            if ear_avg < min_ear:
                min_ear = ear_avg
            if ear_avg < settings.EAR_THRESHOLD:
                any_closed = True

        return EyesResult(
            face_detected=True,
            eyes_closed=any_closed,
            ear_score=round(min_ear, 4),
            faces_count=len(result.face_landmarks),
        )

    except Exception as e:
        print(f"[EyesDetector] Error saat deteksi: {e}")
        return EyesResult(face_detected=False, eyes_closed=False, ear_score=0.0)


def _detect_eyes_opencv(rgb_array: np.ndarray) -> EyesResult:
    """
    Fallback deteksi wajah menggunakan OpenCV Haar Cascade.
    Tidak menghitung EAR — hanya mendeteksi ada/tidaknya wajah.
    """
    import cv2
    bgr = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    cascade = cv2.CascadeClassifier(cascade_path)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    face_detected = len(faces) > 0
    return EyesResult(
        face_detected=face_detected,
        eyes_closed=False,    # Tidak bisa hitung EAR tanpa landmark
        ear_score=0.0,
        faces_count=len(faces),
    )
