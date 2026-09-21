"""Render a flat 2D Mickey's Gym caricature from sampled features."""

from __future__ import annotations

import cv2
import numpy as np

from .features import FaceFeatures
from .layout import CANVAS_SIZE, LM, px


def _mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))  # type: ignore[return-value]


def _darken(c: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return _mix(c, (20, 12, 8), t)


def _fill_ellipse(
    img: np.ndarray,
    center: tuple[float, float],
    axes: tuple[float, float],
    color: tuple[int, int, int],
    angle: float = 0,
) -> None:
    cv2.ellipse(
        img,
        (int(round(center[0])), int(round(center[1]))),
        (max(1, int(round(axes[0]))), max(1, int(round(axes[1])))),
        angle,
        0,
        360,
        color,
        -1,
        lineType=cv2.LINE_AA,
    )


def _stroke_ellipse(
    img: np.ndarray,
    center: tuple[float, float],
    axes: tuple[float, float],
    color: tuple[int, int, int],
    thickness: int,
    angle: float = 0,
) -> None:
    cv2.ellipse(
        img,
        (int(round(center[0])), int(round(center[1]))),
        (max(1, int(round(axes[0]))), max(1, int(round(axes[1])))),
        angle,
        0,
        360,
        color,
        thickness,
        lineType=cv2.LINE_AA,
    )


def _head_geometry(features: FaceFeatures, size: int):
    width_scale = float(np.clip(0.92 + (features.face_aspect - 0.85) * 0.25, 0.88, 1.08))
    re = px(LM["rightEye"], size)
    le = px(LM["leftEye"], size)
    chin = px(LM["chin"], size)
    forehead = px(LM["forehead"], size)
    mid = ((re[0] + le[0]) / 2, (re[1] + le[1]) / 2)
    head_rx = size * 0.30 * width_scale
    head_ry = size * 0.355
    head_c = (mid[0], mid[1] + size * 0.04)
    neck_w = size * 0.13 * width_scale
    return width_scale, re, le, chin, forehead, mid, head_rx, head_ry, head_c, neck_w


def render_skin_tone_test(features: FaceFeatures, size: int = CANVAS_SIZE) -> np.ndarray:
    """
    Skin-tone debug plate: head / neck / ears only + hex swatch.

    Used to verify sampling before hair / eyes / mouth distract from the match.
    """
    img = np.zeros((size, size, 3), dtype=np.uint8)
    ink = (18, 12, 10)
    skin = features.skin_bgr
    width_scale, _, _, chin, _, _, head_rx, head_ry, head_c, neck_w = _head_geometry(features, size)

    cv2.rectangle(
        img,
        (int(chin[0] - neck_w), int(chin[1] - size * 0.02)),
        (int(chin[0] + neck_w), int(size * 0.98)),
        skin,
        -1,
        lineType=cv2.LINE_AA,
    )
    for ear in (LM["rightEar"], LM["leftEar"]):
        _fill_ellipse(
            img,
            (ear.x * size, ear.y * size),
            (ear.rx * size * width_scale, ear.ry * size),
            _darken(skin, 0.08),
        )
        _stroke_ellipse(
            img,
            (ear.x * size, ear.y * size),
            (ear.rx * size * width_scale, ear.ry * size),
            ink,
            3,
        )
    _fill_ellipse(img, head_c, (head_rx, head_ry), skin)
    _stroke_ellipse(img, head_c, (head_rx, head_ry), ink, 5)
    cv2.line(
        img,
        (int(chin[0] - neck_w), int(chin[1])),
        (int(chin[0] - neck_w * 0.85), int(size * 0.98)),
        ink,
        3,
        lineType=cv2.LINE_AA,
    )
    cv2.line(
        img,
        (int(chin[0] + neck_w), int(chin[1])),
        (int(chin[0] + neck_w * 0.85), int(size * 0.98)),
        ink,
        3,
        lineType=cv2.LINE_AA,
    )

    # Colour swatch + hex label for side-by-side photo comparison.
    sw = int(size * 0.18)
    sx0, sy0 = int(size * 0.06), int(size * 0.78)
    cv2.rectangle(img, (sx0, sy0), (sx0 + sw, sy0 + sw), skin, -1)
    cv2.rectangle(img, (sx0, sy0), (sx0 + sw, sy0 + sw), (240, 240, 240), 2)
    label = features.skin_hex.upper()
    cv2.putText(
        img,
        label,
        (sx0, sy0 - 12),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (240, 240, 240),
        2,
        lineType=cv2.LINE_AA,
    )
    cv2.putText(
        img,
        f"n={features.skin_sample_count}",
        (sx0, sy0 + sw + 28),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (180, 180, 180),
        1,
        lineType=cv2.LINE_AA,
    )
    return img


def _eye_axes(features: FaceFeatures, size: int) -> tuple[float, float, float, float]:
    """White / iris / pupil radii — positions stay on bake LM; size scales up."""
    s = float(np.clip(features.eye_scale, 1.05, 1.5))
    eye_rx = size * 0.072 * s
    eye_ry = size * 0.050 * s
    iris_r = size * 0.030 * s
    pupil_r = size * 0.012 * s
    return eye_rx, eye_ry, iris_r, pupil_r


def _paint_eyes(
    img: np.ndarray,
    features: FaceFeatures,
    size: int,
    re: tuple[float, float],
    le: tuple[float, float],
    ink: tuple[int, int, int],
) -> None:
    iris = features.iris_bgr
    eye_rx, eye_ry, iris_r, pupil_r = _eye_axes(features, size)
    for eye in (re, le):
        _fill_ellipse(img, eye, (eye_rx, eye_ry), (250, 250, 250))
        _stroke_ellipse(img, eye, (eye_rx, eye_ry), ink, max(3, int(4 * features.eye_scale)))
        _fill_ellipse(img, eye, (iris_r, iris_r), iris)
        _fill_ellipse(img, eye, (pupil_r, pupil_r), (25, 18, 12))
        _fill_ellipse(
            img,
            (eye[0] + size * 0.010 * features.eye_scale, eye[1] - size * 0.012 * features.eye_scale),
            (size * 0.006 * features.eye_scale, size * 0.006 * features.eye_scale),
            (255, 255, 255),
        )


def _paint_glasses(
    img: np.ndarray,
    features: FaceFeatures,
    size: int,
    re: tuple[float, float],
    le: tuple[float, float],
) -> None:
    if not features.has_glasses:
        return
    frame = features.glasses_bgr
    eye_rx, eye_ry, _, _ = _eye_axes(features, size)
    # Frames sit slightly outside the white of the eye.
    gx, gy = eye_rx * 1.28, eye_ry * 1.35
    thickness = max(5, int(size * 0.009))
    for eye in (re, le):
        _stroke_ellipse(img, eye, (gx, gy), frame, thickness)
    # Bridge
    mid_y = (re[1] + le[1]) / 2
    cv2.line(
        img,
        (int(re[0] + gx * 0.85), int(mid_y)),
        (int(le[0] - gx * 0.85), int(mid_y)),
        frame,
        max(4, thickness - 1),
        lineType=cv2.LINE_AA,
    )
    # Short temples toward ears
    for eye, side in ((re, -1), (le, 1)):
        cv2.line(
            img,
            (int(eye[0] + side * gx * 0.95), int(eye[1])),
            (int(eye[0] + side * gx * 1.55), int(eye[1] + size * 0.01)),
            frame,
            max(3, thickness - 2),
            lineType=cv2.LINE_AA,
        )


def render_eyes_test(features: FaceFeatures, size: int = CANVAS_SIZE) -> np.ndarray:
    """
    Eyes debug plate: skin head + brows + larger eyes (+ glasses) + swatches.

    Positions stay on bake LM; size / iris colour / frames are what we verify.
    """
    img = np.zeros((size, size, 3), dtype=np.uint8)
    ink = (18, 12, 10)
    skin = features.skin_bgr
    brow = features.brow_bgr
    width_scale, re, le, chin, _, _, head_rx, head_ry, head_c, neck_w = _head_geometry(
        features, size
    )

    cv2.rectangle(
        img,
        (int(chin[0] - neck_w), int(chin[1] - size * 0.02)),
        (int(chin[0] + neck_w), int(size * 0.98)),
        skin,
        -1,
        lineType=cv2.LINE_AA,
    )
    for ear in (LM["rightEar"], LM["leftEar"]):
        _fill_ellipse(
            img,
            (ear.x * size, ear.y * size),
            (ear.rx * size * width_scale, ear.ry * size),
            _darken(skin, 0.08),
        )
        _stroke_ellipse(
            img,
            (ear.x * size, ear.y * size),
            (ear.rx * size * width_scale, ear.ry * size),
            ink,
            3,
        )
    _fill_ellipse(img, head_c, (head_rx, head_ry), skin)

    for eye, side in ((re, -1), (le, 1)):
        pts = np.array(
            [
                [eye[0] - side * size * 0.06, eye[1] - size * 0.05],
                [eye[0], eye[1] - size * 0.06],
                [eye[0] + side * size * 0.055, eye[1] - size * 0.04],
            ],
            dtype=np.int32,
        )
        cv2.polylines(img, [pts], False, brow, 6, lineType=cv2.LINE_AA)

    _paint_eyes(img, features, size, re, le, ink)
    _paint_glasses(img, features, size, re, le)
    _stroke_ellipse(img, head_c, (head_rx, head_ry), ink, 5)

    # Iris swatch
    sw = int(size * 0.14)
    sx0, sy0 = int(size * 0.06), int(size * 0.80)
    cv2.rectangle(img, (sx0, sy0), (sx0 + sw, sy0 + sw), features.iris_bgr, -1)
    cv2.rectangle(img, (sx0, sy0), (sx0 + sw, sy0 + sw), (240, 240, 240), 2)
    cv2.putText(
        img,
        f"iris {features.iris_hex.upper()}",
        (sx0, sy0 - 12),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (240, 240, 240),
        2,
        lineType=cv2.LINE_AA,
    )
    # Glasses swatch (or “no glasses”)
    gx0 = sx0 + sw + int(size * 0.04)
    if features.has_glasses:
        cv2.rectangle(img, (gx0, sy0), (gx0 + sw, sy0 + sw), features.glasses_bgr, -1)
        cv2.rectangle(img, (gx0, sy0), (gx0 + sw, sy0 + sw), (240, 240, 240), 2)
        cv2.putText(
            img,
            f"frames {features.glasses_hex.upper()}",
            (gx0, sy0 - 12),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (240, 240, 240),
            2,
            lineType=cv2.LINE_AA,
        )
    else:
        cv2.putText(
            img,
            f"no glasses ({features.glasses_score:.2f})",
            (gx0, sy0 + sw // 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (160, 160, 160),
            2,
            lineType=cv2.LINE_AA,
        )
    cv2.putText(
        img,
        f"scale={features.eye_scale:.2f}",
        (sx0, sy0 + sw + 28),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.5,
        (180, 180, 180),
        1,
        lineType=cv2.LINE_AA,
    )
    return img


def render_flat_caricature(
    features: FaceFeatures,
    size: int = CANVAS_SIZE,
    *,
    mode: str = "full",
) -> np.ndarray:
    """
    Paint a punch-out style head on black, features locked to bake LM.

    mode:
      - "full": complete caricature
      - "skin": skin-tone test plate only
      - "eyes": eyes / glasses test plate

    Returns BGR uint8 image (size × size).
    """
    if mode == "skin":
        return render_skin_tone_test(features, size=size)
    if mode == "eyes":
        return render_eyes_test(features, size=size)

    img = np.zeros((size, size, 3), dtype=np.uint8)
    ink = (18, 12, 10)
    skin = features.skin_bgr
    hair = features.hair_bgr
    lip = features.lip_bgr
    brow = features.brow_bgr

    width_scale, re, le, chin, forehead, mid, head_rx, head_ry, head_c, neck_w = _head_geometry(
        features, size
    )
    nose = px(LM["nose"], size)
    mouth = px(LM["mouth"], size)

    # 1. Neck
    cv2.rectangle(
        img,
        (int(chin[0] - neck_w), int(chin[1] - size * 0.02)),
        (int(chin[0] + neck_w), int(size * 0.98)),
        skin,
        -1,
        lineType=cv2.LINE_AA,
    )

    # 2. Ears
    for ear in (LM["rightEar"], LM["leftEar"]):
        _fill_ellipse(
            img,
            (ear.x * size, ear.y * size),
            (ear.rx * size * width_scale, ear.ry * size),
            _darken(skin, 0.08),
        )
        _stroke_ellipse(
            img,
            (ear.x * size, ear.y * size),
            (ear.rx * size * width_scale, ear.ry * size),
            ink,
            3,
        )

    # 3. Hair mass (behind / around crown) then head on top of lower hair
    hair_h = size * (0.13 + 0.05 * features.hair_darkness)
    _fill_ellipse(img, (forehead[0], forehead[1] - size * 0.04), (head_rx * 1.08, hair_h * 1.15), hair)
    for ear in (LM["rightEar"], LM["leftEar"]):
        side = -1 if ear.x < 0.5 else 1
        _fill_ellipse(
            img,
            (ear.x * size + side * size * 0.01, mid[1] - size * 0.04),
            (size * 0.06 * width_scale, size * 0.18),
            hair,
        )

    # 4. Head oval
    _fill_ellipse(img, head_c, (head_rx, head_ry), skin)

    # 5. Crown fringe on top of forehead only
    fringe = np.zeros_like(img)
    _fill_ellipse(fringe, (forehead[0], forehead[1] - size * 0.06), (head_rx * 0.98, hair_h), hair)
    fringe_mask = np.zeros((size, size), dtype=np.uint8)
    cv2.ellipse(
        fringe_mask,
        (int(head_c[0]), int(head_c[1])),
        (int(head_rx), int(head_ry)),
        0,
        200,
        340,
        255,
        -1,
        lineType=cv2.LINE_AA,
    )
    img = np.where(fringe_mask[:, :, None] > 0, np.where(fringe > 0, fringe, img), img)

    # 6. Eyebrows
    for eye, side in ((re, -1), (le, 1)):
        pts = np.array(
            [
                [eye[0] - side * size * 0.06, eye[1] - size * 0.05],
                [eye[0], eye[1] - size * 0.06],
                [eye[0] + side * size * 0.055, eye[1] - size * 0.04],
            ],
            dtype=np.int32,
        )
        cv2.polylines(img, [pts], False, brow, 6, lineType=cv2.LINE_AA)

    # 7. Eyes (+ glasses if detected) — LM positions fixed, size/colour from photo
    _paint_eyes(img, features, size, re, le, ink)
    _paint_glasses(img, features, size, re, le)

    # 8. Nose
    nose_pts = np.array(
        [
            [nose[0], nose[1] - size * 0.015],
            [nose[0] + size * 0.03, nose[1] + size * 0.05],
            [nose[0] - size * 0.012, nose[1] + size * 0.055],
        ],
        dtype=np.int32,
    )
    cv2.fillConvexPoly(img, nose_pts, _darken(skin, 0.1), lineType=cv2.LINE_AA)
    cv2.polylines(img, [nose_pts], True, ink, 3, lineType=cv2.LINE_AA)

    # 9. Mouth
    _fill_ellipse(img, mouth, (size * 0.07, size * 0.028), _darken(lip, 0.12))
    _stroke_ellipse(img, mouth, (size * 0.07, size * 0.028), ink, 3)
    cv2.ellipse(
        img,
        (int(mouth[0]), int(mouth[1])),
        (int(size * 0.055), int(size * 0.02)),
        0,
        20,
        160,
        ink,
        2,
        lineType=cv2.LINE_AA,
    )

    # 10. Outlines
    _stroke_ellipse(img, head_c, (head_rx, head_ry), ink, 5)
    cv2.line(
        img,
        (int(chin[0] - neck_w), int(chin[1])),
        (int(chin[0] - neck_w * 0.85), int(size * 0.98)),
        ink,
        3,
        lineType=cv2.LINE_AA,
    )
    cv2.line(
        img,
        (int(chin[0] + neck_w), int(chin[1])),
        (int(chin[0] + neck_w * 0.85), int(size * 0.98)),
        ink,
        3,
        lineType=cv2.LINE_AA,
    )

    return img


def to_png_bytes(bgr: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", bgr)
    if not ok:
        raise RuntimeError("Failed to encode PNG")
    return bytes(buf)
