#!/usr/bin/env python3
"""Build a selfie/upload face-alignment guide from the default boxer face.

Reads faces/characters/default/clean.png + face-template-map.json and writes:
  - faces/guide/face-guide-outline.png  (head + eyes + nose strokes)
  - faces/guide/face-guide-mask.png     (opaque head fill for cropping)
  - faces/guide/face-guide.json         (normalized geometry)
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'frontend/public/faces/characters/default/clean.png'
MAP_PATH = ROOT / 'frontend/public/faces/face-template-map.json'
OUT = ROOT / 'frontend/public/faces/guide'


def oval_bbox(rect: list[float], w: int, h: int) -> tuple[int, int, int, int]:
  x0, y0, x1, y1 = rect
  return (
    int(round(x0 * w)),
    int(round(y0 * h)),
    int(round(x1 * w)),
    int(round(y1 * h)),
  )


def main() -> None:
  if not SRC.exists():
    raise SystemExit(f'Missing default boxer face: {SRC}')
  meta_in = json.loads(MAP_PATH.read_text())
  img = Image.open(SRC).convert('RGBA')
  w, h = img.size

  face = oval_bbox(meta_in['faceOval'], w, h)
  left_eye = oval_bbox(meta_in['regions']['leftEye'], w, h)
  right_eye = oval_bbox(meta_in['regions']['rightEye'], w, h)
  nose = oval_bbox(meta_in['regions']['nose'], w, h)

  # Smooth head oval from the template map (proportions of the default boxer).
  outline = Image.new('RGBA', (w, h), (0, 0, 0, 0))
  draw = ImageDraw.Draw(outline)

  # Head — thick white stroke
  for i in range(5):
    inset = i
    box = (face[0] + inset, face[1] + inset, face[2] - inset, face[3] - inset)
    draw.ellipse(box, outline=(255, 255, 255, 230 - i * 20), width=2)

  # Eyes — light cyan ovals
  eye_color = (140, 210, 255, 240)
  for box in (left_eye, right_eye):
    for i in range(3):
      b = (box[0] + i, box[1] + i, box[2] - i, box[3] - i)
      draw.ellipse(b, outline=eye_color, width=2)

  # Nose — rounded rect / capsule from the nose region
  nose_color = (140, 210, 255, 240)
  nx0, ny0, nx1, ny1 = nose
  # Bridge line + bulb tip oval
  cx = (nx0 + nx1) / 2
  draw.line([(cx, ny0), (cx, ny1 - (ny1 - ny0) * 0.35)], fill=nose_color, width=3)
  tip = (
    nx0 + 4,
    int(ny0 + (ny1 - ny0) * 0.35),
    nx1 - 4,
    ny1,
  )
  for i in range(3):
    b = (tip[0] + i, tip[1] + i, tip[2] - i, tip[3] - i)
    draw.ellipse(b, outline=nose_color, width=2)

  # Crosshair marks at eye/nose landmarks (subtle)
  lm = meta_in['landmarks']
  mark = (255, 255, 255, 160)
  for key in ('leftEye', 'rightEye', 'nose'):
    lx, ly = lm[key]
    x, y = int(round(lx * w)), int(round(ly * h))
    draw.line([(x - 8, y), (x + 8, y)], fill=mark, width=2)
    draw.line([(x, y - 8), (x, y + 8)], fill=mark, width=2)

  # Opaque elliptical mask for saving the fitted face
  mask = Image.new('L', (w, h), 0)
  ImageDraw.Draw(mask).ellipse(face, fill=255)

  OUT.mkdir(parents=True, exist_ok=True)
  outline.save(OUT / 'face-guide-outline.png')
  mask.save(OUT / 'face-guide-mask.png')

  guide_meta = {
    'source': 'faces/characters/default/clean.png',
    'size': [w, h],
    'faceOval': meta_in['faceOval'],
    'regions': {
      'leftEye': meta_in['regions']['leftEye'],
      'rightEye': meta_in['regions']['rightEye'],
      'nose': meta_in['regions']['nose'],
    },
    'landmarks': {
      'leftEye': meta_in['landmarks']['leftEye'],
      'rightEye': meta_in['landmarks']['rightEye'],
      'nose': meta_in['landmarks']['nose'],
    },
    'outline': 'faces/guide/face-guide-outline.png',
    'mask': 'faces/guide/face-guide-mask.png',
  }
  (OUT / 'face-guide.json').write_text(json.dumps(guide_meta, indent=2) + '\n')
  print(f'Wrote guide → {OUT}')
  print(f'  head oval px={face}')
  print(f'  eyes L={left_eye} R={right_eye} nose={nose}')


if __name__ == '__main__':
  main()
