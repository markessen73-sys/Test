#!/usr/bin/env python3
"""Bake Default Female whole-body solid ring poses from user-authored full renders.

Sources (repo root uploads — mapped by pose content):
  idle      → file_00000000ac6081f4ad4602d25e0427c0.png  (boxing guard)
  ooh       → file_00000000bcb481f4b197416e7096600a.png  (ooh mouth)
  knockout  → file_00000000059481f4a3929a6a5c7301e0.png  (exhausted slump)

Outputs: public/boxer/bodies/default-female-{idle,ooh,knockout}.png (+ thumbs)
Face pack refresh: public/faces/characters/default-female/{clean,ooh,knockout}.png
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
FACES = ROOT / 'public/faces/characters/default-female'
W, H = 1024, 1536
TOP_PAD = 40

USER_IMPORTS = {
    'idle': REPO_ROOT / 'file_00000000ac6081f4ad4602d25e0427c0.png',
    'ooh': REPO_ROOT / 'file_00000000bcb481f4b197416e7096600a.png',
    'knockout': REPO_ROOT / 'file_00000000059481f4a3929a6a5c7301e0.png',
}


def peel_exterior_fringe(
    arr: np.ndarray,
    *,
    pale: bool = False,
    dark: bool = False,
    region: np.ndarray | None = None,
    passes: int = 40,
) -> np.ndarray:
    """Flood transparency through pale or dark matting touching the exterior."""
    out = arr.copy()
    rgb = out[:, :, :3].astype(np.int16)
    for _ in range(passes):
        alpha = out[:, :, 3]
        mx = rgb.max(axis=2)
        chroma = mx - rgb.min(axis=2)
        clear = alpha < 40
        if pale:
            fringe = (alpha > 0) & (mx > 200) & (chroma < 45)
        elif dark:
            fringe = (alpha > 0) & (mx < 85) & (chroma < 50)
        else:
            break
        grow = ndimage.binary_dilation(clear, iterations=1) & fringe
        if region is not None:
            grow &= region
        if not grow.any():
            break
        out[grow, 3] = 0
    return out


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
    # Semi-transparent dark fringe on the hair edge.
    fringe = crown & (alpha > 10) & (alpha < 240) & (mx < 100) & (chroma < 50)
    out[fringe & near_clear, 3] = 0
    return out


def finalize_idle(arr: np.ndarray) -> np.ndarray:
    """Peel leftover white matting on the outer silhouette only."""
    return peel_exterior_fringe(arr, pale=True, passes=40)


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


def armpit_clear_mask_idle(body: np.ndarray) -> np.ndarray:
    """Narrow wedges in the gaps between inner arms and torso (guard pose)."""
    solid = body[:, :, 3] > 40
    if not solid.any():
        return np.zeros(solid.shape, dtype=bool)
    ys, xs = np.where(solid)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    fig_h, fig_w = y1 - y0, x1 - x0

    mask = np.zeros(solid.shape, dtype=bool)
    y_top = y0 + int(0.12 * fig_h)
    y_bot = y0 + int(0.46 * fig_h)
    for y in range(y_top, y_bot):
        t = (y - y_top) / max(1, y_bot - y_top - 1)
        # Left armpit pocket (between left glove/arm and torso).
        lx0 = x0 + int(fig_w * (0.30 + 0.03 * t))
        lx1 = x0 + int(fig_w * (0.40 - 0.02 * t))
        mask[y, lx0:lx1] = True
        # Right armpit pocket (between torso and right glove/arm).
        rx0 = x0 + int(fig_w * (0.58 + 0.02 * t))
        rx1 = x0 + int(fig_w * (0.73 - 0.03 * t))
        mask[y, rx0:rx1] = True

    hull = ndimage.binary_fill_holes(ndimage.binary_closing(solid, iterations=3))
    return mask & hull


def punch_idle_armpit_wedges(arr: np.ndarray) -> np.ndarray:
    """Clear pale studio fill between inner arms and torso on the guard idle pose."""
    out = arr.copy()
    rgb = out[:, :, :3].astype(np.int16)
    mx = rgb.max(axis=2)
    chroma = mx - rgb.min(axis=2)
    wedge = armpit_clear_mask_idle(out)
    pale = (out[:, :, 3] > 40) & (mx > 130) & (chroma < 65)
    out[wedge & pale, 3] = 0
    return out


def preprocess_idle(arr: np.ndarray) -> np.ndarray:
    out = peel_exterior_fringe(arr, pale=True)
    out = peel_dark_hair_matte(out)
    return out


def assert_pose_solid(packed: Image.Image, pose: str) -> None:
    if pose != 'idle':
        assert_solid(packed, pose)
        return
    arr = np.asarray(packed)
    allow = armpit_clear_mask_idle(arr)
    allow = ndimage.binary_dilation(allow, iterations=5)
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
            if pose == 'idle':
                keyed = preprocess_idle(keyed)
            Image.fromarray(extract_face_pack(keyed)).save(FACES / face_name, optimize=True)


def save_pose_outputs(pose: str, packed: Image.Image) -> None:
    packed.save(OUT / f'default-female-{pose}.png', optimize=True)
    thumb = packed.resize((128, 192), Image.Resampling.LANCZOS)
    t = np.array(thumb.convert('RGBA'))
    t[:, :, 3] = np.where(t[:, :, 3] > 40, 255, 0).astype(np.uint8)
    Image.fromarray(np.array(seal_silhouette(Image.fromarray(t), close_iters=3))).save(
        OUT / f'default-female-{pose}-thumb.png', optimize=True
    )
    print('wrote', pose)


def bake_idle(path: Path) -> Image.Image:
    arr = preprocess_idle(np.asarray(remove_bg(Image.open(path))))
    packed = seal_silhouette(pack(seal_silhouette(Image.fromarray(arr))))
    punched = punch_idle_armpit_wedges(np.asarray(packed))
    return Image.fromarray(finalize_idle(punched))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    FACES.mkdir(parents=True, exist_ok=True)
    sync_user_face_packs()
    for pose, path in USER_IMPORTS.items():
        if not path.exists():
            raise SystemExit(f'missing source for {pose}: {path}')
        if pose == 'idle':
            packed = bake_idle(path)
        else:
            keyed = remove_bg(Image.open(path))
            sealed = seal_silhouette(keyed)
            packed = seal_silhouette(pack(sealed))
        assert_pose_solid(packed, pose)
        save_pose_outputs(pose, packed)


if __name__ == '__main__':
    main()
