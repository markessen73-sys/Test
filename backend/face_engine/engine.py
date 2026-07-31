"""Orchestrate photo → Mickey's Gym caricature."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from .features import FaceFeatures, extract_features
from .landmarks import PhotoLandmarks, detect_primary_face
from .layout import CANVAS_SIZE
from .render import render_flat_caricature, to_png_bytes

VALID_MODES = frozenset({"full", "skin", "eyes"})


@dataclass(frozen=True)
class CaricatureResult:
    """Output of the standalone engine."""

    png_bytes: bytes
    image_bgr: np.ndarray
    landmarks: PhotoLandmarks
    features: FaceFeatures
    mode: str = "full"
    canvas_size: int = CANVAS_SIZE


def _load_bgr(source: bytes | str | Path | np.ndarray) -> np.ndarray:
    if isinstance(source, np.ndarray):
        if source.ndim == 2:
            return cv2.cvtColor(source, cv2.COLOR_GRAY2BGR)
        if source.shape[2] == 4:
            return cv2.cvtColor(source, cv2.COLOR_BGRA2BGR)
        return source
    if isinstance(source, (str, Path)):
        path = Path(source)
        img = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if img is None:
            raise FileNotFoundError(f"Could not read image: {path}")
        return img
    if isinstance(source, (bytes, bytearray)):
        arr = np.frombuffer(source, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image bytes")
        return img
    raise TypeError(f"Unsupported source type: {type(source)}")


def convert_photo_to_caricature(
    source: bytes | str | Path | np.ndarray,
    *,
    canvas_size: int = CANVAS_SIZE,
    mode: str = "full",
) -> CaricatureResult:
    """
    Convert a face photo into a flat 2D gym caricature.

    Pipeline (no UI dependency):
      1. Detect primary face
      2. Estimate feature landmarks
      3. Sample skin / hair / iris / lip colours from the photo
      4. Paint a cartoon head on black, locked to bake LM positions

    mode:
      - "full": complete caricature
      - "skin": skin-tone test plate (head/neck/ears + swatch) — verify tone first
      - "eyes": eyes / glasses test plate — larger eyes, iris colour, frames
    """
    if mode not in VALID_MODES:
        raise ValueError(f"Unknown mode {mode!r}; expected one of {sorted(VALID_MODES)}")

    bgr = _load_bgr(source)
    landmarks = detect_primary_face(bgr)
    features = extract_features(bgr, landmarks)
    cartoon = render_flat_caricature(features, size=canvas_size, mode=mode)
    return CaricatureResult(
        png_bytes=to_png_bytes(cartoon),
        image_bgr=cartoon,
        landmarks=landmarks,
        features=features,
        mode=mode,
        canvas_size=canvas_size,
    )
