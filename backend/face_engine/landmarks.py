"""Face detection + landmark estimation from a photo."""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass(frozen=True)
class FaceBox:
    x: int
    y: int
    w: int
    h: int


@dataclass(frozen=True)
class PhotoLandmarks:
    """Pixel coordinates in the source image."""

    right_eye: tuple[float, float]
    left_eye: tuple[float, float]
    nose: tuple[float, float]
    mouth: tuple[float, float]
    chin: tuple[float, float]
    forehead: tuple[float, float]
    face: FaceBox


def _haar() -> cv2.CascadeClassifier:
    path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    return cv2.CascadeClassifier(path)


def detect_faces(bgr: np.ndarray) -> list[FaceBox]:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    faces = _haar().detectMultiScale(gray, 1.08, 5, minSize=(64, 64))
    boxes = [FaceBox(int(x), int(y), int(w), int(h)) for x, y, w, h in faces]
    return sorted(boxes, key=lambda f: f.w * f.h, reverse=True)


def estimate_landmarks(face: FaceBox) -> PhotoLandmarks:
    """Heuristic landmark layout inside a detected face box (OpenCV-only)."""
    x, y, w, h = face.x, face.y, face.w, face.h
    return PhotoLandmarks(
        right_eye=(x + w * 0.32, y + h * 0.38),
        left_eye=(x + w * 0.68, y + h * 0.38),
        nose=(x + w * 0.50, y + h * 0.55),
        mouth=(x + w * 0.50, y + h * 0.72),
        chin=(x + w * 0.50, y + h * 0.96),
        forehead=(x + w * 0.50, y + h * 0.12),
        face=face,
    )


def detect_primary_face(bgr: np.ndarray) -> PhotoLandmarks:
    faces = detect_faces(bgr)
    if not faces:
        # Fallback: treat the whole frame as a centred head crop.
        h, w = bgr.shape[:2]
        side = int(min(w, h) * 0.72)
        fx = (w - side) // 2
        fy = (h - side) // 2
        faces = [FaceBox(fx, fy, side, side)]
    return estimate_landmarks(faces[0])
