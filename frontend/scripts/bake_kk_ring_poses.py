#!/usr/bin/env python3
"""Pack user-authored KK full-body refs into ring textures.

Sources (repo root / GitHub uploads):
  normal    → file_00000000322c81f98a23b73c6aa64925.png
  ooh       → file_0000000023b881f49b2d3a0207a78437.png
  knockout  → file_000000003e488246989ecf6b199a81ca.png

Outputs:
  public/boxer/bodies/kk-{idle,ooh,knockout}.png (+ thumbs)
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = Path(__file__).resolve().parents[1] / 'public'
OUT_DIR = PUBLIC / 'boxer/bodies'

TARGET_W, TARGET_H = 1024, 1536
FEET_SOLE_FRAC = 0.0664
TOP_PAD = 40

REFS = {
    'idle': ROOT / 'file_00000000322c81f98a23b73c6aa64925.png',
    'ooh': ROOT / 'file_0000000023b881f49b2d3a0207a78437.png',
    'knockout': ROOT / 'file_000000003e488246989ecf6b199a81ca.png',
}


def remove_bg(im: Image.Image) -> Image.Image:
    a = np.array(im.convert('RGBA'))
    h, w = a.shape[:2]
    rgb = a[:, :, :3].astype(np.int16)
    edge = np.zeros((h, w), bool)
    edge[0, :] = edge[-1, :] = edge[:, 0] = edge[:, -1] = True
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    is_dark_bg = mx < 28
    is_light_bg = (mx > 140) & ((mx - mn) < 35)
    is_clear = a[:, :, 3] < 8
    seed = edge & (is_dark_bg | is_light_bg | is_clear)
    growable = is_dark_bg | is_light_bg | is_clear
    for y, x in [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]:
        c = rgb[y, x]
        dist = np.abs(rgb - c).sum(axis=2)
        thresh = 40 if mx[y, x] < 40 else 50
        growable |= dist <= thresh
    labeled, n = ndimage.label(growable)
    keep = np.zeros(n + 1, bool)
    for lab in np.unique(labeled[seed]):
        if lab:
            keep[lab] = True
    bg = keep[labeled]
    out = a.copy()
    out[bg, 3] = 0
    return Image.fromarray(out)


def fill_interior_holes(im: Image.Image) -> Image.Image:
    a = np.array(im)
    al = a[:, :, 3]
    solid = al > 40
    filled = ndimage.binary_fill_holes(ndimage.binary_closing(solid, iterations=1))
    holes = filled & ~(al > 40)
    if holes.any():
        donor = al > 180
        if donor.sum() < 50:
            donor = al > 40
        _, (iy, ix) = ndimage.distance_transform_edt(~donor, return_indices=True)
        a[holes] = a[iy, ix][holes]
        a[holes, 3] = 255
    a[filled, 3] = 255
    a[~filled, 3] = 0
    lab, n = ndimage.label(a[:, :, 3] > 40)
    if n > 1:
        sizes = ndimage.sum(a[:, :, 3] > 40, lab, range(1, n + 1))
        for i, s in enumerate(sizes, start=1):
            if s < 200:
                a[lab == i, 3] = 0
    return Image.fromarray(a)


def pack(im: Image.Image) -> Image.Image:
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 40)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    crop = Image.fromarray(a).crop((x0, y0, x1 + 1, y1 + 1))
    fw, fh = crop.size
    sole_y = int(TARGET_H * (1 - FEET_SOLE_FRAC)) - 1
    avail_h = sole_y - TOP_PAD
    avail_w = TARGET_W - 56
    scale = min(avail_w / fw, avail_h / fh)
    nw, nh = max(1, int(round(fw * scale))), max(1, int(round(fh * scale)))
    scaled = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (TARGET_W, TARGET_H), (0, 0, 0, 0))
    paste_x = (TARGET_W - nw) // 2
    paste_y = sole_y - nh + 1
    canvas.paste(scaled, (paste_x, paste_y), scaled)
    return canvas


def main() -> None:
    for pose, path in REFS.items():
        src = path
        if not src.exists():
            # Fall back to copies under public
            alt = OUT_DIR / 'kk-source-refs' / f'{pose}.png'
            if not alt.exists():
                raise SystemExit(f'missing source for {pose}: {src}')
            src = alt
        keyed = remove_bg(Image.open(src))
        keyed = fill_interior_holes(keyed)
        packed = fill_interior_holes(pack(keyed))
        packed.save(OUT_DIR / f'kk-{pose}.png', optimize=True)
        packed.resize((128, 192), Image.Resampling.LANCZOS).save(OUT_DIR / f'kk-{pose}-thumb.png')
        print('wrote', pose, packed.size)


if __name__ == '__main__':
    main()
