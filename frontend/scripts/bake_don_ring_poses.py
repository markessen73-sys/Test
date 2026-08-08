#!/usr/bin/env python3
"""Bake The Don whole-body solid ring poses from user-authored full renders.

Sources (repo root uploads — visual pose mapping):
  idle      → file_00000000e4b881f4a2acbd7f78d9e949.png  (boxing guard)
  ooh       → file_000000006fec81f4a75db246c1a30693.png  (surprised O mouth)
  knockout  → file_00000000d18881f4ba89f5bef1594651.png  (defeated slump)

Outputs: public/boxer/bodies/don-{idle,ooh,knockout}.png (+ thumbs)
Face pack refresh: public/faces/characters/the-don/{clean,ooh,knockout}.png
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

from bake_bozza_ring_poses import assert_solid, pack, remove_bg, seal_silhouette

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
OUT = ROOT / 'public/boxer/bodies'
FACES = ROOT / 'public/faces/characters/the-don'
W, H = 1024, 1536
TOP_PAD = 40

USER_IMPORTS = {
  # Latest three uploads (aa72a9fb) — mapped by pose content, not filename order.
  'idle': REPO_ROOT / 'file_00000000e4b881f4a2acbd7f78d9e949.png',
  'ooh': REPO_ROOT / 'file_000000006fec81f4a75db246c1a30693.png',
  'knockout': REPO_ROOT / 'file_00000000d18881f4ba89f5bef1594651.png',
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
    packed.save(OUT / f'don-{pose}.png', optimize=True)
    thumb = packed.resize((128, 192), Image.Resampling.LANCZOS)
    t = np.array(thumb.convert('RGBA'))
    t[:, :, 3] = np.where(t[:, :, 3] > 40, 255, 0).astype(np.uint8)
    Image.fromarray(np.array(seal_silhouette(Image.fromarray(t), close_iters=3))).save(
        OUT / f'don-{pose}-thumb.png', optimize=True
    )
    print('wrote', pose)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    FACES.mkdir(parents=True, exist_ok=True)
    sync_user_face_packs()
    for pose, path in USER_IMPORTS.items():
        if not path.exists():
            raise SystemExit(f'missing source for {pose}: {path}')
        keyed = remove_bg(Image.open(path))
        sealed = seal_silhouette(keyed)
        packed = seal_silhouette(pack(sealed))
        assert_solid(packed, pose)
        save_pose_outputs(pose, packed)


if __name__ == '__main__':
    main()
