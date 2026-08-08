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
    glasses_score: float = 0.0  # debug / tuning


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
    """Nudge heuristic eye landmark toward the pupil (darkest local blob)."""
    h, w = bgr.shape[:2]
    r = max(8, int(eye_span * 0.16))
    x0, y0 = max(0, int(cx - r)), max(0, int(cy - r))
    x1, y1 = min(w, int(cx + r) + 1), min(h, int(cy + r) + 1)
    roi = bgr[y0:y1, x0:x1]
    if roi.size == 0:
        return cx, cy
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
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
) -> tuple[tuple[int, int, int], int, tuple[float, float]]:
    """Sample iris from an annulus around the refined eye centre."""
    cx, cy = _refine_eye_center(bgr, cx, cy, eye_span)
    h, w = bgr.shape[:2]
    r_out = max(4, int(eye_span * 0.085))
    r_in = max(1, int(r_out * 0.32))
    x0, y0 = max(0, int(cx - r_out)), max(0, int(cy - r_out))
    x1, y1 = min(w, int(cx + r_out) + 1), min(h, int(cy + r_out) + 1)
    roi = bgr[y0:y1, x0:x1]
    if roi.size == 0:
        return (70, 90, 110), 0, (cx, cy)

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

    keep = ring_flat & ~skin_flat & (lum > 28) & (lum < 200) & (chroma > 12)
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
        return (70, 90, 110), 0, (cx, cy)
    return _median_bgr(pixels), int(len(pixels)), (cx, cy)


def _radial_ridge_score(
    blur: np.ndarray,
    edges: np.ndarray,
    face_mask: np.ndarray,
    bgr: np.ndarray,
    cx: float,
    cy: float,
    eye_span: float,
) -> tuple[float, list[np.ndarray], float]:
    """
    Fraction of rays that hit a thin intensity ridge at a *consistent*
    spectacle-frame radius.

    Returns (coverage, colour samples, radius_consistency).
    Face-silhouette edges have high coverage but inconsistent radii — we
    down-weight those so bare faces don't false-trigger.
    """
    h, w = blur.shape[:2]
    # Outside sclera/iris; inside cheek (avoid head outline).
    r_lo = eye_span * 0.16
    r_hi = eye_span * 0.27
    angles = np.linspace(0, 2 * np.pi, 56, endpoint=False)
    hit_radii: list[float] = []
    samples: list[np.ndarray] = []

    for ang in angles:
        best_strength = 0.0
        best_pt: tuple[int, int] | None = None
        best_rad = 0.0
        cos_a, sin_a = float(np.cos(ang)), float(np.sin(ang))
        for rad in np.linspace(r_lo, r_hi, 20):
            x = int(round(cx + cos_a * rad))
            y = int(round(cy + sin_a * rad))
            if x < 2 or y < 2 or x >= w - 2 or y >= h - 2:
                continue
            if not face_mask[y, x]:
                continue
            x_in = int(round(cx + cos_a * max(1.0, rad - 2.5)))
            y_in = int(round(cy + sin_a * max(1.0, rad - 2.5)))
            x_out = int(round(cx + cos_a * (rad + 2.5)))
            y_out = int(round(cy + sin_a * (rad + 2.5)))
            if not (0 <= x_in < w and 0 <= y_in < h and 0 <= x_out < w and 0 <= y_out < h):
                continue
            # Skip if outside neighbour leaves the face (silhouette, not frames).
            if not face_mask[y_out, x_out]:
                continue
            g_here = float(blur[y, x])
            g_in = float(blur[y_in, x_in])
            g_out = float(blur[y_out, x_out])
            # Ignore near-white sclera spikes.
            if g_here > 215 and g_in > 200:
                continue
            dark_ridge = max(g_in, g_out) - g_here
            bright_ridge = g_here - min(g_in, g_out)
            strength = max(dark_ridge, bright_ridge * 0.9)
            if edges[y, x] > 0:
                strength += 10.0
            if strength > best_strength:
                best_strength = strength
                best_pt = (x, y)
                best_rad = rad
        if best_strength >= 12.0 and best_pt is not None:
            hit_radii.append(best_rad)
            bx, by = best_pt
            samples.append(bgr[by, bx].copy())

    coverage = len(hit_radii) / float(len(angles))
    if len(hit_radii) >= 6:
        consistency = 1.0 - float(np.std(hit_radii) / max(1.0, eye_span * 0.08))
        consistency = float(np.clip(consistency, 0.0, 1.0))
    else:
        consistency = 0.0
    return coverage, samples, consistency


