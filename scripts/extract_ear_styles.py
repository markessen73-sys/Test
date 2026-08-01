#!/usr/bin/env python3
"""Extract 9 ear-pair styles onto blank-aligned 1024 overlays.

Source: file_00000000c184820a8c0203d285a8c48c.png (3×3 ear pairs on black)

Placement is locked to the ears already drawn on blank-no-features.png:
detect each template ear's tip / attach / top / bottom, remove those ears
to make blank-no-ears.png, then fit every sheet style into that footprint.
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
# Relative tweaks vs the template ear footprint
TWEAKS = {
  '01-standard': {'scale': 1.0, 'dy': 0},
  '02-small': {'scale': 0.82, 'dy': 4},
  '03-large': {'scale': 1.22, 'dy': -4},
  '04-low-set': {'scale': 1.0, 'dy': 38},
  '05-high-set': {'scale': 1.0, 'dy': -32},
  '06-pointed-top': {'scale': 1.05, 'dy': -6},
  '07-round': {'scale': 1.0, 'dy': 0},
  '08-prominent': {'scale': 1.15, 'dy': 0},
  '09-folded': {'scale': 0.92, 'dy': 4},
}
# Fit to template box, then enlarge (feedback: too small) and drop (too high).
# Non-uniform: sheet ears are much taller than the template lobes.
# Vertical placement uses target cy + BASE_DY (not tip-y) so growth doesn't
# shove the tops upward when we enlarge.
BASE_SCALE_W = 2.35
BASE_SCALE_H = 2.10
BASE_DY = 105


def _clusters(xs: np.ndarray, gap: int = 3) -> list[tuple[int, int]]:
  if not len(xs):
    return []
  xs = np.sort(xs.astype(int))
  groups: list[list[int]] = [[int(xs[0])]]
  for x in xs[1:]:
    x = int(x)
    if x <= groups[-1][-1] + gap:
      groups[-1].append(x)
    else:
      groups.append([x])
  return [(g[0], g[-1]) for g in groups if g[-1] - g[0] + 1 >= 2]


def detect_template_ears(blank: np.ndarray) -> dict:
  """Measure L/R ear footprints from the template's own ear outlines."""
  a = blank[:, :, 3] > 10
  lum = blank[:, :, :3].mean(2)
  outline = a & (lum < 55)

  left_rows: list[tuple[int, int, int]] = []
  right_rows: list[tuple[int, int, int]] = []
  for y in range(400, 520):
    cs = _clusters(np.where(outline[y, :350])[0])
    if len(cs) >= 2:
      tip, attach = cs[0][0], cs[-1][0]
      if attach - tip >= 25:
        left_rows.append((y, tip, attach))
    cs = _clusters(np.where(outline[y, 674:])[0] + 674)
    if len(cs) >= 2:
      attach, tip = cs[0][1], cs[-1][1]
      if tip - attach >= 25:
        right_rows.append((y, attach, tip))

  if not left_rows or not right_rows:
    raise SystemExit('Could not detect template ears from blank-no-features.png')

  # Ignore shoulder flare at the very bottom
  left_rows = [r for r in left_rows if r[0] <= 505]
  right_rows = [r for r in right_rows if r[0] <= 505]

  def pack(rows: list[tuple[int, int, int]], side: str) -> dict:
    top, bot = rows[0][0], rows[-1][0]
    if side == 'L':
      tip = int(min(r[1] for r in rows))
      attach = int(np.median([r[2] for r in rows[: max(1, len(rows) // 3)]]))
      return {
        'side': 'L',
        'tip': tip,
        'attach': attach,
        'top': int(top),
        'bot': int(bot),
        'w': int(attach - tip),
        'h': int(bot - top + 1),
        'cx': float((tip + attach) / 2),
        'cy': float((top + bot) / 2),
      }
    tip = int(max(r[2] for r in rows))
    attach = int(np.median([r[1] for r in rows[: max(1, len(rows) // 3)]]))
    return {
      'side': 'R',
      'tip': tip,
      'attach': attach,
      'top': int(top),
      'bot': int(bot),
      'w': int(tip - attach),
      'h': int(bot - top + 1),
      'cx': float((tip + attach) / 2),
      'cy': float((top + bot) / 2),
    }

  L = pack(left_rows, 'L')
  R = pack(right_rows, 'R')
  # Unify height/vertical span to the larger ear so the pair matches
  top = min(L['top'], R['top'])
  bot = max(L['bot'], R['bot'])
  h = bot - top + 1
  w = max(L['w'], R['w'])
  L.update({'top': top, 'bot': bot, 'h': h, 'w': w, 'cy': (top + bot) / 2, 'attach': L['tip'] + w})
  R.update({'top': top, 'bot': bot, 'h': h, 'w': w, 'cy': (top + bot) / 2, 'attach': R['tip'] - w})
  print(f"Template L ear tip={L['tip']} attach={L['attach']} y={L['top']}-{L['bot']} w={L['w']} h={L['h']}")
  print(f"Template R ear tip={R['tip']} attach={R['attach']} y={R['top']}-{R['bot']} w={R['w']} h={R['h']}")
  return {'L': L, 'R': R}


def write_blank_no_ears(blank: np.ndarray, ears: dict) -> np.ndarray:
  """Remove protruding template ears so selected overlays replace them."""
  out = blank.copy()
  a = blank[:, :, 3] > 10
  lum = blank[:, :, :3].mean(2)
  outline = a & (lum < 55)

  for y in range(max(0, ears['L']['top'] - 8), min(1024, ears['L']['bot'] + 8)):
    # Left
    cs = _clusters(np.where(outline[y, :350])[0])
    if len(cs) >= 2:
      tip, attach = cs[0][0], cs[-1][0]
      if attach - tip >= 20:
        out[y, tip:attach + 1] = 0
    # Right
    cs = _clusters(np.where(outline[y, 674:])[0] + 674)
    if len(cs) >= 2:
      attach, tip = cs[0][1], cs[-1][1]
      if tip - attach >= 20:
        out[y, attach:tip + 1] = 0

  Image.fromarray(out).save(BLANK_NO_EARS)
  return out


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


def place_ear(canvas: Image.Image, rgba: np.ndarray, target: dict, tw: dict) -> None:
  """Fit one sheet ear onto the template ear box — larger and a bit lower."""
  ys0, xs0 = np.where(rgba[:, :, 3] > 20)
  if not len(ys0):
    return
  rgba = rgba[ys0.min():ys0.max() + 1, xs0.min():xs0.max() + 1]

  s = float(tw['scale'])
  nw = max(1, int(round(target['w'] * BASE_SCALE_W * s)))
  nh = max(1, int(round(target['h'] * BASE_SCALE_H * s)))
  img = Image.fromarray(rgba, 'RGBA').resize((nw, nh), Image.Resampling.LANCZOS)
  arr = np.array(img)
  ys, xs = np.where(arr[:, :, 3] > 20)
  if not len(ys):
    return
  content_h = int(ys.max() - ys.min() + 1)
  content_w = int(xs.max() - xs.min() + 1)
  cy = target['cy'] + BASE_DY + float(tw['dy'])
  # Outer tip stays on the template tip; extra width grows over the cheek.
  if target['side'] == 'L':
    px = int(round(target['tip'] - xs.min()))
  else:
    px = int(round(target['tip'] - xs.max()))
  py = int(round(cy - content_h / 2.0 - ys.min()))
  canvas.paste(img, (px, py), img)


def main() -> None:
  if not SHEET.exists():
    raise SystemExit(f'Missing sheet: {SHEET}')
  sheet = np.array(Image.open(SHEET).convert('RGB'))
  blank = np.array(Image.open(BLANK).convert('RGBA'))
  targets = detect_template_ears(blank)
  write_blank_no_ears(blank, targets)
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
      place_ear(canvas, ear_rgba(cell, ears[0]), targets['L'], tw)
      place_ear(canvas, ear_rgba(cell, ears[1]), targets['R'], tw)
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
      print(f'{i + 1:02d} {SLUGS[i]} bbox x={xs.min()}-{xs.max()} y={ys.min()}-{ys.max()}')
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
