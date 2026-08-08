#!/usr/bin/env python3
"""Pack user-authored Bozza full-body refs into solid ring textures.

Sources (repo root / GitHub uploads):
  normal    → file_00000000517081f486e9b9b456884a39.png
  ooh       → file_00000000b70c82469077f104b6001a73.png
  knockout  → file_00000000f0bc81f4a972669bdf700d2d.png

Rule: nothing inside the silhouette outline may stay clear.
White flag / highlight pixels are figure content (not studio leftovers).
Outputs:
  public/boxer/bodies/bozza-{idle,ooh,knockout}.png (+ thumbs)
"""
from __future__ import annotations

from collections import deque
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
SIDE_PAD = 28

SEAL_CLOSE_ITERS = 8
SURROUND_FILL_PASSES = 16
SURROUND_KERNEL = 13
SURROUND_FRAC = 0.55

REFS = {
    'idle': ROOT / 'file_00000000517081f486e9b9b456884a39.png',
    'ooh': ROOT / 'file_00000000b70c82469077f104b6001a73.png',
    'knockout': ROOT / 'file_00000000f0bc81f4a972669bdf700d2d.png',
}


def _edge_flood(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    exterior = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if mask[y, x]:
                exterior[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if mask[y, x] and not exterior[y, x]:
                exterior[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not exterior[ny, nx] and mask[ny, nx]:
                exterior[ny, nx] = True
                q.append((ny, nx))
    return exterior


def remove_bg(im: Image.Image) -> Image.Image:
    """Edge-flood light studio BG only. Keep white flag/highlight interiors."""
    a = np.array(im.convert('RGBA'))
    rgb = a[:, :, :3].astype(np.int16)
    alpha = a[:, :, 3]
    mx = rgb.max(axis=2)
    chroma = mx - rgb.min(axis=2)

    studio = (mx > 145) & (chroma < 48)
    studio |= (mx > 175) & (chroma < 60)
    studio |= (mx > 210) & (chroma < 80)
    studio |= (mx > 235) & (chroma < 110)
    is_clear = alpha < 8
    corner = rgb[2, 2].astype(np.int16)
    dist = np.abs(rgb.astype(np.int16) - corner).sum(axis=2)
    near_corner = dist <= 60
    growable = studio | is_clear | near_corner
    exterior = _edge_flood(growable)

    # Protect figure: saturated colors, dark blues, skin, and already-interior
    # whites that are not exterior-reachable yet stay until flood claims them.
    protect = ((chroma > 35) & (mx < 230)) | (mx < 100)
    protect &= alpha > 200
    for _ in range(5):
        grown = ndimage.binary_dilation(exterior, iterations=1) & ~protect
        claim = grown & (studio | is_clear | ((mx > 130) & (chroma < 55)) | (alpha < 40))
        if not claim.any():
            break
        exterior = exterior | claim

    # Second pass through studio|clear corridors (arm-gap leftovers).
    out_tmp = a.copy()
    out_tmp[exterior, 3] = 0
    alpha2 = out_tmp[:, :, 3]
    mx2 = out_tmp[:, :, :3].max(axis=2).astype(np.int16)
    chroma2 = mx2 - out_tmp[:, :, :3].min(axis=2).astype(np.int16)
    studio2 = (alpha2 > 0) & (mx2 > 110) & (chroma2 < 55)
    clear2 = alpha2 < 8
    exterior2 = _edge_flood(studio2 | clear2)
    exterior = exterior | (exterior2 & studio2)

    # Strip dirty mid-tone fringe on the cut edge only (not interior whites).
    out_tmp = a.copy()
    out_tmp[exterior, 3] = 0
    alpha3 = out_tmp[:, :, 3]
    rgb3 = out_tmp[:, :, :3].astype(np.int16)
    mx3 = rgb3.max(axis=2)
    chroma3 = mx3 - rgb3.min(axis=2)
    mid_flat = (alpha3 > 0) & (mx3 > 100) & (mx3 < 230) & (chroma3 < 55)
    clear3 = alpha3 < 8
    near_clear = ndimage.binary_dilation(clear3, iterations=2)
    # Keep skin-ish and strong blues (suit/gloves/boots) and bright whites
    # that have opaque neighbors on all sides (interior highlights / flag).
    skinish = (rgb3[:, :, 0] > 120) & ((rgb3[:, :, 0].astype(np.int16) - rgb3[:, :, 2]) > 25) & (chroma3 > 25)
    blueish = (rgb3[:, :, 2] > rgb3[:, :, 0] + 15) & (rgb3[:, :, 2] > 80)
    n8 = ndimage.convolve(
        (alpha3 > 40).astype(np.uint8),
        np.ones((3, 3), dtype=np.uint8),
        mode='constant',
    )
    interior_white = (mx3 > 200) & (chroma3 < 40) & (n8 >= 7)
    fringe = mid_flat & near_clear & ~skinish & ~blueish & ~interior_white
    exterior = exterior | fringe

    out = a.copy()
    out[exterior, 3] = 0
    return Image.fromarray(out)


def _nearest_color(rgb: np.ndarray, need: np.ndarray, known: np.ndarray) -> np.ndarray:
    if not need.any() or not known.any():
        return rgb
    _, (iy, ix) = ndimage.distance_transform_edt(~known, return_indices=True)
    out = rgb.copy()
    ys, xs = np.where(need)
    out[ys, xs] = rgb[iy[ys, xs], ix[ys, xs]]
    return out


def _horizontal_paint(rgb: np.ndarray, need: np.ndarray, known: np.ndarray) -> np.ndarray:
    out = rgb.copy()
    h, w = need.shape
    for y in range(h):
        row_need = need[y]
        if not row_need.any():
            continue
        row_known = known[y]
        if not row_known.any():
            continue
        known_xs = np.flatnonzero(row_known)
        need_xs = np.flatnonzero(row_need)
        idx = np.searchsorted(known_xs, need_xs)
        idx0 = np.clip(idx - 1, 0, len(known_xs) - 1)
        idx1 = np.clip(idx, 0, len(known_xs) - 1)
        x0 = known_xs[idx0]
        x1 = known_xs[idx1]
        choose1 = np.abs(need_xs - x1) < np.abs(need_xs - x0)
        src = np.where(choose1, x1, x0)
        out[y, need_xs] = rgb[y, src]
    return out


def seal_silhouette(im: Image.Image, close_iters: int = SEAL_CLOSE_ITERS) -> Image.Image:
    """Force every pixel inside the outline fully opaque.

    Preserves authored white highlights / Union Jack whites — only clears and
    empty pixels inside the silhouette are painted from neighbors.
    """
    a = np.array(im.convert('RGBA'))
    alpha = a[:, :, 3]
    rgb = a[:, :, :3].astype(np.float32)
    mx = rgb.max(axis=2)

    # After BG keying, every remaining opaque pixel is figure (including whites).
    body = alpha > 40

    closed = ndimage.binary_closing(body, iterations=close_iters)
    silhouette = ndimage.binary_fill_holes(closed)

    for _ in range(SURROUND_FILL_PASSES):
        frac = ndimage.uniform_filter(silhouette.astype(np.float32), size=SURROUND_KERNEL)
        claim = (~silhouette) & (frac >= SURROUND_FRAC)
        up = np.zeros_like(silhouette)
        down = np.zeros_like(silhouette)
        left = np.zeros_like(silhouette)
        right = np.zeros_like(silhouette)
        up[1:] = silhouette[:-1]
        down[:-1] = silhouette[1:]
        left[:, 1:] = silhouette[:, :-1]
        right[:, :-1] = silhouette[:, 1:]
        n4 = up.astype(np.uint8) + down + left + right
        claim |= (~silhouette) & (n4 >= 3)
        if not claim.any():
            break
        silhouette = silhouette | claim
    silhouette = ndimage.binary_fill_holes(silhouette)

    labeled, n = ndimage.label(silhouette)
    if n > 1:
        sizes = ndimage.sum(silhouette, labeled, range(1, n + 1))
        keep = int(np.argmax(sizes)) + 1
        silhouette = labeled == keep

    known = body & silhouette & (mx > 4)
    # Only fill missing/clear interior — do not repaint legitimate whites.
    need = silhouette & ((alpha < 255) | (mx <= 4))
    rgb = _horizontal_paint(rgb, need, known)
    still = silhouette & ((rgb.max(axis=2) <= 4) | (np.array(a[:, :, 3]) < 255))
    # Recompute still from current alpha mask intent
    still = silhouette & ((alpha < 255) | (rgb.max(axis=2) <= 4))
    rgb = _nearest_color(rgb, still, known)

    out = a.copy()
    out[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[:, :, 3] = np.where(silhouette, 255, 0).astype(np.uint8)
    return Image.fromarray(out)


def pack(im: Image.Image) -> Image.Image:
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 40)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    crop = Image.fromarray(a).crop((x0, y0, x1 + 1, y1 + 1))
    fw, fh = crop.size
    sole_y = int(TARGET_H * (1 - FEET_SOLE_FRAC)) - 1
    avail_h = sole_y - TOP_PAD
    avail_w = TARGET_W - 2 * SIDE_PAD
    scale = min(avail_w / fw, avail_h / fh)
    nw, nh = max(1, int(round(fw * scale))), max(1, int(round(fh * scale)))
    scaled = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (TARGET_W, TARGET_H), (0, 0, 0, 0))
    paste_x = (TARGET_W - nw) // 2
    paste_y = sole_y - nh + 1
    canvas.paste(scaled, (paste_x, paste_y), scaled)
    return canvas


def assert_solid(im: Image.Image, name: str) -> None:
    a = np.array(im)
    alpha = a[:, :, 3]
    soft = int(((alpha > 0) & (alpha < 255)).sum())
    opaque = alpha == 255
    enclosed = ndimage.binary_fill_holes(opaque)
    holes = int((enclosed & ~opaque).sum())
    clearish = alpha < 128
    exterior = _edge_flood(clearish)
    clear_inside = int(((~exterior) & (alpha < 255)).sum())
    frac = ndimage.uniform_filter(opaque.astype(np.float32), size=11)
    surrounded = int(((alpha < 128) & (frac > 0.55)).sum())
    if soft or holes or clear_inside or surrounded > 200:
        raise SystemExit(
            f'{name} not solid: soft={soft} holes={holes} '
            f'clear_inside={clear_inside} surrounded={surrounded}'
        )
    print(f'{name}: solid opaque={int(opaque.sum())} surrounded={surrounded}')


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for pose, path in REFS.items():
        src = path
        if not src.exists():
            alt = OUT_DIR / 'bozza-source-refs' / f'{pose}-original.png'
            if not alt.exists():
                alt = OUT_DIR / 'bozza-source-refs' / f'{pose}.png'
            if not alt.exists():
                raise SystemExit(f'missing source for {pose}: {path}')
            src = alt
        keyed = remove_bg(Image.open(src))
        sealed = seal_silhouette(keyed)
        packed = seal_silhouette(pack(sealed))
        assert_solid(packed, pose)
        packed.save(OUT_DIR / f'bozza-{pose}.png', optimize=True)
        packed.resize((128, 192), Image.Resampling.LANCZOS).save(
            OUT_DIR / f'bozza-{pose}-thumb.png', optimize=True
        )
        thumb = np.array(Image.open(OUT_DIR / f'bozza-{pose}-thumb.png').convert('RGBA'))
        thumb[:, :, 3] = np.where(thumb[:, :, 3] > 40, 255, 0).astype(np.uint8)
        Image.fromarray(np.array(seal_silhouette(Image.fromarray(thumb), close_iters=3))).save(
            OUT_DIR / f'bozza-{pose}-thumb.png', optimize=True
        )
        print('wrote', pose, packed.size)


if __name__ == '__main__':
    main()
