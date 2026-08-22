#!/usr/bin/env python3
"""Bake Byson whole-body solid ring poses from user-authored full renders.

Sources (repo root uploads — upload order normal, ooh, knockout):
  idle      → file_000000004a088246abdd63d9b4993a29.png  (guard — 3rd upload)
  ooh       → file_00000000338c81f4a282b4bd41038589.png
  knockout  → file_000000001d3c81f48f45f7961e108ae6.png  (slump — 1st upload)

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
    'idle': REPO_ROOT / 'file_000000004a088246abdd63d9b4993a29.png',
    'ooh': REPO_ROOT / 'file_00000000338c81f4a282b4bd41038589.png',
    'knockout': REPO_ROOT / 'file_000000001d3c81f48f45f7961e108ae6.png',
}


def peel_exterior_fringe(
    arr: np.ndarray,
    *,
    pale: bool = False,
    passes: int = 40,
) -> np.ndarray:
    """Flood transparency through pale matting touching the exterior."""
    out = arr.copy()
    rgb = out[:, :, :3].astype(np.int16)
    for _ in range(passes):
        alpha = out[:, :, 3]
        mx = rgb.max(axis=2)
        chroma = mx - rgb.min(axis=2)
        clear = alpha < 40
        fringe = (alpha > 0) & (mx > 200) & (chroma < 45)
        grow = ndimage.binary_dilation(clear, iterations=1) & fringe
        if not grow.any():
            break
        out[grow, 3] = 0
    return out


def head_crown_mask(body: np.ndarray) -> np.ndarray:
    solid = body[:, :, 3] > 40
    if not solid.any():
        return np.zeros(solid.shape, dtype=bool)
    ys, xs = np.where(solid)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    fig_h = y1 - y0
    mask = np.zeros(solid.shape, dtype=bool)
    crown_y1 = y0 + int(0.45 * fig_h)
    pad = int((x1 - x0) * 0.10)
    mask[y0:crown_y1, max(0, x0 - pad) : min(body.shape[1], x1 + pad + 1)] = True
    return mask


def peel_dark_hair_matte(arr: np.ndarray) -> np.ndarray:
    """Remove dark gray studio matting hugging the hair outline."""
    out = arr.copy()
    crown = head_crown_mask(out)
    rgb = out[:, :, :3].astype(np.int16)
    alpha = out[:, :, 3]
    mx = rgb.max(axis=2)
    chroma = mx - rgb.min(axis=2)
    clear = alpha < 40
    near_clear = ndimage.binary_dilation(clear, iterations=5)
    matte = crown & near_clear & (alpha > 0) & (mx >= 30) & (mx < 130) & (chroma < 60)
    out[matte, 3] = 0
    fringe = crown & (alpha > 10) & (alpha < 240) & (mx < 100) & (chroma < 50)
    out[fringe & near_clear, 3] = 0
    return out


def key_byson(im: Image.Image) -> np.ndarray:
    """Key studio BG, then restore interior figure holes (shorts logo, etc.)."""
    src = np.asarray(im.convert('RGBA'))
    keyed = np.asarray(remove_bg(Image.fromarray(src)))
    alpha = keyed[:, :, 3]
    body = alpha > 40
    closed = ndimage.binary_closing(body, iterations=18)
    hull = ndimage.binary_fill_holes(closed)
    holes = hull & (alpha < 40)
    if not holes.any():
        return keyed
    corner = src[2, 2, :3].astype(np.int16)
    dist = np.abs(src[:, :, :3].astype(np.int16) - corner).sum(axis=2)
    restore = holes & (dist > 30)
    out = keyed.copy()
    out[restore, :3] = src[restore, :3]
    out[restore, 3] = 255
    return out


def preprocess_idle(arr: np.ndarray) -> np.ndarray:
    out = peel_exterior_fringe(arr, pale=True)
    return peel_dark_hair_matte(out)


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
            keyed = key_byson(Image.open(import_path))
            if pose == 'idle':
                keyed = preprocess_idle(keyed)
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


def bake_idle(path: Path) -> Image.Image:
    arr = preprocess_idle(key_byson(Image.open(path)))
    return seal_silhouette(pack(seal_silhouette(Image.fromarray(arr))))


def bake_ooh(path: Path) -> Image.Image:
    keyed = Image.fromarray(key_byson(Image.open(path)))
    packed = seal_silhouette(pack(seal_silhouette(keyed)))
    return Image.fromarray(punch_ooh_armpit_wedges(np.asarray(packed)))


def bake_knockout(path: Path) -> Image.Image:
    keyed = Image.fromarray(key_byson(Image.open(path)))
    return seal_silhouette(pack(seal_silhouette(keyed)))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    FACES.mkdir(parents=True, exist_ok=True)
    sync_user_face_packs()
    bakers = {
        'idle': bake_idle,
        'ooh': bake_ooh,
        'knockout': bake_knockout,
    }
    for pose, path in USER_IMPORTS.items():
        if not path.exists():
            raise SystemExit(f'missing source for {pose}: {path}')
        packed = bakers[pose](path)
        assert_pose_solid(packed, pose)
        save_pose_outputs(pose, packed)


if __name__ == '__main__':
    main()
