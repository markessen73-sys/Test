#!/usr/bin/env python3
"""Bake Pricey whole-body solid ring poses from user-authored full renders.

Sources (repo root uploads — ddd7b73c, mapped by pose content):
  idle      → file_00000000e77081f4bd3c57b934ca8c51.png  (boxing guard)
  ooh       → file_00000000b87481f499358bbcca3f9949.png  (surprised O mouth)
  knockout  → file_00000000860481f4bde76cdff03136ad.png  (sad tears)

Branding (grafted after seal so glitter/script survives):
  top  → Katie Price on the sports bra from each pose's source art
  belt → PRICEY on idle; KP on ooh and knockout

Outputs: public/boxer/bodies/pricey-{idle,ooh,knockout}.png (+ thumbs)
Face pack refresh: public/faces/characters/pricey/{clean,ooh,knockout}.png
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


def figure_bounds(arr: np.ndarray) -> tuple[int, int, int, int]:
    solid = arr[:, :, 3] > 40
    ys, xs = np.where(solid)
    return int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())


def top_roi(y0: int, y1: int, x0: int, x1: int) -> tuple[int, int, int, int]:
  """Chest band on the black sports bra."""
  return (
      y0 + int(0.20 * (y1 - y0)),
      y0 + int(0.43 * (y1 - y0)),
      x0 + int(0.20 * (x1 - x0)),
      x1 - int(0.20 * (x1 - x0)),
  )


def belt_roi(y0: int, y1: int, x0: int, x1: int) -> tuple[int, int, int, int]:
  """Waistband patch — PRICEY or KP per pose."""
  return (
      y0 + int(0.50 * (y1 - y0)),
      y0 + int(0.64 * (y1 - y0)),
      x0 + int(0.26 * (x1 - x0)),
      x1 - int(0.26 * (x1 - x0)),
  )


def top_brand_mask(region: np.ndarray) -> np.ndarray:
    """Pink glitter/script on the black top — not skin or pink robe."""
    rgb = region[:, :, :3].astype(np.int16)
    a = region[:, :, 3]
    mx = rgb.max(axis=2)
    pink = (
        (a > 90)
        & (rgb[:, :, 0] > 135)
        & (rgb[:, :, 1] < 125)
        & (rgb[:, :, 2] > 45)
        & ((rgb[:, :, 0] - rgb[:, :, 1]) > 35)
    )
    dark_neighbor = ndimage.uniform_filter((mx < 95).astype(np.float32), size=7) > 0.35
    return pink & dark_neighbor


def belt_brand_mask(region: np.ndarray) -> np.ndarray:
    """White waist patch + black PRICEY / KP lettering."""
    rgb = region[:, :, :3].astype(np.int16)
    a = region[:, :, 3]
    white = (a > 90) & (rgb.min(axis=2) > 195)
    black_text = (a > 90) & (rgb.max(axis=2) < 85)
    white_near = ndimage.binary_dilation(white, iterations=4)
    return white | (black_text & white_near)


def graft_brand_roi(
    dst: np.ndarray,
    src: np.ndarray,
    roi_fn,
    mask_fn,
) -> None:
    y0, y1, x0, x1 = figure_bounds(dst)
    ry0, ry1, rx0, rx1 = roi_fn(y0, y1, x0, x1)
    dst_slice = dst[ry0:ry1, rx0:rx1]
    src_slice = src[ry0:ry1, rx0:rx1]
    mask = mask_fn(src_slice)
    dst_slice[mask] = src_slice[mask]
    dst[ry0:ry1, rx0:rx1] = dst_slice


def composite_pricey_branding(dst: np.ndarray, brand_src: np.ndarray) -> np.ndarray:
    """Restore Katie Price top + KP/Pricey belt from pre-seal packed source."""
    out = dst.copy()
    graft_brand_roi(out, brand_src, top_roi, top_brand_mask)
    graft_brand_roi(out, brand_src, belt_roi, belt_brand_mask)
    return out


def bake_pose(path: Path) -> tuple[Image.Image, Image.Image]:
    keyed = remove_bg(Image.open(path))
    brand_src = np.asarray(pack(seal_silhouette(keyed)))
    packed = seal_silhouette(Image.fromarray(brand_src))
    restored = composite_pricey_branding(np.asarray(packed), brand_src)
    solid = restored[:, :, 3] > 40
    restored[solid, 3] = 255
    return Image.fromarray(restored), packed


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    FACES.mkdir(parents=True, exist_ok=True)
    sync_user_face_packs()
    for pose, path in USER_IMPORTS.items():
        if not path.exists():
            raise SystemExit(f'missing source for {pose}: {path}')
        final, packed = bake_pose(path)
        assert_solid(packed, pose)
        save_pose_outputs(pose, final)


if __name__ == '__main__':
    main()
