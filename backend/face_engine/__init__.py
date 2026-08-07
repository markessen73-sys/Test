"""Standalone Mickey's Gym face caricature engine.

Converts a face photo into a flat 2D boxing caricature that matches the
built-in character packs (Default / Byson / Tin Mick / The Don):

- 1024×1024 canvas
- Head + neck only on pure black
- Features aligned to the damage-bake landmarks (LM)
- Bold black outlines, cel-shaded flat colour

This package is UI-free: call `convert_photo_to_caricature()` or run:

    python -m face_engine path/to/photo.jpg -o clean.png
"""

from .engine import CaricatureResult, convert_photo_to_caricature
from .layout import CANVAS_SIZE, LM

__all__ = [
    "CaricatureResult",
    "convert_photo_to_caricature",
    "CANVAS_SIZE",
    "LM",
]
