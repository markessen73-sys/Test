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


def render_flat_caricature(features: FaceFeatures, size: int = CANVAS_SIZE) -> np.ndarray:
    """
    Paint a punch-out style head on black, features locked to bake LM.

    Returns BGR uint8 image (size × size).
    """
    img = np.zeros((size, size, 3), dtype=np.uint8)
    ink = (18, 12, 10)
    skin = features.skin_bgr
    hair = features.hair_bgr
    iris = features.iris_bgr
    lip = features.lip_bgr
    brow = features.brow_bgr

    width_scale = float(np.clip(0.92 + (features.face_aspect - 0.85) * 0.25, 0.88, 1.08))

    re = px(LM["rightEye"], size)
    le = px(LM["leftEye"], size)
    nose = px(LM["nose"], size)
    mouth = px(LM["mouth"], size)
    chin = px(LM["chin"], size)
    forehead = px(LM["forehead"], size)
    mid = ((re[0] + le[0]) / 2, (re[1] + le[1]) / 2)

    head_rx = size * 0.30 * width_scale
    head_ry = size * 0.355
    head_c = (mid[0], mid[1] + size * 0.04)

    # 1. Neck
    neck_w = size * 0.13 * width_scale
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

    # 7. Eyes
    eye_rx, eye_ry = size * 0.055, size * 0.038
    for eye in (re, le):
        _fill_ellipse(img, eye, (eye_rx, eye_ry), (250, 250, 250))
        _stroke_ellipse(img, eye, (eye_rx, eye_ry), ink, 4)
        _fill_ellipse(img, eye, (size * 0.022, size * 0.022), iris)
        _fill_ellipse(img, eye, (size * 0.009, size * 0.009), (25, 18, 12))
        _fill_ellipse(
            img,
            (eye[0] + size * 0.008, eye[1] - size * 0.01),
            (size * 0.005, size * 0.005),
            (255, 255, 255),
        )

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
