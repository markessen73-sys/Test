#!/usr/bin/env python3
"""Bake face-only character-select portraits for every stock boxer.

Several face packs are head-and-shoulders crops of full-body renders (gloves
up in guard), others are face-only. The select grid needs one consistent
framing, so each portrait is a square around MediaPipe face landmarks, scaled
to the landmark height, with everything below the chin except a fading neck
column cut away (drops gloves and shoulders).

Requires: pip install mediapipe pillow numpy scipy (+ libegl1 on Linux).
Model: face_landmarker.task (downloaded to /tmp on first run).

Outputs: public/faces/characters/<id>/select.png (256x256)
"""
from __future__ import annotations

import urllib.request
from pathlib import Path

import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
FACES = ROOT / 'public/faces/characters'
MODEL_URL = (
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/'
    'face_landmarker/float16/1/face_landmarker.task'
)
MODEL = Path('/tmp/face_landmarker.task')
SIZE = 256
# Crop side as a multiple of landmark (brow-to-chin) height.
FRAME = 1.7
IDS = [
    'default',
    'default-female',
    'byson',
    'tin-mick',
    'the-don',
    'king-of-the-north',
    'bozza',
    'the-nige',
    'the-greenie',
    'pricey',
    'kk',
]


def detector() -> vision.FaceLandmarker:
    if not MODEL.exists():
        urllib.request.urlretrieve(MODEL_URL, MODEL)
    return vision.FaceLandmarker.create_from_options(
        vision.FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(MODEL)),
            num_faces=1,
            min_face_detection_confidence=0.1,
            min_face_presence_confidence=0.1,
        )
    )


def landmarks(det: vision.FaceLandmarker, im: Image.Image) -> np.ndarray | None:
    flat = Image.new('RGB', im.size, (255, 255, 255))
    flat.paste(im, mask=im.split()[3])
    data = np.ascontiguousarray(np.asarray(flat))
    result = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=data))
    if not result.face_landmarks:
        return None
    return np.array([[p.x * im.width, p.y * im.height] for p in result.face_landmarks[0]])


def find_face(det: vision.FaceLandmarker, im: Image.Image) -> np.ndarray:
    lm = landmarks(det, im)
    if lm is not None:
        return lm
    # Small heads on tall canvases: retry on an upscaled crop of the top of the figure.
    x0, y0, x1, y1 = im.getbbox()
    crop = im.crop((x0, y0, x1, y0 + int((y1 - y0) * 0.6)))
    up = 3
    lm = landmarks(det, crop.resize((crop.width * up, crop.height * up), Image.LANCZOS))
    if lm is None:
        raise SystemExit('no face found')
    return lm / up + [x0, y0]


def portrait(im: Image.Image, lm: np.ndarray) -> Image.Image:
    fx0, fy0 = lm.min(axis=0)
    fx1, fy1 = lm.max(axis=0)
    fw, fh = fx1 - fx0, fy1 - fy0
    cx = (fx0 + fx1) / 2
    cy = (fy0 + fy1) / 2 - 0.08 * fh
    half = fh * FRAME / 2
    box = (int(cx - half), int(cy - half), int(cx + half), int(cy + half))
    crop = np.array(im.crop(box).resize((SIZE, SIZE), Image.LANCZOS))

    scale = SIZE / (box[2] - box[0])
    eye_y = (fy0 + 0.4 * fh - box[1]) * scale
    chin = (fy1 - box[1]) * scale
    mid = (cx - box[0]) * scale
    ys, xs = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    # Below eye level keep an oval hugging ears and jaw, plus a tapering neck.
    rx = 0.68 * fw * scale
    ry = (chin - eye_y) * 1.12
    oval = ((xs - mid) / rx) ** 2 + ((ys - eye_y) / ry) ** 2 <= 1
    neck = (np.abs(xs - mid) < 0.3 * fw * scale) & (ys < chin + 0.3 * fh * scale)
    keep = (ys < eye_y) | oval | neck
    soft = ndimage.gaussian_filter(keep.astype(np.float32), 4)
    fade = np.clip(1 - (ys - chin) / (0.3 * fh * scale), 0, 1)
    fade = np.where(ys < chin, 1.0, fade)
    crop[:, :, 3] = (crop[:, :, 3] * np.minimum(soft, np.maximum(fade, oval))).astype(np.uint8)
    return Image.fromarray(crop)


def main() -> None:
    det = detector()
    for cid in IDS:
        im = Image.open(FACES / cid / 'clean.png').convert('RGBA')
        portrait(im, find_face(det, im)).save(FACES / cid / 'select.png', optimize=True)
        print('wrote', cid)


if __name__ == '__main__':
    main()