def _detect_glasses(
    bgr: np.ndarray,
    face: object,
    eye_span: float,
    right: tuple[float, float],
    left: tuple[float, float],
) -> tuple[bool, tuple[int, int, int], int, float]:
    """
    Detect spectacle frames on a selfie.

    Primary cue: radial ridge coverage around both refined eye centres at a
    consistent radius (dark plastic, thin metal, light acetate).
    Support: bridge band + temples.
    """
    h, w = bgr.shape[:2]
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (3, 3), 0).astype(np.float32)
    edges = cv2.dilate(
        cv2.Canny(gray, 28, 95),
        np.ones((3, 3), np.uint8),
        iterations=1,
    )
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    skin = _is_skin_ycrcb(ycrcb)

    fx, fy, fw, fh = face.x, face.y, face.w, face.h  # type: ignore[attr-defined]
    # Inset face mask so head silhouette isn't treated as a frame ridge.
    pad = max(4, int(fw * 0.08))
    face_mask = np.zeros((h, w), dtype=bool)
    face_mask[
        max(0, fy + pad) : min(h, fy + fh - pad),
        max(0, fx + pad) : min(w, fx + fw - pad),
    ] = True

    ridge_scores: list[float] = []
    consistencies: list[float] = []
    colour_pixels: list[np.ndarray] = []
    for cx, cy in (right, left):
        ridge, samples, cons = _radial_ridge_score(
            blur, edges, face_mask, bgr, cx, cy, eye_span
        )
        ridge_scores.append(ridge)
        consistencies.append(cons)
        if samples:
            colour_pixels.append(np.stack(samples, axis=0))

    # Bridge between eyes
    mx = (right[0] + left[0]) / 2
    my = (right[1] + left[1]) / 2
    bw = max(6, int(eye_span * 0.28))
    bh = max(5, int(eye_span * 0.15))
    bx0, by0 = max(0, int(mx - bw)), max(0, int(my - bh))
    bx1, by1 = min(w, int(mx + bw)), min(h, int(my + bh))
    bridge_edge = 0.0
    bridge_contrast = 0.0
    if bx1 > bx0 and by1 > by0:
        bridge_e = edges[by0:by1, bx0:bx1]
        bridge_g = gray[by0:by1, bx0:bx1].astype(np.float32)
        bridge_s = skin[by0:by1, bx0:bx1]
        bridge_edge = float((bridge_e > 0).mean())
        med_b = float(np.median(bridge_g)) if bridge_g.size else 128.0
        contrast_bridge = (~bridge_s) & ((bridge_g < med_b - 8) | (bridge_g > med_b + 14))
        bridge_contrast = float(contrast_bridge.mean())
        if contrast_bridge.any():
            colour_pixels.append(bgr[by0:by1, bx0:bx1][contrast_bridge])

    # Temples
    temple_score = 0.0
    for cx, cy, side in ((right[0], right[1], -1.0), (left[0], left[1], 1.0)):
        tx0 = int(cx + side * eye_span * 0.22)
        tx1 = int(cx + side * eye_span * 0.48)
        ty0 = int(cy - eye_span * 0.08)
        ty1 = int(cy + eye_span * 0.10)
        x_a, x_b = sorted((max(0, tx0), max(0, tx1)))
        x_b = min(w, max(x_b, x_a + 1))
        y_a, y_b = max(0, ty0), min(h, max(ty1, ty0 + 1))
        if x_b > x_a and y_b > y_a:
            temple_score += float((edges[y_a:y_b, x_a:x_b] > 0).mean())
    temple_score *= 0.5

    min_ridge = min(ridge_scores) if ridge_scores else 0.0
    mean_ridge = float(np.mean(ridge_scores)) if ridge_scores else 0.0
    mean_cons = float(np.mean(consistencies)) if consistencies else 0.0
    score = (
        mean_ridge * 2.2
        + min_ridge * 2.0
        + mean_cons * 1.4
        + bridge_edge * 1.1
        + bridge_contrast * 0.9
        + temple_score * 0.8
    )

    # Strong radial coverage = frames. Bare faces sit ~0.25 on synthetics;
    # real/dark frames clear 0.35+. Keep a force-glasses UI override for misses.
    has_glasses = (
        (min_ridge >= 0.36 and mean_cons >= 0.45)
        or (min_ridge >= 0.30 and mean_cons >= 0.50 and bridge_edge >= 0.055)
        or (min_ridge >= 0.30 and temple_score >= 0.055)
        or (min_ridge >= 0.28 and bridge_contrast >= 0.06 and bridge_edge >= 0.05)
        or (mean_ridge >= 0.48 and mean_cons >= 0.50)
        or (min_ridge >= 0.42)
    )

    if colour_pixels:
        pixels = np.concatenate([p.reshape(-1, 3) for p in colour_pixels], axis=0)
        lum = pixels.astype(np.float32).mean(axis=1)
        usable = pixels[lum < 210] if (lum < 210).sum() >= 8 else pixels
        lum_u = usable.astype(np.float32).mean(axis=1)
        if float(np.median(lum_u)) < 110:
            pick = usable[lum_u <= np.percentile(lum_u, 55)] if len(usable) > 16 else usable
        else:
            pick = usable[lum_u >= np.percentile(lum_u, 35)] if len(usable) > 16 else usable
        glasses = _median_bgr(pick if len(pick) else usable)
        g_n = int(pixels.shape[0])
    else:
        glasses = (35, 32, 30)
        g_n = 0

    return has_glasses, glasses, g_n, float(score)


