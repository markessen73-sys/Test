#!/usr/bin/env python3
"""Extract 30 hair-only styles onto 1024 transparent overlays.

Source: 254778899bf63ae536da91436c4294bb9d812192e3c6151553016268a92de65d.png
(5 cols × 6 rows, brown hair on black — no head).

Overlays are centred as a starting fit on blank-no-features.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT / '254778899bf63ae536da91436c4294bb9d812192e3c6151553016268a92de65d.png'
BLANK = ROOT / 'frontend/public/assets/build-face/blank-no-features.png'
OUT = ROOT / 'frontend/public/assets/build-face/hair'
CATALOG = ROOT / 'frontend/public/assets/build-face/catalog.json'

NAMES = [
  'Swept crown', 'Receding buzz', 'Buzz cut', 'Short spiky', 'Messy fringe',
  'High spikes', 'Wavy pompadour', 'Slick side-part', 'Large quiff', 'Shaggy',
  'Layered shag', 'Tight afro', 'Wavy mid', 'Smooth mid', 'Slicked back',
  'Top bun', 'Undercut slick', 'Classic side-part', 'Curly top', 'Textured spikes',
  'Side-swept fringe', 'Medium afro', 'Mullet', 'Wavy curtains', 'Short locs',
  'Large afro', 'Emo fringe', 'Punk spikes', 'Mohawk', 'High fade',
]
SLUGS = [
  '01-swept-crown', '02-receding-buzz', '03-buzz', '04-short-spiky', '05-messy-fringe',
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

# Detected content bands on the hair-only sheet (1536×1024).
COL_BOUNDS = [(62, 229), (347, 515), (625, 792), (923, 1094), (1226, 1393)]
ROW_BOUNDS = [(24, 120), (190, 286), (358, 508), (535, 630), (704, 806), (866, 962)]

# Default placement onto blank: centre hair mass on blank crown.
DST_CX = 500.0
DST_TOP = 95.0
# Rough starting scale so styles sit near head size; user fine-tunes in UI.
DEFAULT_SCALE = 4.35


def hair_alpha(rgb: np.ndarray) -> np.ndarray:
  """Soft alpha from luminance (black bg → transparent)."""
  lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
  # Ramp: fully clear below 18, full by ~45
  a = np.clip((lum - 18.0) / 27.0, 0.0, 1.0)
  alpha = (a * 255.0).astype(np.uint8)
  # Kill tiny speckles
  mask = alpha > 20
  solid = np.array(Image.fromarray((mask.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(3))) > 127
  solid = np.array(Image.fromarray((solid.astype(np.uint8) * 255)).filter(ImageFilter.MinFilter(3))) > 127
  alpha = np.where(solid, alpha, 0).astype(np.uint8)
  return alpha


def place_on_canvas(cell_rgb: np.ndarray, alpha: np.ndarray) -> Image.Image:
  """Scale cell so hair width ~ blank crown, pin top-centre near DST_TOP."""
  ys, xs = np.where(alpha > 20)
  if len(xs) == 0:
    return Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))

  x0, x1 = int(xs.min()), int(xs.max())
  y0, y1 = int(ys.min()), int(ys.max())
  crop_rgb = cell_rgb[y0:y1 + 1, x0:x1 + 1]
  crop_a = alpha[y0:y1 + 1, x0:x1 + 1]
  rgba = np.dstack([crop_rgb, crop_a])
  img = Image.fromarray(rgba, 'RGBA')

  src_w = x1 - x0 + 1
  scale = DEFAULT_SCALE
  # Slight per-style adjust: keep very tall styles from exploding
  src_h = y1 - y0 + 1
  if src_h * scale > 520:
    scale = 520 / src_h

  nw = max(1, int(round(src_w * scale)))
  nh = max(1, int(round(src_h * scale)))
  scaled = img.resize((nw, nh), Image.Resampling.LANCZOS)

  canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
  # Centre horizontally; pin top to DST_TOP
  px = int(round(DST_CX - nw / 2))
  py = int(round(DST_TOP))
  canvas.paste(scaled, (px, py), scaled)
  return canvas


def main() -> None:
  if not SHEET.exists():
    raise SystemExit(f'Missing sheet: {SHEET}')
  sheet = np.array(Image.open(SHEET).convert('RGB'))
  OUT.mkdir(parents=True, exist_ok=True)

  for p in OUT.glob('*.png'):
    p.unlink()

  catalog = []
  for i in range(30):
    ri, ci = divmod(i, 5)
    ya, yb = ROW_BOUNDS[ri]
    xa, xb = COL_BOUNDS[ci]
    cell = sheet[ya:yb + 1, xa:xb + 1].copy()
    alpha = hair_alpha(cell)
    place_on_canvas(cell, alpha).save(OUT / f'{SLUGS[i]}.png')
    catalog.append({
      'id': SLUGS[i],
      'name': NAMES[i],
      'file': f'assets/build-face/hair/{SLUGS[i]}.png',
    })
    arr = np.array(Image.open(OUT / f'{SLUGS[i]}.png'))
    ha = arr[:, :, 3] > 20
    if ha.any():
      ys, xs = np.where(ha)
      print(
        f'{i + 1:02d} {SLUGS[i]} cx={(xs.min() + xs.max()) / 2:.0f} '
        f'top={ys.min()} w={xs.max() - xs.min() + 1}'
      )
    else:
      print(f'{i + 1:02d} {SLUGS[i]} (empty)')

  CATALOG.write_text(json.dumps({
    'blank': 'assets/build-face/blank-no-features.png',
    'source': '254778899bf63ae536da91436c4294bb9d812192e3c6151553016268a92de65d.png',
    'hairColors': HAIR_COLORS,
    'hair': catalog,
  }, indent=2) + '\n')
  print(f'Wrote {len(catalog)} styles -> {OUT}')


if __name__ == '__main__':
  main()
