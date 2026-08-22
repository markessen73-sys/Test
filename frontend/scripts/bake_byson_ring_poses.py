#!/usr/bin/env python3
"""Bake Byson whole-body solid ring poses from user-authored full renders.

Sources (repo root uploads — upload order normal, ooh, knockout):
  idle      → file_000000001d3c81f48f45f7961e108ae6.png
  ooh       → file_00000000338c81f4a282b4bd41038589.png
  knockout  → file_000000004a088246abdd63d9b4993a29.png

Outputs: public/boxer/bodies/byson-{idle,ooh,knockout}.png (+ thumbs)
Face pack refresh: public/faces/characters/byson/{clean,ooh,knockout}.png
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

from bake_bozza_ring_poses import assert_solid, pack, remove_bg, seal_silhouette

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
OUT = ROOT / 'public/boxer/bodies'
FACES = ROOT / 'public/faces/characters/byson'
W, H = 1024, 1536
TOP_PAD = 40

USER_IMPORTS = {
    'idle': REPO_ROOT / 'file_000000001d3c81f48f45f7961e108ae6.png',
    'ooh': REPO_ROOT / 'file_00000000338c81f4a282b4bd41038589.png',
    'knockout': REPO_ROOT / 'file_000000004a088246abdd63d9b4993a29.png',
}


def armpit_clear_mask_ooh(body: np.ndarray) -> np.ndarray:
    """Wider wedges for arms-down ooh pose — clears white gaps beside the torso."""
    solid = body[:, :, 3] > 40
    if not solid.any():
        return np.zeros(solid.shape, dtype=bool)
    ys, xs = np.where(solid)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    fig_h, fig_w = y1 - y0, x1 - x0

    mask = np.zeros(solid.shape, dtype=bool)
    y_top = y0 + int(0.10 * fig_h)
    y_bot = y0 + int(0.52 * fig_h)
    for y in range(y_top, y_bot):
        t = (y - y_top) / max(1, y_bot - y_top - 1)
        lx0 = x0 + int(fig_w * (0.04 + 0.10 * t))
        lx1 = x0 + int(fig_w * (0.34 - 0.02 * t))
        mask[y, lx0:lx1] = True
        rx1 = x1 - int(fig_w * (0.04 + 0.10 * t))
        rx0 = x1 - int(fig_w * (0.34 - 0.02 * t))
        mask[y, rx0:rx1] = True

    hull = ndimage.binary_fill_holes(ndimage.binary_closing(solid, iterations=3))
    return mask & hull


def punch_ooh_armpit_wedges(arr: np.ndarray) -> np.ndarray:
    """Clear pale studio fill between inner arms and torso on the ooh pose."""
    out = arr.copy()
    rgb = out[:, :, :3].astype(np.int16)
    mx = rgb.max(axis=2)
    chroma = mx - rgb.min(axis=2)
    wedge = armpit_clear_mask_ooh(out)
    pale = (out[:, :, 3] > 40) & (mx > 160) & (chroma < 55)
    out[wedge & pale, 3] = 0
    return out


def assert_pose_solid(packed: Image.Image, pose: str) -> None:
    if pose != 'ooh':
        assert_solid(packed, pose)
        return
    arr = np.asarray(packed)
    allow = ndimage.binary_dilation(armpit_clear_mask_ooh(arr), iterations=5)
    alpha = arr[:, :, 3]
    opaque = alpha == 255
    holes_mask = ndimage.binary_fill_holes(opaque) & ~opaque
    holes_mask &= ~allow
    holes = int(holes_mask.sum())
    if holes:
        raise SystemExit(f'{pose} not solid: holes={holes}')
    print(f'{pose}: solid opaque={int(opaque.sum())}')


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
    packed.save(OUT / f'byson-{pose}.png', optimize=True)
    thumb = packed.resize((128, 192), Image.Resampling.LANCZOS)
    t = np.array(thumb.convert('RGBA'))
    t[:, :, 3] = np.where(t[:, :, 3] > 40, 255, 0).astype(np.uint8)
    Image.fromarray(np.array(seal_silhouette(Image.fromarray(t), close_iters=3))).save(
        OUT / f'byson-{pose}-thumb.png', optimize=True
    )
    print('wrote', pose)


def bake_ooh(path: Path) -> Image.Image:
    keyed = remove_bg(Image.open(path))
    packed = seal_silhouette(pack(seal_silhouette(keyed)))
    return Image.fromarray(punch_ooh_armpit_wedges(np.asarray(packed)))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    FACES.mkdir(parents=True, exist_ok=True)
    sync_user_face_packs()
    for pose, path in USER_IMPORTS.items():
        if not path.exists():
            raise SystemExit(f'missing source for {pose}: {path}')
        if pose == 'ooh':
            packed = bake_ooh(path)
        else:
            keyed = remove_bg(Image.open(path))
            sealed = seal_silhouette(keyed)
            packed = seal_silhouette(pack(sealed))
        assert_pose_solid(packed, pose)
        save_pose_outputs(pose, packed)


if __name__ == '__main__':
    main()
