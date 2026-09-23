#!/usr/bin/env python3
"""Bake Pricey whole-body solid ring poses from user-authored full renders.

Sources (repo root uploads — ddd7b73c, mapped by pose content):
  idle      → file_00000000e77081f4bd3c57b934ca8c51.png  (boxing guard)
  ooh       → file_00000000b87481f499358bbcca3f9949.png  (surprised O mouth)
  knockout  → file_00000000860481f4bde76cdff03136ad.png  (sad tears)

Branding: Katie Price lettering is painted off the sports bra; the belt keeps
the authored PRICEY (idle) / KP (ooh, knockout) patch.

Outputs: public/boxer/bodies/pricey-{idle,ooh,knockout}.png (+ thumbs)
Face pack refresh: public/faces/characters/pricey/{clean,ooh,knockout}.png
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

from bake_bozza_ring_poses import assert_solid, pack, remove_bg, seal_silhouette

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
OUT = ROOT / 'public/boxer/bodies'
FACES = ROOT / 'public/faces/characters/pricey'
W, H = 1024, 1536
TOP_PAD = 40

USER_IMPORTS = {
    'idle': REPO_ROOT / 'file_00000000e77081f4bd3c57b934ca8c51.png',
    'ooh': REPO_ROOT / 'file_00000000b87481f499358bbcca3f9949.png',
    'knockout': REPO_ROOT / 'file_00000000860481f4bde76cdff03136ad.png',
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
    packed.save(OUT / f'pricey-{pose}.png', optimize=True)
    thumb = packed.resize((128, 192), Image.Resampling.LANCZOS)
    t = np.array(thumb.convert('RGBA'))
    t[:, :, 3] = np.where(t[:, :, 3] > 40, 255, 0).astype(np.uint8)
    Image.fromarray(np.array(seal_silhouette(Image.fromarray(t), close_iters=3))).save(
        OUT / f'pricey-{pose}-thumb.png', optimize=True
    )
    print('wrote', pose)


def strip_top_lettering(keyed: Image.Image) -> Image.Image:
    """Paint the pink Katie Price lettering off the black sports bra.

    The bra is the largest near-black blob in the chest band; lettering is the
    pink inside its filled outline. Gloves, robe and skin sit outside that hull.
    """
    a = np.array(keyed.convert('RGBA'))
    rgb = a[:, :, :3].astype(np.int16)
    solid = a[:, :, 3] > 40
    ys, xs = np.where(solid)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    band = np.zeros(solid.shape, dtype=bool)
    band[
        y0 + int(0.18 * (y1 - y0)) : y0 + int(0.45 * (y1 - y0)),
        x0 + int(0.20 * (x1 - x0)) : x1 - int(0.20 * (x1 - x0)),
    ] = True
    dark = solid & band & (rgb.max(axis=2) < 60)
    labels, n = ndimage.label(ndimage.binary_opening(dark, iterations=2))
    if n == 0:
        raise SystemExit('sports bra not found')
    sizes = ndimage.sum(dark, labels, range(1, n + 1))
    bra = ndimage.binary_closing(labels == int(np.argmax(sizes)) + 1, iterations=3)
    hull = ndimage.binary_dilation(ndimage.binary_fill_holes(bra), iterations=3)

    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    pink = hull & (r > 110) & (b > g + 15) & (r > g + 40)
    blobs, nb = ndimage.label(ndimage.binary_dilation(pink, iterations=2))
    blob_px = ndimage.sum(pink, blobs, range(1, nb + 1))
    lettering = np.isin(blobs, 1 + np.flatnonzero(blob_px >= 25))
    mask = ndimage.binary_dilation(lettering, iterations=5) & hull

    bgr = cv2.cvtColor(np.ascontiguousarray(a[:, :, :3]), cv2.COLOR_RGB2BGR)
    painted = cv2.inpaint(bgr, mask.astype(np.uint8) * 255, 9, cv2.INPAINT_TELEA)
    painted = cv2.cvtColor(painted, cv2.COLOR_BGR2RGB)
    soft = cv2.GaussianBlur(painted, (0, 0), 2.5)
    painted[mask] = soft[mask]
    out = a.copy()
    out[:, :, :3] = painted
    return Image.fromarray(out)


def bake_pose(path: Path) -> Image.Image:
    keyed = strip_top_lettering(remove_bg(Image.open(path)))
    return seal_silhouette(pack(seal_silhouette(keyed)))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    FACES.mkdir(parents=True, exist_ok=True)
    sync_user_face_packs()
    for pose, path in USER_IMPORTS.items():
        if not path.exists():
            raise SystemExit(f'missing source for {pose}: {path}')
        packed = bake_pose(path)
        assert_solid(packed, pose)
        save_pose_outputs(pose, packed)


if __name__ == '__main__':
    main()
