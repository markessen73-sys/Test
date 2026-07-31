#!/usr/bin/env python3
"""Extract 30 hair styles from the catalogue sheet onto blank-aligned 1024 overlays.

Source: file_0000000030888246b8a0103e7ee2caf7.png (5 cols × 6 rows)
Output: frontend/public/assets/build-face/hair/*.png + catalog.json

Placement is driven by ear-outline span on the bald sheet cell vs the blank head
ears (scale + horizontal centre). Vertical placement locks the sheet crown to the
blank crown so scalp is covered; ear outlines themselves are banned from hair.
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

# Soft crown seal after warp (blank-space coords).
CROWN_FILL_Y0 = 120
CROWN_FILL_Y1 = 280
CROWN_FILL_X0 = 340
CROWN_FILL_X1 = 680


def dilate(mask: np.ndarray, k: int = 3) -> np.ndarray:
  return np.array(Image.fromarray((mask.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(k))) > 127


def erode(mask: np.ndarray, k: int = 3) -> np.ndarray:
  return np.array(Image.fromarray((mask.astype(np.uint8) * 255)).filter(ImageFilter.MinFilter(k))) > 127


def skin_mask(rgb: np.ndarray) -> np.ndarray:
  r, g, b = rgb[:, :, 0].astype(np.int16), rgb[:, :, 1].astype(np.int16), rgb[:, :, 2].astype(np.int16)
  return (r > 145) & (g > 95) & (b > 60) & (r > g) & ((r - b) > 25) & (g > b - 15)


def outline_mask(rgb: np.ndarray) -> np.ndarray:
  """Black ink strokes (head/ear outlines), not filled dark hair."""
  r, g, b = rgb[:, :, 0].astype(np.int16), rgb[:, :, 1].astype(np.int16), rgb[:, :, 2].astype(np.int16)
  lum = 0.299 * r + 0.587 * g + 0.114 * b
  dark = (lum > 5) & (lum < 48) & (r < 70) & (g < 65) & (b < 65)
  # Prefer thin strokes: dark pixels with fewer dark neighbours than a fill.
  dark_u8 = (dark.astype(np.uint8) * 255)
  neigh = np.array(Image.fromarray(dark_u8).filter(ImageFilter.BoxBlur(1)))
  # BoxBlur returns ~local density; strokes stay lower than solid fills.
  thin = dark & (neigh < 140)
  return dilate(thin, 3)


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


def ear_span(sil: np.ndarray, y0: int, y1: int) -> tuple[float, float, float, float]:
  """Return left, right, cx, ear_y from silhouette extremes in [y0, y1]."""
  lefts: list[int] = []
  rights: list[int] = []
  rows: list[int] = []
  for y in range(y0, y1 + 1):
    xs = np.where(sil[y])[0]
    if len(xs) < 5:
      continue
    lefts.append(int(xs.min()))
    rights.append(int(xs.max()))
    rows.append(y)
  if not lefts:
    raise RuntimeError('No ear-span rows found')
  lefts_a = np.array(lefts)
  rights_a = np.array(rights)
  rows_a = np.array(rows)
  n = max(1, len(lefts_a) // 10)
  li = np.argsort(lefts_a)[:n]
  ri = np.argsort(-rights_a)[:n]
  left = float(lefts_a[li].mean())
  right = float(rights_a[ri].mean())
  ear_y = float(np.concatenate([rows_a[li], rows_a[ri]]).mean())
  return left, right, (left + right) / 2, ear_y


def sheet_ear_landmarks(bald_rgb: np.ndarray) -> dict:
  skin = skin_mask(bald_rgb)
  outline = outline_mask(bald_rgb)
  sil = dilate(skin | outline, 3)
  sil = erode(sil, 3)
  h, w = sil.shape
  sil[: int(h * 0.12), : int(w * 0.22)] = False
  ys = np.where(sil.any(1))[0]
  ytop, ybot = int(ys[0]), int(ys[-1])
  band0 = ytop + int((ybot - ytop) * 0.28)
  band1 = ytop + int((ybot - ytop) * 0.62)
  left, right, cx, ear_y = ear_span(sil, band0, band1)
  # Crown = top of skin oval (ignore label wipe).
  skin_ys = np.where(skin.any(1))[0]
  crown = int(skin_ys[0]) if len(skin_ys) else ytop
  # Ban ear lobes + face/ear outline strokes only — never the scalp skin fill
  # (hair sits on the scalp and would be erased).
  h, w = bald_rgb.shape[:2]
  yy, xx = np.ogrid[:h, :w]
  ear_lobes = (
    ((xx <= left + 16) | (xx >= right - 16))
    & (yy >= ear_y - 40) & (yy <= ear_y + 50)
    & (skin | outline)
  )
  face_outline = outline & (yy > crown + int(h * 0.10))
  ban = dilate(ear_lobes | face_outline, 3)
  return {
    'left': left, 'right': right, 'cx': cx, 'ear_y': ear_y,
    'w': right - left + 1, 'crown': float(crown),
    'ban': ban,
  }


def blank_ear_landmarks(blank_a: np.ndarray) -> dict:
  sil = blank_a > 10
  # Ear tips are most extreme around mid-ear (avoid jaw flare below ~410).
  left, right, cx, ear_y = ear_span(sil, 350, 405)
  top = int(np.where(sil.any(1))[0][0])
  return {
    'left': left, 'right': right, 'cx': cx, 'ear_y': ear_y,
    'w': right - left + 1, 'crown': float(top),
  }


def hair_mask(rgb: np.ndarray, ban: np.ndarray | None = None) -> np.ndarray:
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
    (lum >= 18) & (lum <= 155)
    & (r < 170) & (g < 140) & (b < 130)
    & (r >= g - 10) & (g >= b - 25) & ((r - b) < 100)
  )
  cand = hair_color & ~bg & ~skin & ~eyes & ~labels
  cand[: int(h * 0.18), : int(w * 0.18)] = False

  if ban is not None and ban.shape == cand.shape:
    cand &= ~ban

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

  # Drop thin black ink strokes (not filled dark hair).
  strokes = outline_mask(rgb)
  cand &= ~strokes

  solid = dilate(cand, 3)
  solid = dilate(solid, 3)
  solid = erode(solid, 3)
  solid = erode(solid, 3)
  solid = dilate(solid, 3)
  solid = keep_components(solid, 10)
  solid &= ~face
  solid &= ~skin
  if ban is not None and ban.shape == solid.shape:
    solid &= ~ban
  solid &= ~strokes
  solid[: int(h * 0.18), : int(w * 0.18)] = False
  return solid


def warp_rgba(rgba: np.ndarray, scale: float, tx: float, ty: float) -> np.ndarray:
  a = 1 / scale
  e = -tx / scale
  d = 1 / scale
  f = -ty / scale
  img = Image.fromarray(rgba, 'RGBA')
  return np.array(img.transform(
    (1024, 1024),
    Image.Transform.AFFINE,
    (a, 0, e, 0, d, f),
    resample=Image.Resampling.BILINEAR,
  ))


def warp_mask(mask: np.ndarray, scale: float, tx: float, ty: float) -> np.ndarray:
  a = 1 / scale
  e = -tx / scale
  d = 1 / scale
  f = -ty / scale
  img = Image.fromarray((mask.astype(np.uint8) * 255))
  return np.array(img.transform(
    (1024, 1024),
    Image.Transform.AFFINE,
    (a, 0, e, 0, d, f),
    resample=Image.Resampling.NEAREST,
  )) > 127


def seal_crown_gaps(arr: np.ndarray, blank_a: np.ndarray) -> np.ndarray:
  al = arr[:, :, 3]
  hair = al > 20
  if not hair.any():
    return arr
  mean_c = arr[hair, :3].mean(0)
  yy, xx = np.ogrid[:1024, :1024]
  crown = (
    (yy >= CROWN_FILL_Y0) & (yy <= CROWN_FILL_Y1)
    & (xx >= CROWN_FILL_X0) & (xx <= CROWN_FILL_X1)
    & (blank_a > 10)
  )
  grown = dilate(hair, 5)
  grown = dilate(grown, 5)
  holes = crown & grown & ~hair
  if holes.any():
    arr[holes, 0] = int(mean_c[0])
    arr[holes, 1] = int(mean_c[1])
    arr[holes, 2] = int(mean_c[2])
    arr[holes, 3] = 255
  sparse = crown & hair & (al < 200)
  if sparse.any():
    arr[sparse, 3] = np.maximum(arr[sparse, 3], 230)
  return arr


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
  src = sheet_ear_landmarks(bald)
  dst = blank_ear_landmarks(blank[:, :, 3])

  # Scale from ear-outline span; centre horizontally on blank ears.
  # Vertical: lock sheet crown to blank crown (hair covers scalp; ears only set size).
  scale = dst['w'] / src['w']
  src_cx = src['cx']
  src_crown = src['crown']
  dst_cx = dst['cx']
  dst_crown = dst['crown'] - 6.0  # hair sits just above silhouette top
  tx = dst_cx - scale * src_cx
  ty = dst_crown - scale * src_crown
  print(
    f'ear-align scale={scale:.4f} src_w={src["w"]:.1f} dst_w={dst["w"]:.1f} '
    f'cx {src_cx:.1f}->{dst_cx:.1f} crown {src_crown:.1f}->{dst_crown:.1f}'
  )

  bald_ban = src['ban']

  for p in OUT.glob('*.png'):
    p.unlink()

  catalog = []
  for i in range(30):
    cell = wipe_label(get_cell(i))
    # Only ban bald-cell ear/face strokes (shared head geometry). Do NOT
    # rebuild outline bans from each hair cell — dark hair reads as outline.
    if cell.shape[:2] != bald_ban.shape:
      ban = np.array(
        Image.fromarray((bald_ban.astype(np.uint8) * 255)).resize(
          (cell.shape[1], cell.shape[0]), Image.Resampling.NEAREST
        )
      ) > 127
    else:
      ban = bald_ban

    mask = np.zeros(cell.shape[:2], dtype=bool) if i == 0 else hair_mask(cell, ban)
    rgba = np.zeros((*cell.shape[:2], 4), dtype=np.uint8)
    rgba[mask, :3] = cell[mask]
    rgba[mask, 3] = 255
    if mask.any():
      mean_c = cell[mask].mean(0)
      lum = cell.mean(2)
      fill = mask & (lum < 20)
      if fill.any():
        rgba[fill, 0] = int(mean_c[0])
        rgba[fill, 1] = int(mean_c[1])
        rgba[fill, 2] = int(mean_c[2])
        rgba[fill, 3] = 220

    arr = warp_rgba(rgba, scale, tx, ty)
    r, g, b, al = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    leak = (al > 0) & (r > 145) & (g > 100) & (b > 70) & (r.astype(int) - b.astype(int) > 25)
    arr[leak, 3] = 0
    yy, xx = np.ogrid[:1024, :1024]
    face = ((xx - 512) / 190) ** 2 + ((yy - 540) / 210) ** 2 <= 1
    arr[(arr[:, :, 3] > 0) & face & (yy > 400), 3] = 0
    arr[(arr[:, :, 3] > 0) & (yy > 780), 3] = 0

    # Strip any warped head/ear outline remnants (dark thin strokes).
    ban_w = warp_mask(ban, scale, tx, ty)
    dark = (arr[:, :, 3] > 0) & ((r.astype(int) + g + b) < 110)
    arr[ban_w & dark, 3] = 0
    # Clear leftover outline-like pixels near blank ear discs.
    ear_discs = (
      (((xx - dst['left']) / 55) ** 2 + ((yy - dst['ear_y']) / 70) ** 2 <= 1)
      | (((xx - dst['right']) / 55) ** 2 + ((yy - dst['ear_y']) / 70) ** 2 <= 1)
    )
    arr[(arr[:, :, 3] > 0) & ear_discs & dark, 3] = 0

    if i > 0:
      arr = seal_crown_gaps(arr, blank[:, :, 3])

    Image.fromarray(arr).save(OUT / f'{SLUGS[i]}.png')
    catalog.append({
      'id': SLUGS[i],
      'name': NAMES[i],
      'file': f'assets/build-face/hair/{SLUGS[i]}.png',
    })
    ha = arr[:, :, 3] > 10
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
    'hairColors': HAIR_COLORS,
    'hair': catalog,
  }, indent=2) + '\n')
  print(f'Wrote {len(catalog)} styles -> {OUT}')


if __name__ == '__main__':
  main()
