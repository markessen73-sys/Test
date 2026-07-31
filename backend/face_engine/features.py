"""Sample photo colours / proportions that drive the cartoon render."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .landmarks import PhotoLandmarks
from .skin import SkinTone, sample_skin_tone


@dataclass(frozen=True)
class FaceFeatures:
    skin_bgr: tuple[int, int, int]
    hair_bgr: tuple[int, int, int]
    iris_bgr: tuple[int, int, int]
    lip_bgr: tuple[int, int, int]
    brow_bgr: tuple[int, int, int]
    eye_span: float
    face_aspect: float  # width / height of face box
    hair_darkness: float  # 0 light … 1 dark
    skin_warmth: float
    skin_hex: str = "#d2aa8c"
    skin_sample_count: int = 0
    skin_tone: SkinTone | None = None


def _clamp(v: float) -> int:
    return int(max(0, min(255, round(v))))


def _sample(bgr: np.ndarray, x: float, y: float, radius: int = 6) -> tuple[int, int, int]:
    h, w = bgr.shape[:2]
    x0 = max(0, int(x - radius))
    y0 = max(0, int(y - radius))
    x1 = min(w, int(x + radius) + 1)
    y1 = min(h, int(y + radius) + 1)
    patch = bgr[y0:y1, x0:x1]
    if patch.size == 0:
        return (180, 140, 110)
    # Drop near-white / near-black outliers.
    flat = patch.reshape(-1, 3).astype(np.float32)
    lum = flat.mean(axis=1)
    chroma = flat.max(axis=1) - flat.min(axis=1)
    keep = (lum > 25) & (lum < 245) & ~((lum > 210) & (chroma < 18))
    if keep.any():
        flat = flat[keep]
    mean = flat.mean(axis=0)
    return (_clamp(mean[0]), _clamp(mean[1]), _clamp(mean[2]))


def _quantize(c: tuple[int, int, int], levels: int = 6) -> tuple[int, int, int]:
    """Snap non-skin colours toward flat cartoon palette steps."""
    q = 255 / max(1, levels - 1)
    return tuple(_clamp(round(v / q) * q) for v in c)  # type: ignore[return-value]


def extract_features(bgr: np.ndarray, lm: PhotoLandmarks) -> FaceFeatures:
    face = lm.face
    mid_x = (lm.right_eye[0] + lm.left_eye[0]) / 2
    mid_y = (lm.right_eye[1] + lm.left_eye[1]) / 2
    eye_span = float(np.hypot(lm.left_eye[0] - lm.right_eye[0], lm.left_eye[1] - lm.right_eye[1])) or face.w * 0.35

    # Skin first — YCrCb median from cheeks/forehead; do NOT quantize (preserves real tone).
    tone = sample_skin_tone(bgr, lm)
    skin = tone.bgr

    hair = _quantize(_sample(bgr, mid_x, max(2, mid_y - eye_span * 1.35), radius=14))
    iris_r = _sample(bgr, lm.right_eye[0], lm.right_eye[1], radius=2)
    iris_l = _sample(bgr, lm.left_eye[0], lm.left_eye[1], radius=2)
    iris = _quantize(
        (
            (iris_r[0] + iris_l[0]) // 2,
            (iris_r[1] + iris_l[1]) // 2,
            (iris_r[2] + iris_l[2]) // 2,
        ),
        levels=5,
    )
    lip = _quantize(_sample(bgr, lm.mouth[0], lm.mouth[1], radius=4), levels=5)
    brow = _quantize(
        (
            hair[0] * 0.55 + skin[0] * 0.2,
            hair[1] * 0.55 + skin[1] * 0.2,
            hair[2] * 0.55 + skin[2] * 0.2,
        ),
        levels=5,
    )

    hair_lum = (0.114 * hair[0] + 0.587 * hair[1] + 0.299 * hair[2]) / 255.0

    return FaceFeatures(
        skin_bgr=skin,
        hair_bgr=hair,
        iris_bgr=iris,
        lip_bgr=lip,
        brow_bgr=brow,
        eye_span=eye_span,
        face_aspect=face.w / max(1, face.h),
        hair_darkness=float(1.0 - hair_lum),
        skin_warmth=float(tone.warmth),
        skin_hex=tone.hex,
        skin_sample_count=tone.sample_count,
        skin_tone=tone,
    )
