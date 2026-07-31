#!/usr/bin/env python3
"""Extract 30 hair styles from the catalogue sheet onto blank-aligned 1024 overlays.

Source: file_0000000030888246b8a0103e7ee2caf7.png (5 cols × 6 rows)
Output: frontend/public/assets/build-face/hair/*.png + catalog.json
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT / 'file_0000000030888246b8a0103e7ee2caf7.png'
BLANK = ROOT / 'frontend/public/assets/build-face/blank-no-features.png'
OUT = ROOT / 'frontend/public/assets/build-face/hair'
CATALOG = ROOT / 'frontend/public/assets/build-face/catalog.json'

NAMES = [
  'Bald', 'Receding buzz', 'Buzz cut', 'Short spiky', 'Messy fringe',
  'High spikes', 'Wavy pompadour', 'Slick side-part', 'Large quiff', 'Shaggy',
  'Layered shag', 'Tight afro', 'Wavy mid', 'Smooth mid', 'Slicked back',
  'Top bun', 'Undercut slick', 'Classic side-part', 'Curly top', 'Textured spikes',
  'Side-swept fringe', 'Medium afro', 'Mullet', 'Wavy curtains', 'Short locs',
  'Large afro', 'Emo fringe', 'Punk spikes', 'Mohawk', 'High fade',
]
SLUGS = [
  '01-bald', '02-receding-buzz', '03-buzz', '04-short-spiky', '05-messy-fringe',
  '06-high-spikes', '07-wavy-pompadour', '08-slick-side-part', '09-large-quiff', '10-shaggy',
  '11-layered-shag', '12-tight-afro', '13-wavy-mid', '14-smooth-mid', '15-slicked-back',
  '16-top-bun', '17-undercut-slick', '18-classic-side-part', '19-curly-top', '20-textured-spikes',
  '21-side-swept-fringe', '22-medium-afro', '23-mullet', '24-wavy-curtains', '25-short-locs',
  '26-large-afro', '27-emo-fringe', '28-punk-spikes', '29-mohawk', '30-high-fade',
]
HAIR_COLORS = [
  {'id': 'light-blonde', 'name': 'Light blonde', 'hex': '#E8D59A'},
  {'id': 'blonde', 'name': 'Blonde', 'hex': '#C6A45A'},
  {'id': 'light-brown', 'name': 'Light brown', 'hex': '#8B5E3C'},
  {'id': 'brown', 'name': 'Brown', 'hex': '#5C3A24'},
  {'id': 'dark-brown', 'name': 'Dark brown', 'hex': '#2A1C16'},
  {'id': 'black', 'name': 'Black', 'hex': '#121014'},
  {'id': 'grey', 'name': 'Grey', 'hex': '#8A8680'},
  {'id': 'auburn', 'name': 'Auburn', 'hex': '#7A2F1A'},
]
COL_BOUNDS = [(16, 200), (242, 426), (470, 654), (703, 892), (930, 1122)]
ROW_BOUNDS = [(18, 235), (253, 467), (493, 696), (707, 931), (952, 1158), (1177, 1368)]


def dilate(mask: np.ndarray, k: int = 3) -> np.ndarray:
  return np.array(Image.fromarray((mask.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(k))) > 127


def erode(mask: np.ndarray, k: int = 3) -> np.ndarray:
  return np.array(Image.fromarray((mask.astype(np.uint8) * 255)).filter(ImageFilter.MinFilter(k))) > 127


def skin_mask(rgb: np.ndarray) -> np.ndarray:
  r, g, b = rgb[:, :, 0].astype(np.int16), rgb[:, :, 1].astype(np.int16), rgb[:, :, 2].astype(np.int16)
  return (r > 145) & (g > 95) & (b > 60) & (r > g) & ((r - b) > 25) & (g > b - 15)


def label_mask(rgb: np.ndarray) -> np.ndarray:
  h, w = rgb.shape[:2]
  yy, xx = np.ogrid[:h, :w]
  r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
  bright = (r > 160) & (g > 160) & (b > 160)
  corner = (yy < h * 0.22) & (xx < w * 0.22)
  return corner & bright


def wipe_label(rgb: np.ndarray) -> np.ndarray:
  out = rgb.copy()
  h, w = out.shape[:2]
  out[: int(h * 0.18), : int(w * 0.18)] = 0
  out[label_mask(out)] = 0
  return out


def keep_components(mask: np.ndarray, min_size: int = 8) -> np.ndarray:
  h, w = mask.shape
  visited = np.zeros_like(mask, dtype=bool)
  out = np.zeros_like(mask, dtype=bool)
  for y in range(h):
    for x in np.where(mask[y] & ~visited[y])[0]:
      if visited[y, x]:
        continue
      stack = [(int(y), int(x))]
      visited[y, x] = True
      cells: list[tuple[int, int]] = []
      while stack:
        cy, cx = stack.pop()
        cells.append((cy, cx))
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
          if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not visited[ny, nx]:
            visited[ny, nx] = True
            stack.append((ny, nx))
      ys = [p[0] for p in cells]
      if len(cells) >= min_size or (min(ys) < h * 0.4 and len(cells) >= 4):
        for cy, cx in cells:
          out[cy, cx] = True
  return out


def blank_head_landmarks(blank_a: np.ndarray) -> dict:
  sil = blank_a > 10
  head = sil.copy()
  head[820:, :] = False
  widths = np.array([
    int(np.where(head[y])[0].max() - np.where(head[y])[0].min() + 1) if head[y].any() else 0
    for y in range(1024)
  ])
  face_rows = np.where((widths > 420) & (widths < 640) & (np.arange(1024) < 780))[0]
  y0 = int(np.where(widths > 20)[0][0])
  y1 = int(face_rows.max()) if len(face_rows) else 800
  row = np.where(head[350])[0]
  x0, x1 = int(row.min()), int(row.max())
  return {
    'cx': (x0 + x1) / 2, 'cy': (y0 + y1) / 2,
    'x0': x0, 'x1': x1, 'y0': y0, 'y1': y1,
    'w': x1 - x0 + 1, 'h': y1 - y0 + 1,
  }


def hair_mask(rgb: np.ndarray) -> np.ndarray:
  r = rgb[:, :, 0].astype(np.int16)
  g = rgb[:, :, 1].astype(np.int16)
  b = rgb[:, :, 2].astype(np.int16)
  lum = 0.299 * r + 0.587 * g + 0.114 * b
  h, w = rgb.shape[:2]
  yy, xx = np.ogrid[:h, :w]
  bg = lum < 18
  skin = skin_mask(rgb)
  labels = label_mask(rgb)
  eyes = (r > 200) & (g > 200) & (b > 200) & ~labels
  hair_color = (
    (lum >= 22) & (lum <= 140)
    & (r < 155) & (g < 125) & (b < 115)
    & (r >= g - 6) & (g >= b - 20) & ((r - b) < 90)
  )
  cand = hair_color & ~bg & ~skin & ~eyes & ~labels
  cand[: int(h * 0.18), : int(w * 0.18)] = False

  if skin.any():
    sy, sx = np.where(skin)
    y0, y1 = int(sy.min()), int(sy.max())
    x0, x1 = int(sx.min()), int(sx.max())
  else:
    y0, y1, x0, x1 = 0, h - 1, 0, w - 1

  content = lum > 22
  crown_top = int(np.where(content.any(1))[0][0]) if content.any() else y0
  brow = crown_top + int((y1 - crown_top) * 0.38)
  cx = (x0 + x1) / 2
  cy = (brow + y1) / 2
  rx = (x1 - x0) * 0.30
  ry = (y1 - brow) * 0.50
  face = ((xx - cx) / max(rx, 1)) ** 2 + ((yy - cy) / max(ry, 1)) ** 2 <= 1
  face &= yy > brow
  near_eye = dilate(eyes, 7)
  cand &= ~(near_eye & hair_color & (yy > brow))
  cand &= ~face
  cand &= yy <= crown_top + int((y1 - crown_top) * 0.95)

  solid = dilate(cand, 3)
  solid = dilate(solid, 3)
  solid = erode(solid, 3)
  solid = erode(solid, 3)
  solid = dilate(solid, 3)
  solid = keep_components(solid, 10)
  solid &= ~face
  solid &= ~skin
  solid[: int(h * 0.18), : int(w * 0.18)] = False
  return solid


def warp_to_blank(cell_rgb: np.ndarray, mask: np.ndarray, src_lm: dict, dst_lm: dict) -> Image.Image:
  sx = dst_lm['w'] / max(src_lm['w'], 1)
  sy = dst_lm['h'] / max(src_lm['h'], 1)
  scale = sx * 0.85 + sy * 0.15
  src_cx = (src_lm['x0'] + src_lm['x1']) / 2
  src_top = src_lm['y0']
  dst_cx = (dst_lm['x0'] + dst_lm['x1']) / 2
  dst_top = dst_lm['y0'] - 4
  h, w = cell_rgb.shape[:2]
  rgba = np.zeros((h, w, 4), dtype=np.uint8)
  rgba[mask, :3] = cell_rgb[mask]
  rgba[mask, 3] = 255
  if mask.any():
    mean_c = cell_rgb[mask].mean(0)
    lum = cell_rgb.mean(2)
    fill = mask & (lum < 20)
    if fill.any():
      rgba[fill, 0] = int(mean_c[0])
      rgba[fill, 1] = int(mean_c[1])
      rgba[fill, 2] = int(mean_c[2])
      rgba[fill, 3] = 220
  img = Image.fromarray(rgba, 'RGBA')
  tx = dst_cx - scale * src_cx
  ty = dst_top - scale * src_top
  a = 1 / scale
  e = -tx / scale
  d = 1 / scale
  f = -ty / scale
  return img.transform(
    (1024, 1024),
    Image.Transform.AFFINE,
    (a, 0, e, 0, d, f),
    resample=Image.Resampling.BILINEAR,
  )


def main() -> None:
  if not SHEET.exists():
    raise SystemExit(f'Missing sheet: {SHEET}')
  sheet = np.array(Image.open(SHEET).convert('RGB'))
  blank = np.array(Image.open(BLANK).convert('RGBA'))
  OUT.mkdir(parents=True, exist_ok=True)

  def get_cell(i: int) -> np.ndarray:
    ri, ci = divmod(i, 5)
    ya, yb = ROW_BOUNDS[ri]
    xa, xb = COL_BOUNDS[ci]
    return sheet[ya:yb + 1, xa:xb + 1].copy()

  bald = wipe_label(get_cell(0))
  skin = skin_mask(bald)
  sy, sx = np.where(skin)
  shared_lm = {
    'cx': (sx.min() + sx.max()) / 2,
    'cy': (sy.min() + sy.max()) / 2,
    'x0': int(sx.min()),
    'x1': int(sx.max()),
    'y0': int(sy.min()),
    'y1': int(sy.min() + int((sy.max() - sy.min()) * 0.78)),
    'w': int(sx.max() - sx.min() + 1),
    'h': int((sy.max() - sy.min()) * 0.78) + 1,
  }
  dst_lm = blank_head_landmarks(blank[:, :, 3])

  for p in OUT.glob('*.png'):
    p.unlink()

  catalog = []
  for i in range(30):
    cell = wipe_label(get_cell(i))
    lm = dict(shared_lm)
    content = cell.mean(2) > 22
    if content.any():
      top = int(np.where(content.any(1))[0][0])
      lm['y0'] = min(lm['y0'], top)
      lm['h'] = lm['y1'] - lm['y0'] + 1
    mask = np.zeros(cell.shape[:2], dtype=bool) if i == 0 else hair_mask(cell)
    overlay = warp_to_blank(cell, mask, lm, dst_lm)
    arr = np.array(overlay)
    r, g, b, al = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    leak = (al > 0) & (r > 145) & (g > 100) & (b > 70) & (r.astype(int) - b.astype(int) > 25)
    arr[leak, 3] = 0
    yy, xx = np.ogrid[:1024, :1024]
    face = ((xx - 512) / 190) ** 2 + ((yy - 540) / 210) ** 2 <= 1
    arr[(arr[:, :, 3] > 0) & face & (yy > 400), 3] = 0
    arr[(arr[:, :, 3] > 0) & (yy > 780), 3] = 0
    Image.fromarray(arr).save(OUT / f'{SLUGS[i]}.png')
    catalog.append({
      'id': SLUGS[i],
      'name': NAMES[i],
      'file': f'assets/build-face/hair/{SLUGS[i]}.png',
    })
    print(f'{i + 1:02d} {SLUGS[i]}')

  CATALOG.write_text(json.dumps({
    'blank': 'assets/build-face/blank-no-features.png',
    'hairColors': HAIR_COLORS,
    'hair': catalog,
  }, indent=2) + '\n')
  print(f'Wrote {len(catalog)} styles -> {OUT}')


if __name__ == '__main__':
  main()
