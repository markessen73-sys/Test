#!/usr/bin/env python3
"""Fit a photograph into the shared caricature face template.

Picks a face from a photo (default: rightmost), removes the background, and
affine-aligns eyes+mouth onto the canonical caricature landmark layout used by
the male/female damage templates. Writes a transparent 1024×1024 playable face.

Usage:
  python3 scripts/fit-photo-to-caricature-template.py path/to/photo.png [--side right|left]
  python3 scripts/fit-photo-to-caricature-template.py path/to/photo.png --install

Requires: opencv-python-headless, rembg, pillow, numpy
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter
from rembg import remove

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public/faces"
SIZE = 1024

# Shared layout — matches MALE_DAMAGE_LANDMARKS / male caricature proportions.
CANON = {
    "leftEye": (0.35, 0.34),
    "rightEye": (0.65, 0.34),
    "nose": (0.50, 0.45),
    "mouth": (0.50, 0.60),
    "bottomLip": (0.50, 0.66),
    "chin": (0.50, 0.82),
    "forehead": (0.50, 0.20),
    "leftEar": (0.13, 0.42),
    "rightEar": (0.87, 0.42),
}


def detect_faces(bgr: np.ndarray) -> list[tuple[int, int, int, int]]:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    cas = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cas.detectMultiScale(gray, 1.05, 5, minSize=(80, 80))
    return sorted([(int(x), int(y), int(w), int(h)) for x, y, w, h in faces], key=lambda f: f[0])


def fit_photo(photo_path: Path, side: str = "right") -> tuple[Image.Image, dict]:
    photo_bgr = cv2.imread(str(photo_path))
    if photo_bgr is None:
        raise SystemExit(f"Could not read {photo_path}")
    ph, pw = photo_bgr.shape[:2]
    faces = detect_faces(photo_bgr)
    if not faces:
        raise SystemExit("No faces detected")
    face = faces[-1] if side == "right" else faces[0]
    x, y, fw, fh = face

    pad_x, pad_t, pad_b = int(fw * 0.68), int(fh * 0.90), int(fh * 0.28)
    x0, y0 = max(0, x - pad_x), max(0, y - pad_t)
    x1, y1 = min(pw, x + fw + pad_x), min(ph, y + fh + pad_b)
    crop_rgb = cv2.cvtColor(photo_bgr[y0:y1, x0:x1], cv2.COLOR_BGR2RGB)
    cut = np.array(remove(Image.fromarray(crop_rgb)))
    cut[cut[:, :, 3] < 28, 3] = 0

    ca = cut[:, :, 3]
    cut_gray = cv2.cvtColor(cut[:, :, :3], cv2.COLOR_RGB2GRAY)
    cut_gray[ca < 40] = 0
    cas = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    found = cas.detectMultiScale(cut_gray, 1.05, 4, minSize=(80, 80))
    if len(found) == 0:
        raise SystemExit("No face in cutout")
    fx, fy, ffw, ffh = map(int, sorted(found, key=lambda f: f[2] * f[3], reverse=True)[0])

    src = {
        "leftEye": (fx + ffw * 0.30, fy + ffh * 0.37),
        "rightEye": (fx + ffw * 0.70, fy + ffh * 0.37),
        "nose": (fx + ffw * 0.50, fy + ffh * 0.54),
        "mouth": (fx + ffw * 0.50, fy + ffh * 0.73),
        "bottomLip": (fx + ffw * 0.50, fy + ffh * 0.81),
        "chin": (fx + ffw * 0.50, fy + ffh * 0.98),
        "forehead": (fx + ffw * 0.50, fy + ffh * 0.10),
        "leftEar": (fx - ffw * 0.02, fy + ffh * 0.45),
        "rightEar": (fx + ffw * 1.02, fy + ffh * 0.45),
    }

    neck_y = int(src["chin"][1] + ffh * 0.12)
    fade = np.ones((cut.shape[0],), dtype=np.float32)
    for yi in range(cut.shape[0]):
        if yi > neck_y:
            fade[yi] = float(np.clip((neck_y + ffh * 0.15 - yi) / max(1, ffh * 0.15), 0, 1))
    cut[:, :, 3] = (cut[:, :, 3].astype(np.float32) * fade[:, None]).astype(np.uint8)

    dst = {k: (v[0] * SIZE, v[1] * SIZE) for k, v in CANON.items()}
    src_pts = np.float32([src["leftEye"], src["rightEye"], src["mouth"]])
    dst_pts = np.float32([dst["leftEye"], dst["rightEye"], dst["mouth"]])
    M, _ = cv2.estimateAffinePartial2D(src_pts, dst_pts, method=cv2.LMEDS)
    if M is None:
        raise SystemExit("Affine align failed")

    warped = cv2.warpAffine(
        cut, M, (SIZE, SIZE), flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0),
    )
    warped[:, :, 3] = np.array(Image.fromarray(warped[:, :, 3]).filter(ImageFilter.GaussianBlur(0.8)))
    warped[warped[:, :, 3] < 12, 3] = 0

    # Soft fade below chin
    chin_y = int(0.80 * SIZE)
    fade_end = int(0.92 * SIZE)
    for yi in range(chin_y, SIZE):
        t = max(0.0, 1.0 - (yi - chin_y) / max(1, fade_end - chin_y))
        warped[yi, :, 3] = (warped[yi, :, 3].astype(np.float32) * t).astype(np.uint8)

    def xform(pt: tuple[float, float]) -> tuple[float, float]:
        col = M @ np.array([pt[0], pt[1], 1.0], dtype=np.float64)
        return float(col[0]) / SIZE, float(col[1]) / SIZE

    aligned = {k: (round(xform(src[k])[0], 4), round(xform(src[k])[1], 4)) for k in src}
    # Prefer canon ears for damage stamps (consistent across caricatures).
    target = {
        "leftEye": [aligned["leftEye"][0], aligned["leftEye"][1]],
        "rightEye": [aligned["rightEye"][0], aligned["rightEye"][1]],
        "nose": [aligned["nose"][0], aligned["nose"][1]],
        "mouth": [aligned["mouth"][0], aligned["mouth"][1]],
        "bottomLip": [aligned["bottomLip"][0], aligned["bottomLip"][1]],
        "chin": [aligned["chin"][0], aligned["chin"][1]],
        "forehead": [aligned["forehead"][0], round((aligned["forehead"][1] + CANON["forehead"][1]) / 2, 4)],
        "leftEar": [0.18, 0.42],
        "rightEar": [0.82, 0.42],
    }
    return Image.fromarray(warped, "RGBA"), target


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("photo", type=Path)
    ap.add_argument("--side", choices=("right", "left"), default="right")
    ap.add_argument("--install", action="store_true", help="Write as test-template-face.png")
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    face, landmarks = fit_photo(args.photo, args.side)
    out = args.out or (PUBLIC / "test-template-face-photo-man.png")
    if args.install:
        out = PUBLIC / "test-template-face.png"
        face.save(PUBLIC / "test-template-face-photo-man.png", optimize=True)
    out.parent.mkdir(parents=True, exist_ok=True)
    face.save(out, optimize=True)
    meta = out.with_suffix(".landmarks.json")
    meta.write_text(json.dumps({"target": landmarks, "canon": CANON}, indent=2) + "\n")
    print(f"Wrote {out}")
    print(f"Landmarks {meta}")
    for k, v in landmarks.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
