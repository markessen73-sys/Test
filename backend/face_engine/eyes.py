"""Iris colour sampling + glasses detection from a face photo."""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from .landmarks import PhotoLandmarks
from .skin import _is_skin_ycrcb


@dataclass(frozen=True)
class EyeFeatures:
    """Sampled iris + optional glasses for the cartoon render."""

    iris_bgr: tuple[int, int, int]
    iris_hex: str
    iris_sample_count: int
    eye_scale: float  # 1.0 = default cartoon size; higher = larger openings
    has_glasses: bool
    glasses_bgr: tuple[int, int, int]
    glasses_hex: str
    glasses_sample_count: int


def _clamp(v: float) -> int:
    return int(max(0, min(255, round(v))))


def _bgr_to_hex(bgr: tuple[int, int, int]) -> str:
    b, g, r = bgr
    return f"#{r:02x}{g:02x}{b:02x}"


def _median_bgr(pixels: np.ndarray) -> tuple[int, int, int]:
    if pixels.size == 0:
        return (70, 90, 110)
    med = np.median(pixels.astype(np.float32), axis=0)
    return (_clamp(med[0]), _clamp(med[1]), _clamp(med[2]))


def _refine_eye_center(
    bgr: np.ndarray,
    cx: float,
    cy: float,
    eye_span: float,
) -> tuple[float, float]:
    """
    Nudge the heuristic eye landmark toward the pupil (darkest local blob).

    Haar-box landmarks are approximate; iris sampling needs the real centre.
    """
    h, w = bgr.shape[:2]
    r = max(8, int(eye_span * 0.16))
    x0, y0 = max(0, int(cx - r)), max(0, int(cy - r))
    x1, y1 = min(w, int(cx + r) + 1), min(h, int(cy + r) + 1)
    roi = bgr[y0:y1, x0:x1]
    if roi.size == 0:
        return cx, cy
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    # Soft blur then pick darkest pixel that isn't pure black background noise.
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    # Prefer interior of the search window.
    pad = max(2, r // 5)
    inner = blur.copy()
    inner[:pad, :] = 255
    inner[-pad:, :] = 255
    inner[:, :pad] = 255
    inner[:, -pad:] = 255
    min_val, _, min_loc, _ = cv2.minMaxLoc(inner)
    if min_val > 140:
        return cx, cy
    return float(x0 + min_loc[0]), float(y0 + min_loc[1])


def _sample_iris_at(
    bgr: np.ndarray,
    cx: float,
    cy: float,
    eye_span: float,
) -> tuple[tuple[int, int, int], int]:
    """
    Sample iris from an annulus around the (refined) eye centre.

    Drops sclera (bright), pupil (very dark), and skin-toned pixels so
    glasses reflections / lids don't wash the colour.
    """
    cx, cy = _refine_eye_center(bgr, cx, cy, eye_span)
    h, w = bgr.shape[:2]
    r_out = max(4, int(eye_span * 0.085))
    r_in = max(1, int(r_out * 0.32))
    x0, y0 = max(0, int(cx - r_out)), max(0, int(cy - r_out))
    x1, y1 = min(w, int(cx + r_out) + 1), min(h, int(cy + r_out) + 1)
    roi = bgr[y0:y1, x0:x1]
    if roi.size == 0:
        return (70, 90, 110), 0

    yy, xx = np.mgrid[y0:y1, x0:x1]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    ring = (dist >= r_in) & (dist <= r_out)

    ycrcb = cv2.cvtColor(roi, cv2.COLOR_BGR2YCrCb)
    skin = _is_skin_ycrcb(ycrcb)
    flat = roi.reshape(-1, 3).astype(np.float32)
    lum = flat.mean(axis=1)
    chroma = flat.max(axis=1) - flat.min(axis=1)
    ring_flat = ring.reshape(-1)
    skin_flat = skin.reshape(-1)

    # Prefer mid-tone chromatic pixels (iris), not sclera / pupil / skin.
    keep = (
        ring_flat
        & ~skin_flat
        & (lum > 28)
        & (lum < 200)
        & (chroma > 12)
    )
    if keep.sum() < 8:
        keep = (
            ring_flat
            & ~skin_flat
            & (lum > 20)
            & (lum < 220)
            & ~((lum > 190) & (chroma < 18))
        )
    if keep.sum() < 4:
        keep = ring_flat & (lum > 25) & (lum < 180) & (chroma > 8)
    pixels = flat[keep]
    if len(pixels) < 4:
        return (70, 90, 110), 0
    return _median_bgr(pixels), int(len(pixels))


def _glasses_ring_mask(
    shape: tuple[int, int],
    cx: float,
    cy: float,
    eye_span: float,
) -> np.ndarray:
    """Annulus outside the iris where spectacle frames usually sit."""
    h, w = shape
    r_in = max(5, int(eye_span * 0.11))
    r_out = max(r_in + 3, int(eye_span * 0.22))
    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    return (dist >= r_in) & (dist <= r_out)


def detect_eyes_and_glasses(bgr: np.ndarray, lm: PhotoLandmarks) -> EyeFeatures:
    """
    Sample iris colour, estimate eye opening scale, and detect glasses frames.

    Glasses heuristic: dark non-skin pixels on rings around both eyes, plus a
    bridge band between the eyes (classic spectacle silhouette).
    """
    face = lm.face
    eye_span = float(
        np.hypot(lm.left_eye[0] - lm.right_eye[0], lm.left_eye[1] - lm.right_eye[1])
    ) or face.w * 0.35

    iris_r, n_r = _sample_iris_at(bgr, lm.right_eye[0], lm.right_eye[1], eye_span)
    iris_l, n_l = _sample_iris_at(bgr, lm.left_eye[0], lm.left_eye[1], eye_span)
    if n_r + n_l == 0:
        iris = (70, 90, 110)
        iris_n = 0
    else:
        # Weighted median blend via average of medians (stable enough).
        w_r = max(1, n_r)
        w_l = max(1, n_l)
        iris = (
            _clamp((iris_r[0] * w_r + iris_l[0] * w_l) / (w_r + w_l)),
            _clamp((iris_r[1] * w_r + iris_l[1] * w_l) / (w_r + w_l)),
            _clamp((iris_r[2] * w_r + iris_l[2] * w_l) / (w_r + w_l)),
        )
        iris_n = n_r + n_l

    # Eye opening scale from local contrast around the eye (larger sclera = bigger).
    # Default cartoon is already bold; keep scale in a modest range.
    eye_scale = 1.22  # base bump vs original tiny eyes
    for cx, cy in (lm.right_eye, lm.left_eye):
        r = max(6, int(eye_span * 0.12))
        x0, y0 = max(0, int(cx - r)), max(0, int(cy - r))
        x1, y1 = min(bgr.shape[1], int(cx + r)), min(bgr.shape[0], int(cy + r))
        patch = bgr[y0:y1, x0:x1]
        if patch.size:
            g = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY).astype(np.float32)
            contrast = float(g.std() / 64.0)
            eye_scale = float(np.clip(1.12 + contrast * 0.18, 1.12, 1.45))

    # --- Glasses ---
    h, w = bgr.shape[:2]
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    skin = _is_skin_ycrcb(ycrcb)

    frame_pixels: list[np.ndarray] = []
    per_eye_ratios: list[float] = []
    for cx, cy in (lm.right_eye, lm.left_eye):
        ring = _glasses_ring_mask((h, w), cx, cy, eye_span)
        # Crop to face for speed / less background noise
        x0 = max(0, face.x)
        y0 = max(0, face.y)
        x1 = min(w, face.x + face.w)
        y1 = min(h, face.y + face.h)
        local = np.zeros((h, w), dtype=bool)
        local[y0:y1, x0:x1] = True
        cand = ring & local & ~skin
        # Frames are usually darker / higher-edge than surrounding skin / sclera.
        dark = cand & (gray < 95)
        sobel = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3) ** 2 + cv2.Sobel(
            gray, cv2.CV_32F, 0, 1, ksize=3
        ) ** 2
        edge = cand & (sobel > 100**2) & (gray < 140)
        hit = dark | edge
        ratio = float(hit.sum()) / max(1, int(cand.sum()))
        per_eye_ratios.append(ratio)
        if hit.any():
            frame_pixels.append(bgr[hit])

    # Bridge between eyes (frames usually cross the nose).
    mx = (lm.right_eye[0] + lm.left_eye[0]) / 2
    my = (lm.right_eye[1] + lm.left_eye[1]) / 2
    bw = max(4, int(eye_span * 0.18))
    bh = max(3, int(eye_span * 0.055))
    bx0, by0 = max(0, int(mx - bw)), max(0, int(my - bh))
    bx1, by1 = min(w, int(mx + bw)), min(h, int(my + bh))
    bridge = bgr[by0:by1, bx0:bx1]
    bridge_gray = gray[by0:by1, bx0:bx1]
    bridge_skin = skin[by0:by1, bx0:bx1]
    bridge_hit = 0.0
    if bridge.size:
        dark_bridge = (~bridge_skin) & (bridge_gray < 90)
        bridge_hit = float(dark_bridge.mean())
        if dark_bridge.any():
            frame_pixels.append(bridge[dark_bridge])

    # Need both eyes to show frame-like rings, plus a bridge (or very strong rings).
    both_eyes = len(per_eye_ratios) == 2 and min(per_eye_ratios) > 0.10
    strong_rings = len(per_eye_ratios) == 2 and min(per_eye_ratios) > 0.20
    has_glasses = (both_eyes and bridge_hit > 0.10) or (strong_rings and bridge_hit > 0.04)

    if frame_pixels and has_glasses:
        pixels = np.concatenate([p.reshape(-1, 3) for p in frame_pixels], axis=0)
        # Prefer darker frame pixels for colour (drop bright reflections).
        lum = pixels.astype(np.float32).mean(axis=1)
        darkish = pixels[lum < np.percentile(lum, 70)] if len(pixels) > 12 else pixels
        glasses = _median_bgr(darkish if len(darkish) else pixels)
        g_n = int(pixels.shape[0])
    else:
        has_glasses = False
        glasses = (40, 40, 40)
        g_n = 0

    return EyeFeatures(
        iris_bgr=iris,
        iris_hex=_bgr_to_hex(iris),
        iris_sample_count=iris_n,
        eye_scale=eye_scale,
        has_glasses=has_glasses,
        glasses_bgr=glasses,
        glasses_hex=_bgr_to_hex(glasses),
        glasses_sample_count=g_n,
    )
