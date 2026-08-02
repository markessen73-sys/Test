#!/usr/bin/env python3
"""Build the face-alignment guide from the yellow wireframe reference image.

Source: file_00000000178081f48b8c802f02b638c3.png
Writes:
  - faces/guide/face-guide-outline.png  (yellow wireframe only)
  - faces/guide/face-guide-mask.png     (head fill for cropping)
  - faces/guide/face-guide.json
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'file_00000000178081f48b8c802f02b638c3.png'
OUT = ROOT / 'frontend/public/faces/guide'


def yellow_mask(arr: np.ndarray) -> np.ndarray:
  r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
  return (a > 10) & (r > 160) & (g > 120) & (b < 150) & (r + g > b + 80)


def white_fill(arr: np.ndarray) -> np.ndarray:
  r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
  return (a > 10) & (r > 200) & (g > 200) & (b > 200)


def main() -> None:
  if not SRC.exists():
    raise SystemExit(f'Missing wireframe source: {SRC}')
  img = Image.open(SRC).convert('RGBA')
  arr = np.array(img)
  h, w = arr.shape[:2]

  yel = yellow_mask(arr)
  fill = white_fill(arr)

  # Outline: keep the yellow strokes (slightly thickened for screen visibility)
  outline = np.zeros((h, w, 4), dtype=np.uint8)
  outline[yel] = [255, 214, 0, 255]
  out_img = Image.fromarray(outline).filter(ImageFilter.MaxFilter(3))
  # Re-apply pure yellow after thicken
  oa = np.array(out_img)
  oa[(oa[:, :, 3] > 20)] = [255, 214, 0, 245]
  out_img = Image.fromarray(oa)

  # Mask: white fill + yellow strokes, then flood-close gaps and keep largest blob
  mask_bin = fill | yel
  mask_img = Image.fromarray((mask_bin.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(5))
  mask_img = mask_img.filter(ImageFilter.MinFilter(3))
  mb = np.array(mask_img) > 127

  # Bounding box of head for guide meta
  ys, xs = np.where(mb)
  if not len(ys):
    raise SystemExit('No head region found in wireframe')
  x0, x1 = int(xs.min()), int(xs.max())
  y0, y1 = int(ys.min()), int(ys.max())

  # Soft elliptical crop mask from silhouette bbox (slight inset)
  pad_x = int((x1 - x0) * 0.02)
  pad_y = int((y1 - y0) * 0.02)
  ellipse = Image.new('L', (w, h), 0)
  ImageDraw.Draw(ellipse).ellipse(
    (x0 + pad_x, y0 + pad_y, x1 - pad_x, y1 - pad_y),
    fill=255,
  )
  # Prefer actual silhouette for crop — cleaner ears/neck
  sil = Image.fromarray((mb.astype(np.uint8) * 255))
  # Combine: silhouette, lightly feathered
  sil = sil.filter(ImageFilter.GaussianBlur(0.8))

  OUT.mkdir(parents=True, exist_ok=True)
  out_img.save(OUT / 'face-guide-outline.png')
  sil.save(OUT / 'face-guide-mask.png')

  # Also keep a copy of the source in public for reference
  pub_src = ROOT / 'frontend/public/faces/guide/wireframe-source.png'
  img.save(pub_src)

  meta = {
    'source': SRC.name,
    'size': [w, h],
    'faceOval': [
      round(x0 / w, 4),
      round(y0 / h, 4),
      round(x1 / w, 4),
      round(y1 / h, 4),
    ],
    'outline': 'faces/guide/face-guide-outline.png',
    'mask': 'faces/guide/face-guide-mask.png',
  }
  (OUT / 'face-guide.json').write_text(json.dumps(meta, indent=2) + '\n')
  print(f'Wrote yellow wireframe guide → {OUT}')
  print(f'  yellow px={int(yel.sum())} fill px={int(fill.sum())} oval={meta["faceOval"]}')


if __name__ == '__main__':
  main()
