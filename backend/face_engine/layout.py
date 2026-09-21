"""Canonical gym face layout — must match frontend/scripts/lib/faceDamageBake.mjs."""

from __future__ import annotations

from dataclasses import dataclass


CANVAS_SIZE = 1024


@dataclass(frozen=True)
class Point:
    x: float
    y: float


@dataclass(frozen=True)
class Ellipse:
    x: float
    y: float
    rx: float
    ry: float


# Bake landmarks used by damage/clown painters (normalised 0–1).
LM = {
    "rightEye": Point(0.382, 0.459),
    "leftEye": Point(0.595, 0.443),
    "nose": Point(0.5, 0.52),
    "mouth": Point(0.504, 0.665),
    "bottomLip": Point(0.504, 0.715),
    "chin": Point(0.51, 0.8),
    "rightEar": Ellipse(0.162, 0.544, 0.065, 0.125),
    "leftEar": Ellipse(0.836, 0.536, 0.065, 0.125),
    "forehead": Point(0.5, 0.295),
}


def px(p: Point, size: int = CANVAS_SIZE) -> tuple[float, float]:
    return p.x * size, p.y * size
