#!/usr/bin/env python3
"""Extract 9 ear-pair styles onto blank-aligned 1024 overlays.

Source: file_00000000c184820a8c0203d285a8c48c.png (3×3 ear pairs on black)
Also writes blank-no-ears.png (blank head with protruding ears removed).
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT / 'file_00000000c184820a8c0203d285a8c48c.png'
BLANK = ROOT / 'frontend/public/assets/build-face/blank-no-features.png'
OUT = ROOT / 'frontend/public/assets/build-face/ears'
CATALOG = ROOT / 'frontend/public/assets/build-face/catalog.json'
BLANK_NO_EARS = ROOT / 'frontend/public/assets/build-face/blank-no-ears.png'

NAMES = [
  'Standard', 'Small', 'Large',
  'Low set', 'High set', 'Pointed top',
  'Round', 'Prominent', 'Folded',
]
SLUGS = [
  '01-standard', '02-small', '03-large',
  '04-low-set', '05-high-set', '06-pointed-top',
  '07-round', '08-prominent', '09-folded',
]
# Cell crops: (y0,y1,x0,x1) for the 3×3 sheet
CELLS = [
  (9, 251, 70, 362), (9, 241, 513, 790), (10, 259, 936, 1245),
  (407, 665, 72, 360), (406, 605, 511, 789), (406, 647, 944, 1229),
  (801, 1039, 67, 362), (801, 1047, 495, 805), (801, 1046, 937, 1229),
]
# Per-style size / vertical tweaks relative to blank ear fit
TWEAKS = {
  '02-small': {'scale': 0.78, 'dy': 0},
  '03-large': {'scale': 1.32, 'dy': -8},
  '04-low-set': {'scale': 1.05, 'dy': 48},
  '05-high-set': {'scale': 1.05, 'dy': -44},
  '08-prominent': {'scale': 1.22, 'dy': 0},
  '09-folded': {'scale': 0.95, 'dy': 4},
}


def write_blank_no_ears(blank: np.ndarray) -> np.ndarray:
  """Remove protruding ears, leaving a smooth cheek silhouette."""
  ba = blank[:, :, 3] > 10
  out = blank.copy()
  cx = 512.0
  # Tighter cheek half-width through the ear band so stubs disappear.
  for y in range(270, 470):
    if not ba[y].any():
      continue
    # Head oval widens slightly toward the jaw.
    t = (y - 270) / (470 - 270)
    half = 248.0 + 18.0 * t
    xs = np.where(ba[y])[0]
    for x in xs:
      if x < cx - half or x > cx + half:
        out[y, x] = 0
  Image.fromarray(out).save(BLANK_NO_EARS)
  return out


def blank_ear_targets(blank_a: np.ndarray) -> dict:
  ba = blank_a > 10
  lefts, rights, rows = [], [], []
  for y in range(340, 415):
    xs = np.where(ba[y])[0]
    if len(xs) < 10:
      continue
    lefts.append(int(xs.min()))
    rights.append(int(xs.max()))
    rows.append(y)
  li = int(np.argmin(lefts))
  ri = int(np.argmax(rights))
  cheek_L = 500 - 519 / 2
  ear_top = None
  ear_bot = None
  for y in range(300, 450):
    xs = np.where(ba[y])[0]
    if not len(xs):
      continue
    if xs.min() < cheek_L - 8:
      if ear_top is None:
        ear_top = y
      ear_bot = y
  return {
    'left': float(lefts[li]),
    'right': float(rights[ri]),
    'y': float((rows[li] + rows[ri]) / 2),
    'top': int(ear_top or 340),
    'h': float((ear_bot or 420) - (ear_top or 340) + 1),
  }


def extract_ears(cell_rgb: np.ndarray) -> list[dict]:
  lum = cell_rgb.mean(2)
  bright = (cell_rgb[:, :, 0] > 180) & (cell_rgb[:, :, 1] > 180) & (cell_rgb[:, :, 2] > 180)
  mask = (lum > 40) & ~bright
  h, w = mask.shape
  visited = np.zeros_like(mask)
  comps: list[dict] = []
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
      if len(cells) >= 40:
        xs = [p[1] for p in cells]
        ys = [p[0] for p in cells]
        comps.append({
          'n': len(cells), 'x0': min(xs), 'x1': max(xs),
          'y0': min(ys), 'y1': max(ys), 'cells': cells,
        })
  comps.sort(key=lambda c: -c['n'])
  ears = comps[:2]
  ears.sort(key=lambda c: c['x0'])
  return ears


def ear_rgba(cell_rgb: np.ndarray, ear: dict) -> np.ndarray:
  y0, y1, x0, x1 = ear['y0'], ear['y1'], ear['x0'], ear['x1']
  pad = 2
  y0 = max(0, y0 - pad)
  x0 = max(0, x0 - pad)
  y1 = min(cell_rgb.shape[0] - 1, y1 + pad)
  x1 = min(cell_rgb.shape[1] - 1, x1 + pad)
  crop = cell_rgb[y0:y1 + 1, x0:x1 + 1].copy()
  alpha = np.zeros(crop.shape[:2], dtype=np.uint8)
  for cy, cx in ear['cells']:
    alpha[cy - y0, cx - x0] = 255
  alpha = np.array(Image.fromarray(alpha).filter(ImageFilter.MaxFilter(3)))
  lum = crop.mean(2)
  soft = np.clip((lum - 25) / 40, 0, 1)
  alpha = (alpha.astype(np.float32) / 255 * soft * 255).astype(np.uint8)
  return np.dstack([crop, alpha])


def main() -> None:
  if not SHEET.exists():
    raise SystemExit(f'Missing sheet: {SHEET}')
  sheet = np.array(Image.open(SHEET).convert('RGB'))
  blank = np.array(Image.open(BLANK).convert('RGBA'))
  write_blank_no_ears(blank)
  dst = blank_ear_targets(blank[:, :, 3])
  OUT.mkdir(parents=True, exist_ok=True)
  for p in OUT.glob('*.png'):
    p.unlink()

  catalog = []
  for i, (ya, yb, xa, xb) in enumerate(CELLS):
    cell = sheet[ya:yb + 1, xa:xb + 1].copy()
    ears = extract_ears(cell)
    canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    tw = TWEAKS.get(SLUGS[i], {'scale': 1.0, 'dy': 0})
    if len(ears) >= 2:
      for side, ear, tip in (('L', ears[0], dst['left']), ('R', ears[1], dst['right'])):
        rgba = ear_rgba(cell, ear)
        eh, ew = rgba.shape[0], rgba.shape[1]
        scale = (dst['h'] / max(eh, 1)) * 1.18 * float(tw['scale'])
        nw = max(1, int(round(ew * scale)))
        nh = max(1, int(round(eh * scale)))
        img = Image.fromarray(rgba, 'RGBA').resize((nw, nh), Image.Resampling.LANCZOS)
        py = int(round(dst['top'] - 4 + tw['dy']))
        px = int(round(tip if side == 'L' else tip - nw))
        canvas.paste(img, (px, py), img)
    path = OUT / f'{SLUGS[i]}.png'
    canvas.save(path)
    catalog.append({
      'id': SLUGS[i],
      'name': NAMES[i],
      'file': f'assets/build-face/ears/{SLUGS[i]}.png',
    })
    arr = np.array(canvas)
    ha = arr[:, :, 3] > 20
    if ha.any():
      ys, xs = np.where(ha)
      print(f'{i + 1:02d} {SLUGS[i]} top={ys.min()} w={xs.max() - xs.min() + 1}')
    else:
      print(f'{i + 1:02d} {SLUGS[i]} (empty)')

  cat: dict = {}
  if CATALOG.exists():
    cat = json.loads(CATALOG.read_text())
  cat['blank'] = 'assets/build-face/blank-no-features.png'
  cat['blankNoEars'] = 'assets/build-face/blank-no-ears.png'
  cat['ears'] = catalog
  cat['earsSource'] = SHEET.name
  CATALOG.write_text(json.dumps(cat, indent=2) + '\n')
  print(f'Wrote {len(catalog)} ear styles -> {OUT}')


if __name__ == '__main__':
  main()
