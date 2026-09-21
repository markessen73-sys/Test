"""Accurate skin-tone sampling from a face photo."""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from .landmarks import PhotoLandmarks


@dataclass(frozen=True)
class SkinTone:
    """Sampled cartoon skin colour (BGR) plus debug metadata."""

    bgr: tuple[int, int, int]
    rgb: tuple[int, int, int]
    hex: str
    sample_count: int
    warmth: float  # R-B in RGB space, normalised roughly -1…1


def _clamp(v: float) -> int:
    return int(max(0, min(255, round(v))))


def _bgr_to_hex(bgr: tuple[int, int, int]) -> str:
    b, g, r = bgr
    return f"#{r:02x}{g:02x}{b:02x}"


def _is_skin_ycrcb(ycrcb: np.ndarray) -> np.ndarray:
    """
    Classic YCrCb skin mask (works across a wide range of ethnicities).
    ycrcb: HxWx3 uint8
    """
    y = ycrcb[:, :, 0].astype(np.int16)
    cr = ycrcb[:, :, 1].astype(np.int16)
    cb = ycrcb[:, :, 2].astype(np.int16)
    # Broad envelope that still rejects blue sky / green foliage / pure black-white.
    return (
        (y > 40)
        & (y < 240)
        & (cr >= 133)
        & (cr <= 173)
        & (cb >= 77)
        & (cb <= 127)
    )


def sample_skin_tone(bgr: np.ndarray, lm: PhotoLandmarks) -> SkinTone:
    """
    Sample skin from cheek / forehead / jaw patches inside the face box.

    Uses a YCrCb skin mask and the **median** of matching pixels so hair,
    eyes, lips, and background don't pull the average off.
    """
    face = lm.face
    h, w = bgr.shape[:2]

    # Inflate face box slightly, then keep the inner face (avoid hair rim).
    pad = int(face.w * 0.05)
    x0 = max(0, face.x + pad)
    y0 = max(0, face.y + int(face.h * 0.18))  # below hairline
    x1 = min(w, face.x + face.w - pad)
    y1 = min(h, face.y + int(face.h * 0.78))  # above chin/neck clothes
    if x1 <= x0 + 4 or y1 <= y0 + 4:
        x0, y0 = max(0, face.x), max(0, face.y)
        x1, y1 = min(w, face.x + face.w), min(h, face.y + face.h)

    roi = bgr[y0:y1, x0:x1]
    if roi.size == 0:
        return SkinTone(
            bgr=(140, 170, 210),
            rgb=(210, 170, 140),
            hex="#d2aa8c",
            sample_count=0,
            warmth=0.25,
        )

    ycrcb = cv2.cvtColor(roi, cv2.COLOR_BGR2YCrCb)
    mask = _is_skin_ycrcb(ycrcb)

    # Prefer cheek bands: middle third of ROI height, left/right thirds.
    rh, rw = roi.shape[:2]
    prefer = np.zeros((rh, rw), dtype=bool)
    band_y0, band_y1 = int(rh * 0.28), int(rh * 0.72)
    prefer[band_y0:band_y1, : int(rw * 0.38)] = True  # right cheek (viewer left / subject right)
    prefer[band_y0:band_y1, int(rw * 0.62) :] = True  # left cheek
    prefer[int(rh * 0.15) : int(rh * 0.35), int(rw * 0.30) : int(rw * 0.70)] = True  # mid forehead

    skin_mask = mask & prefer
    if skin_mask.sum() < 40:
        skin_mask = mask
    if skin_mask.sum() < 20:
        # Last resort: sample known cheek landmarks with a wide radius.
        pts = [
            ((lm.right_eye[0] + lm.mouth[0]) / 2, (lm.right_eye[1] + lm.mouth[1]) / 2),
            ((lm.left_eye[0] + lm.mouth[0]) / 2, (lm.left_eye[1] + lm.mouth[1]) / 2),
            (lm.nose[0], (lm.nose[1] + lm.mouth[1]) / 2),
        ]
        samples: list[np.ndarray] = []
        for px, py in pts:
            r = max(8, int(lm.face.w * 0.08))
            xa0, ya0 = max(0, int(px - r)), max(0, int(py - r))
            xa1, ya1 = min(w, int(px + r)), min(h, int(py + r))
            patch = bgr[ya0:ya1, xa0:xa1].reshape(-1, 3)
            if patch.size:
                samples.append(patch)
        pixels = np.concatenate(samples, axis=0) if samples else roi.reshape(-1, 3)
    else:
        pixels = roi[skin_mask]

    # Median is robust to highlight / shadow outliers.
    med = np.median(pixels.astype(np.float32), axis=0)
    bgr_c = (_clamp(med[0]), _clamp(med[1]), _clamp(med[2]))
    rgb_c = (bgr_c[2], bgr_c[1], bgr_c[0])
    warmth = (rgb_c[0] - rgb_c[2]) / 255.0

    return SkinTone(
        bgr=bgr_c,
        rgb=rgb_c,
        hex=_bgr_to_hex(bgr_c),
        sample_count=int(pixels.shape[0]),
        warmth=float(warmth),
    )
