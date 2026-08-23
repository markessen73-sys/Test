#!/usr/bin/env python3
"""Bake King Of The North whole-body solid ring poses from user-authored full renders.

Sources (repo root uploads — visual pose mapping):
  idle      → file_00000000ad3081f49234b3b8bed59506.png  (boxing guard)
  ooh       → file_0000000094e481f48ef78497443168fb.png  (surprised O mouth)
  knockout  → file_00000000079881f48f9211e3133014cf.png  (defeated slump)

Outputs: public/boxer/bodies/king-{idle,ooh,knockout}.png (+ thumbs)
Face pack refresh: public/faces/characters/king-of-the-north/{clean,ooh,knockout}.png
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from bake_bozza_ring_poses import assert_solid, pack, remove_bg, seal_silhouette
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
OUT = ROOT / 'public/boxer/bodies'
FACES = ROOT / 'public/faces/characters/king-of-the-north'
W, H = 1024, 1536
TOP_PAD = 40

USER_IMPORTS = {
  # Latest three uploads (cb0686e8) — mapped by pose content, not filename order.
  'idle': REPO_ROOT / 'file_00000000ad3081f49234b3b8bed59506.png',
  'ooh': REPO_ROOT / 'file_0000000094e481f48ef78497443168fb.png',
  'knockout': REPO_ROOT / 'file_00000000079881f48f9211e3133014cf.png',
}


def extract_face_pack(arr: np.ndarray) -> np.ndarray:
    """Crop head and upper neck from a keyed full-body render for the face pack."""
    solid = arr[:, :, 3] > 40
    ys, xs = np.where(solid)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    fig_h = y1 - y0
    head_y1 = y0 + int(0.36 * fig_h)
    cx = (x0 + x1) // 2
    half_w = int((x1 - x0) * 0.34)
    pad = 48
    crop = arr[
        max(0, y0 - pad) : min(H, head_y1 + pad),
        max(0, cx - half_w - pad) : min(W, cx + half_w + pad),
    ]
    canvas = np.zeros((H, W, 4), np.uint8)
    ch, cw = crop.shape[:2]
    paste_x = (W - cw) // 2
    paste_y = max(48, TOP_PAD // 2)
    canvas[paste_y : paste_y + ch, paste_x : paste_x + cw] = crop
    return canvas


def sync_user_face_packs() -> None:
    for pose, face_name in (('idle', 'clean.png'), ('ooh', 'ooh.png'), ('knockout', 'knockout.png')):
        import_path = USER_IMPORTS.get(pose)
        if import_path and import_path.exists():
            keyed = np.asarray(remove_bg(Image.open(import_path).convert('RGBA')))
            Image.fromarray(extract_face_pack(keyed)).save(FACES / face_name, optimize=True)


def save_pose_outputs(pose: str, packed: Image.Image) -> None:
    packed.save(OUT / f'king-{pose}.png', optimize=True)
    thumb = packed.resize((128, 192), Image.Resampling.LANCZOS)
    t = np.array(thumb.convert('RGBA'))
    t[:, :, 3] = np.where(t[:, :, 3] > 40, 255, 0).astype(np.uint8)
    Image.fromarray(np.array(seal_silhouette(Image.fromarray(t), close_iters=3))).save(
        OUT / f'king-{pose}-thumb.png', optimize=True
    )
    print('wrote', pose)


def fill_interior_gaps(arr: np.ndarray) -> np.ndarray:
    """Paint enclosed clear pixels from nearest opaque neighbor."""
    out = arr.copy()
    opaque = out[:, :, 3] == 255
    enclosed = ndimage.binary_fill_holes(opaque)
    need = enclosed & ~opaque
    if need.any():
        _, (iy, ix) = ndimage.distance_transform_edt(~opaque, return_indices=True)
        ys, xs = np.where(need)
        out[ys, xs] = out[iy[ys, xs], ix[ys, xs]]
    frac = ndimage.uniform_filter((out[:, :, 3] == 255).astype(np.float32), size=11)
    surrounded = (out[:, :, 3] < 128) & (frac > 0.55)
    if surrounded.any():
        opaque2 = out[:, :, 3] == 255
        _, (iy, ix) = ndimage.distance_transform_edt(~opaque2, return_indices=True)
        ys, xs = np.where(surrounded)
        out[ys, xs] = out[iy[ys, xs], ix[ys, xs]]
    out[:, :, 3] = np.where(out[:, :, 3] > 40, 255, 0).astype(np.uint8)
    return out


def bake_pose(keyed: Image.Image, leg_frac: float = 0.72) -> Image.Image:
    """Pack keyed art, seal torso, and restore feet from the raw pack.

    Full-frame seal eats red boot fringe; copying strongly opaque foot-band
    pixels from pack(keyed) keeps soles and stripes, then gap-fill solidifies.
    """
    raw = pack(keyed)
    raw_a = np.asarray(raw)
    solid = raw_a[:, :, 3] > 40
    ys, xs = np.where(solid)
    y0, y1 = int(ys.min()), int(ys.max())
    h = raw_a.shape[0]
    y_knee = y0 + int(leg_frac * (y1 - y0))
    sealed = np.asarray(seal_silhouette(raw))
    out = sealed.copy()
    foot_rows = np.arange(h)[:, None] >= y_knee
    strong = raw_a[:, :, 3] > 200
    keep = foot_rows & strong
    for _ in range(4):
        out[keep] = raw_a[keep]
        out[:, :, 3] = np.where(out[:, :, 3] > 40, 255, 0).astype(np.uint8)
        out = fill_interior_gaps(out)
    return Image.fromarray(out)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    FACES.mkdir(parents=True, exist_ok=True)
    sync_user_face_packs()
    for pose, path in USER_IMPORTS.items():
        if not path.exists():
            raise SystemExit(f'missing source for {pose}: {path}')
        keyed = remove_bg(Image.open(path))
        packed = bake_pose(keyed)
        assert_solid(packed, pose)
        save_pose_outputs(pose, packed)


if __name__ == '__main__':
    main()
