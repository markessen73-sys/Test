#!/usr/bin/env python3
"""Build the face-alignment guide from the yellow wireframe reference image.

Source: file_00000000178081f48b8c802f02b638c3.png

Keeps only the outer head outline — ears, eyes, and nose are removed.
Writes:
  - faces/guide/face-guide-outline.png  (yellow head outline)
  - faces/guide/face-guide-mask.png     (earless head fill for cropping)
  - faces/guide/face-guide.json
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'file_00000000178081f48b8c802f02b638c3.png'
OUT = ROOT / 'frontend/public/faces/guide'


def yellow_mask(arr: np.ndarray) -> np.ndarray:
  r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
  return (a > 10) & (r > 160) & (g > 120) & (b < 150) & (r + g > b + 80)


def white_fill(arr: np.ndarray) -> np.ndarray:
  r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
  return (a > 10) & (r > 200) & (g > 200) & (b > 200)


def row_extents(mask: np.ndarray) -> list[tuple[int, int, int] | None]:
  h, _ = mask.shape
  rows: list[tuple[int, int, int] | None] = []
  for y in range(h):
    xs = np.where(mask[y])[0]
    if not len(xs):
      rows.append(None)
    else:
      rows.append((int(xs.min()), int(xs.max()), int(xs.max() - xs.min() + 1)))
  return rows


def remove_ears(sil: np.ndarray) -> np.ndarray:
  """Clamp side flares (ears) back to the cheek line interpolated from neighbors."""
  h, w = sil.shape
  rows = row_extents(sil)
  widths = np.array([r[2] if r else 0 for r in rows], dtype=np.float64)

  # Face width without ears ≈ median width of upper head (before ear flare).
  pre_ear = widths[80:340]
  pre_ear = pre_ear[pre_ear > 50]
  if not len(pre_ear):
    return sil
  base_w = float(np.median(pre_ear))
  # Ear band: rows much wider than the upper head
  ear_band = np.where(widths > base_w * 1.18)[0]
  if not len(ear_band):
    return sil
  y0, y1 = int(ear_band.min()), int(ear_band.max())

  # Cheek anchors just above / below the ear band
  def cheek_at(y: int) -> tuple[int, int]:
    for dy in range(0, 80):
      for yy in (y - dy, y + dy):
        if 0 <= yy < h and rows[yy] and rows[yy][2] <= base_w * 1.12:
          L, R, _ = rows[yy]
          return L, R
    # fallback: center a base_w span
    return int(w / 2 - base_w / 2), int(w / 2 + base_w / 2)

  above = cheek_at(y0 - 1)
  below = cheek_at(y1 + 1)
  out = sil.copy()
  for y in range(y0, y1 + 1):
    t = (y - y0) / max(1, y1 - y0)
    # ease through mid so cheeks stay roughly constant across ears
    u = t * t * (3 - 2 * t)
    L = int(round(above[0] * (1 - u) + below[0] * u))
    R = int(round(above[1] * (1 - u) + below[1] * u))
    # slight outward ease so the jaw isn't pinched
    mid = (above[0] + below[0]) / 2
    midR = (above[1] + below[1]) / 2
    # Prefer the wider of lerp vs mid cheek (keeps oval shape)
    L = min(L, int(mid))
    R = max(R, int(midR))
    if rows[y]:
      curL, curR, _ = rows[y]
      if curL < L:
        out[y, curL:L] = False
      if curR > R:
        out[y, R + 1 : curR + 1] = False
  return out


def silhouette_edge(mask: np.ndarray) -> np.ndarray:
  """1px ring around the filled silhouette (no interior features)."""
  alpha = (mask.astype(np.uint8) * 255)
  pad = np.pad(alpha, 1)
  eroded = np.zeros_like(alpha)
  h, w = alpha.shape
  for y in range(h):
    for x in range(w):
      eroded[y, x] = 255 if pad[y : y + 3, x : x + 3].min() == 255 else 0
  return (alpha > 0) & (eroded == 0)


def main() -> None:
  if not SRC.exists():
    raise SystemExit(f'Missing wireframe source: {SRC}')
  img = Image.open(SRC).convert('RGBA')
  arr = np.array(img)
  h, w = arr.shape[:2]

  yel = yellow_mask(arr)
  fill = white_fill(arr)

  # Full silhouette, then strip ears
  sil = fill | yel
  sil_img = Image.fromarray((sil.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(5))
  sil_img = sil_img.filter(ImageFilter.MinFilter(3))
  sil = np.array(sil_img) > 127
  sil = remove_ears(sil)

  # Outline = outer edge only (drops eyes, nose, mouth, ear inners)
  edge = silhouette_edge(sil)
  outline = np.zeros((h, w, 4), dtype=np.uint8)
  outline[edge] = [255, 214, 0, 255]
  out_img = Image.fromarray(outline).filter(ImageFilter.MaxFilter(3))
  oa = np.array(out_img)
  oa[oa[:, :, 3] > 20] = [255, 214, 0, 245]
  out_img = Image.fromarray(oa)

  # Hard RGBA alpha mask — outside the outline must be fully transparent when captured.
  mask_rgba = np.zeros((h, w, 4), dtype=np.uint8)
  mask_rgba[sil, 3] = 255
  mask_img = Image.fromarray(mask_rgba, 'RGBA')

  ys, xs = np.where(sil)
  if not len(ys):
    raise SystemExit('No head region found after ear removal')
  x0, x1 = int(xs.min()), int(xs.max())
  y0, y1 = int(ys.min()), int(ys.max())

  OUT.mkdir(parents=True, exist_ok=True)
  out_img.save(OUT / 'face-guide-outline.png')
  mask_img.save(OUT / 'face-guide-mask.png')
  img.save(OUT / 'wireframe-source.png')

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
    'notes': 'Outer head outline only — ears, eyes, and nose removed from wireframe',
  }
  (OUT / 'face-guide.json').write_text(json.dumps(meta, indent=2) + '\n')
  print(f'Wrote earless head outline → {OUT}')
  print(f'  edge px={int(edge.sum())} oval={meta["faceOval"]}')


if __name__ == '__main__':
  main()