def detect_eyes_and_glasses(bgr: np.ndarray, lm: PhotoLandmarks) -> EyeFeatures:
    """Sample iris colour, estimate eye opening scale, and detect glasses frames."""
    face = lm.face
    eye_span = float(
        np.hypot(lm.left_eye[0] - lm.right_eye[0], lm.left_eye[1] - lm.right_eye[1])
    ) or face.w * 0.35

    iris_r, n_r, right = _sample_iris_at(bgr, lm.right_eye[0], lm.right_eye[1], eye_span)
    iris_l, n_l, left = _sample_iris_at(bgr, lm.left_eye[0], lm.left_eye[1], eye_span)
    if n_r + n_l == 0:
        iris = (70, 90, 110)
        iris_n = 0
    else:
        w_r = max(1, n_r)
        w_l = max(1, n_l)
        iris = (
            _clamp((iris_r[0] * w_r + iris_l[0] * w_l) / (w_r + w_l)),
            _clamp((iris_r[1] * w_r + iris_l[1] * w_l) / (w_r + w_l)),
            _clamp((iris_r[2] * w_r + iris_l[2] * w_l) / (w_r + w_l)),
        )
        iris_n = n_r + n_l

    eye_scale = 1.22
    for cx, cy in (right, left):
        r = max(6, int(eye_span * 0.12))
        x0, y0 = max(0, int(cx - r)), max(0, int(cy - r))
        x1, y1 = min(bgr.shape[1], int(cx + r)), min(bgr.shape[0], int(cy + r))
        patch = bgr[y0:y1, x0:x1]
        if patch.size:
            g = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY).astype(np.float32)
            contrast = float(g.std() / 64.0)
            eye_scale = float(np.clip(1.12 + contrast * 0.18, 1.12, 1.45))

    has_glasses, glasses, g_n, score = _detect_glasses(bgr, face, eye_span, right, left)

    return EyeFeatures(
        iris_bgr=iris,
        iris_hex=_bgr_to_hex(iris),
        iris_sample_count=iris_n,
        eye_scale=eye_scale,
        has_glasses=has_glasses,
        glasses_bgr=glasses,
        glasses_hex=_bgr_to_hex(glasses),
        glasses_sample_count=g_n,
        glasses_score=score,
    )
