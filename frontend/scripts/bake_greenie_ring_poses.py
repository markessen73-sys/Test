#!/usr/bin/env python3
"""Bake Greenie whole-body solid ring poses.

Body: thin pale + green gloves/shorts/boots + recycling logo
  (greenie-source-refs/*-body-raw.png)
Head: existing face pack (same as Options / bag / bobo)
  faces/characters/the-greenie/{clean,ooh,knockout}.png

Outputs: public/boxer/bodies/greenie-{idle,ooh,knockout}.png (+ thumbs)
"""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
OUT = ROOT / 'public/boxer/bodies'
SRC = OUT / 'greenie-source-refs'
FACES = ROOT / 'public/faces/characters/the-greenie'
USER_IMPORTS = {
    'idle': REPO_ROOT / 'file_000000004ca881f49ec099cc469bc5f3.png',
    'ooh': REPO_ROOT / 'file_00000000b3f081f48c2f7358d7f3a123.png',
}
USER_KNOCKOUT_FACE = REPO_ROOT / 'file_00000000b3f081f48c2f7358d7f3a123.png'
W, H = 1024, 1536
FEET_SOLE = 0.0664
TOP_PAD = 120
SIDE_PAD = 36
NECK_HALF_W = 42

SEAL_CLOSE_ITERS = 4
SURROUND_FILL_PASSES = 12
SURROUND_KERNEL = 11
SURROUND_FRAC = 0.62

JOBS = [
    ('idle', 'idle-body-raw.png', 'clean.png', 0.86),
    ('ooh', 'ooh-body-raw.png', 'ooh.png', 0.84),
    ('knockout', 'knockout-body-raw.png', 'knockout.png', 0.85),
]


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


def key_white_bg_safe(arr: np.ndarray) -> np.ndarray:
    """Remove warm off-white studio BG without eating pale body skin."""
    rgb = arr[:, :, :3].astype(np.int16)
    a = arr[:, :, 3]
    mx = rgb.max(axis=2)
    chroma = mx - rgb.min(axis=2)
    corner = rgb[2, 2].astype(np.int16)
    dist = np.abs(rgb - corner).sum(axis=2)
    # Generated refs use warm near-white plates (e.g. 248,235,230), not pure white.
    studio = (dist <= 55) | ((mx > 235) & (chroma < 28)) | ((mx > 245) & (chroma < 40)) | (a < 8)
    exterior = _edge_flood(studio)
    # Protect green gear and any clearly non-BG figure content.
    green = (rgb[:, :, 1] > rgb[:, :, 0] + 18) & (rgb[:, :, 1] > 80)
    protect = green | ((chroma > 35) & (mx < 230)) | (mx < 200)
    for _ in range(4):
        grown = ndimage.binary_dilation(exterior, iterations=1) & ~protect
        claim = grown & (
            (dist <= 60) | ((mx > 230) & (chroma < 32)) | (a < 40)
        )
        if not claim.any():
            break
        exterior = exterior | claim
    out = arr.copy()
    out[exterior, 3] = 0
    return out


def key_black_face(arr: np.ndarray) -> np.ndarray:
    rgb = arr[:, :, :3].astype(np.int16)
    a = arr[:, :, 3]
    mx = rgb.max(axis=2)
    dark = (mx < 28) | (a < 8)
    exterior = _edge_flood(dark)
    exterior = exterior | (
        ndimage.binary_dilation(exterior, iterations=1) & ((mx < 45) | (a < 40))
    )
    out = arr.copy()
    out[exterior, 3] = 0
    return out


def detect_mannequin_head(body: np.ndarray) -> tuple[int, int, int]:
    a = body[:, :, 3] > 40
    rgb = body[:, :, :3].astype(np.float32)
    ys, xs = np.where(a)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    fig_h = y1 - y0
    band = a.copy()
    band[:y0] = False
    band[y0 + int(0.26 * fig_h) :] = False
    mx = rgb.max(axis=2)
    chroma = mx - rgb.min(axis=2)
    pale = (mx > 150) & (chroma < 55) & a
    seed = band & pale
    labeled, n = ndimage.label(seed)
    cx_fig = (x0 + x1) / 2
    best = None
    best_score = 1e18
    for i in range(1, n + 1):
        comp = labeled == i
        if comp.sum() < 80:
            continue
        cys, cxs = np.where(comp)
        cy, cx = cys.mean(), cxs.mean()
        h = cys.max() - cys.min() + 1
        if h > 0.32 * fig_h:
            continue
        score = (cy - y0) + 0.15 * abs(cx - cx_fig)
        if score < best_score:
            best_score = score
            best = (int(cys.min()), int(cys.max()) + 1, int(cxs.mean()))
    if not best:
        return y0, y0 + int(0.17 * fig_h), int(cx_fig)
    top, bottom, cx = best
    head_bottom = min(bottom + int(0.02 * fig_h), y0 + int(0.20 * fig_h))
    return top, head_bottom, cx


def erase_head_disk(body: np.ndarray, top: int, head_bottom: int, cx: int) -> np.ndarray:
    out = body.copy()
    a = out[:, :, 3] > 40
    ry = max(18, (head_bottom - top) * 0.52)
    rx = ry * 0.80
    yy, xx = np.mgrid[0:H, 0:W]
    cy = (top + head_bottom) / 2 - ry * 0.12
    ellipse = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0
    clear = ellipse & (yy < head_bottom - 6)
    clear |= (yy < head_bottom - 10) & (np.abs(xx - cx) < rx * 1.15) & a
    out[clear, 3] = 0
    return out


def _studio_plate_like(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Warm off-white mannequin / studio leftovers — not pale body skin."""
    mx = rgb.max(axis=2)
    chroma = mx - rgb.min(axis=2)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    warm = (r > g - 8) & (r > b - 5)
    return (alpha > 0) & warm & (mx > 175) & (chroma < 42) & (r - g < 38)


def paste_head(
    body: np.ndarray, face: np.ndarray, head_bottom: int, cx: int, chin_frac: float
) -> tuple[np.ndarray, np.ndarray]:
    face = key_black_face(face)
    fa = face[:, :, 3] > 40
    fys, fxs = np.where(fa)
    face_crop = face[fys.min() : fys.max() + 1, fxs.min() : fxs.max() + 1]
    ba = body[:, :, 3] > 40
    y_sh = min(H - 1, head_bottom + 40)
    row = ba[y_sh]
    if row.any():
        xs = np.flatnonzero(row)
        sw = xs[-1] - xs[0]
    else:
        _bys, bxs = np.where(ba)
        sw = int(bxs.max() - bxs.min())
    target_w = max(150, int(sw * 0.68))
    scale = target_w / face_crop.shape[1]
    nh = max(1, int(round(face_crop.shape[0] * scale)))
    nw = max(1, int(round(face_crop.shape[1] * scale)))
    face_r = np.asarray(
        Image.fromarray(face_crop, 'RGBA').resize((nw, nh), Image.Resampling.LANCZOS)
    )
    chin_local = int(nh * chin_frac)
    paste_y = head_bottom - chin_local
    paste_x = int(cx - nw / 2)
    out = body.copy()

    # Clear mannequin head ellipse only — never touch chest / shoulder skin.
    yy, xx = np.mgrid[0:H, 0:W]
    ry = max(18, (head_bottom - (paste_y - 12)) * 0.55)
    rx = ry * 0.82
    cy = (paste_y + head_bottom) / 2 - ry * 0.08
    ellipse = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0
    wipe = ellipse & (yy < head_bottom + 4) & (out[:, :, 3] > 0)
    r = out[:, :, :3].astype(np.float32)
    green = _is_green_gear(r, out[:, :, 3])
    wipe &= ~green
    out[wipe, 3] = 0

    y0 = max(0, paste_y)
    x0 = max(0, paste_x)
    y1 = min(H, paste_y + nh)
    x1 = min(W, paste_x + nw)
    src = face_r[y0 - paste_y : y0 - paste_y + (y1 - y0), x0 - paste_x : x0 - paste_x + (x1 - x0)]
    dst = out[y0:y1, x0:x1]
    sa = src[:, :, 3:4].astype(np.float32) / 255.0
    out[y0:y1, x0:x1, :3] = (
        dst[:, :, :3].astype(np.float32) * (1 - sa) + src[:, :, :3].astype(np.float32) * sa
    ).astype(np.uint8)
    out[y0:y1, x0:x1, 3:4] = np.maximum(dst[:, :, 3:4], src[:, :, 3:4])

    face_mask = np.zeros((H, W), dtype=bool)
    face_mask[y0:y1, x0:x1] = src[:, :, 3] > 40
    return out, face_mask


def _is_green_gear(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0]
    g = rgb[:, :, 1]
    return (alpha > 40) & (g > r + 18) & (g > 80)


def _mannequin_flesh_plate(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Flat warm blocks from generated body refs (not caricature face)."""
    mx = rgb.max(axis=2)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    warm = (r > g - 10) & (r > b - 5)
    flat = (mx - rgb.min(axis=2)) < 55
    return (alpha > 40) & warm & flat & (r > 185) & (g > 155) & (b > 125) & (r - b < 65)


def _skin_seed(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    mx = rgb.max(axis=2)
    chroma = mx - rgb.min(axis=2)
    plate = _studio_plate_like(rgb, alpha) | _mannequin_flesh_plate(rgb, alpha)
    return (
        (alpha > 200)
        & (mx > 120)
        & (mx < 230)
        & (chroma < 70)
        & (rgb[:, :, 0] > rgb[:, :, 2] - 10)
        & ~plate
    )


def strip_mannequin_plate(arr: np.ndarray, face_mask: np.ndarray, pose: str) -> np.ndarray:
    """Drop generated shoulder plates while keeping face, gloves, and torso."""
    if not face_mask.any():
        return arr
    fys, fxs = np.where(face_mask)
    fy0, fy1, fx0, fx1 = int(fys.min()), int(fys.max()), int(fxs.min()), int(fxs.max())
    face_h = fy1 - fy0
    face_w = fx1 - fx0
    cx = (fx0 + fx1) // 2

    a = arr[:, :, 3] > 40
    if not a.any():
        return arr
    ys, xs = np.where(a)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())

    band_top = max(y0, fy0 - face_h // 6)
    band_bot = min(H, fy1 + face_h // 3)
    band = np.zeros((H, W), dtype=bool)
    band[band_top:band_bot, x0 : x1 + 1] = True

    rgb = arr[:, :, :3].astype(np.float32)
    alpha = arr[:, :, 3]
    green = _is_green_gear(rgb, alpha)
    plate = _studio_plate_like(rgb, alpha) | _mannequin_flesh_plate(rgb, alpha)
    keep = ndimage.binary_dilation(face_mask, iterations=14) | green
    kill = band & a & plate & ~keep

    if pose == 'idle':
        chest = np.zeros((H, W), dtype=bool)
        chest[
            fy1 : min(H, fy1 + int(face_h * 0.55)),
            max(0, cx - int(face_w * 0.75)) : min(W, cx + int(face_w * 0.75) + 1),
        ] = True
        kill |= chest & a & plate & ~green & ~keep

    if not kill.any():
        return arr
    out = arr.copy()
    out[kill, 3] = 0
    return out


def bridge_neck_column(arr: np.ndarray, face_mask: np.ndarray, cx: int) -> np.ndarray:
    """Fill a narrow transparent column between chin and the main torso."""
    a = arr[:, :, 3]
    fys, _ = np.where(face_mask)
    if len(fys) == 0:
        return arr
    chin_y = int(fys.max())

    torso_y = None
    for y in range(chin_y + 2, min(H, chin_y + 220)):
        row = a[y] > 200
        if not row.any():
            continue
        xs = np.flatnonzero(row)
        if xs[-1] - xs[0] >= 140:
            torso_y = y
            break
    if torso_y is None or torso_y <= chin_y + 2:
        return arr

    zone = np.zeros_like(a, dtype=bool)
    zone[chin_y + 1 : torso_y, cx - NECK_HALF_W : cx + NECK_HALF_W] = True
    need = zone & (a < 40)
    if not need.any():
        return arr

    rgb = arr[:, :, :3].astype(np.float32)
    skin = _skin_seed(rgb, a)
    if not skin.any():
        return arr
    _, (iy, ix) = ndimage.distance_transform_edt(~skin, return_indices=True)
    out = arr.copy()
    ys, xs = np.where(need)
    out[ys, xs, :3] = arr[iy[ys, xs], ix[ys, xs], :3]
    out[ys, xs, 3] = 255
    return out


def purge_plate_pixels(arr: np.ndarray, face_mask: np.ndarray) -> np.ndarray:
    """Remove any remaining mannequin plate tint before sealing."""
    rgb = arr[:, :, :3].astype(np.float32)
    alpha = arr[:, :, 3]
    plate = _studio_plate_like(rgb, alpha) | _mannequin_flesh_plate(rgb, alpha)
    green = _is_green_gear(rgb, alpha)
    keep = ndimage.binary_dilation(face_mask, iterations=12) | green
    kill = plate & (alpha > 0) & ~keep
    if not kill.any():
        return arr
    out = arr.copy()
    out[kill, 3] = 0
    return out


def weld_head_to_body(arr: np.ndarray, face_mask: np.ndarray, cx: int) -> np.ndarray:
    """Connect disconnected face and torso components with a narrow neck weld."""
    a = arr[:, :, 3]
    fys, _ = np.where(face_mask)
    if len(fys) == 0:
        return arr
    chin_y = int(fys.max())
    labeled, n = ndimage.label(a > 40)
    if n < 2:
        return arr
    face_lab = int(labeled[face_mask][0])
    sizes = [(i, int((labeled == i).sum())) for i in range(1, n + 1)]
    body_lab = max(sizes, key=lambda t: t[1])[0]
    if face_lab == body_lab:
        return arr

    rgb = arr[:, :, :3].astype(np.float32)
    skin = _skin_seed(rgb, a)
    if not skin.any():
        return arr
    _, (iy, ix) = ndimage.distance_transform_edt(~skin, return_indices=True)
    out = arr.copy()
    col_x0, col_x1 = cx - NECK_HALF_W, cx + NECK_HALF_W
    for y in range(chin_y, min(H, chin_y + 260)):
        row_labs = labeled[y, col_x0:col_x1]
        if np.any(row_labs == body_lab):
            break
        gap = a[y, col_x0:col_x1] < 40
        if not gap.any():
            continue
        xs = np.flatnonzero(gap) + col_x0
        out[y, xs, :3] = arr[iy[y, xs], ix[y, xs], :3]
        out[y, xs, 3] = 255
    return out


def fill_neck_gap(arr: np.ndarray, head_bottom: int) -> np.ndarray:
    a = arr[:, :, 3]
    rgb = arr[:, :, :3].astype(np.float32)
    skin = _skin_seed(rgb, a)
    zone = np.zeros_like(a, dtype=bool)
    zone[
        max(0, head_bottom - 28) : head_bottom + 24,
        W // 2 - NECK_HALF_W : W // 2 + NECK_HALF_W,
    ] = True
    need = zone & (a < 40)
    if not need.any() or not skin.any():
        return arr
    _, (iy, ix) = ndimage.distance_transform_edt(~skin, return_indices=True)
    out = arr.copy()
    ys, xs = np.where(need)
    out[ys, xs, :3] = arr[iy[ys, xs], ix[ys, xs], :3]
    out[ys, xs, 3] = 255
    return out


def armpit_clear_mask(body: np.ndarray) -> np.ndarray:
    """Triangular wedges under each shoulder — stay transparent on ooh pose."""
    solid = body[:, :, 3] > 40
    if not solid.any():
        return np.zeros(solid.shape, dtype=bool)
    ys, xs = np.where(solid)
    y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    fig_h, fig_w = y1 - y0, x1 - x0

    mask = np.zeros(solid.shape, dtype=bool)
    y_top = y0 + int(0.165 * fig_h)
    y_bot = y0 + int(0.335 * fig_h)
    for y in range(y_top, y_bot):
        t = (y - y_top) / max(1, y_bot - y_top - 1)
        lx0 = x0 + int(fig_w * (0.10 + 0.06 * t))
        lx1 = x0 + int(fig_w * (0.20 + 0.04 * (1 - t)))
        mask[y, lx0:lx1] = True
        rx1 = x1 - int(fig_w * (0.10 + 0.06 * t))
        rx0 = x1 - int(fig_w * (0.20 + 0.04 * (1 - t)))
        mask[y, rx0:rx1] = True

    hull = ndimage.binary_fill_holes(ndimage.binary_closing(solid, iterations=3))
    near = ndimage.binary_dilation(solid, iterations=20)
    return mask & hull & near


def overlay_face_from_pack(
    arr: np.ndarray, packed_mask: np.ndarray, face_path: Path, chin_frac: float
) -> tuple[np.ndarray, np.ndarray]:
    """Re-paste the face pack on top after body sealing so crown and features stay crisp."""
    fys, fxs = np.where(packed_mask)
    if len(fys) == 0:
        return arr, packed_mask
    fy0, fy1, fx0, fx1 = int(fys.min()), int(fys.max()), int(fxs.min()), int(fxs.max())
    face_h = fy1 - fy0 + 1
    face_w = fx1 - fx0 + 1
    cx = (fx0 + fx1) // 2
    crown_pad = max(10, int(face_h * 0.12))
    fy0 = max(0, fy0 - crown_pad)
    target_h = fy1 - fy0 + 1

    face = key_black_face(np.asarray(Image.open(face_path).convert('RGBA')))
    fa = face[:, :, 3] > 40
    fys2, fxs2 = np.where(fa)
    face_crop = face[fys2.min() : fys2.max() + 1, fxs2.min() : fxs2.max() + 1]
    scale = min(face_w / face_crop.shape[1], target_h / face_crop.shape[0])
    nh = max(1, int(round(face_crop.shape[0] * scale)))
    nw = max(1, int(round(face_crop.shape[1] * scale)))
    face_r = np.asarray(
        Image.fromarray(face_crop, 'RGBA').resize((nw, nh), Image.Resampling.LANCZOS)
    )
    chin_local = int(nh * chin_frac)
    paste_y = fy1 - chin_local
    paste_x = int(cx - nw / 2)

    out = arr.copy()
    y0 = max(0, paste_y)
    x0 = max(0, paste_x)
    y1 = min(H, paste_y + nh)
    x1 = min(W, paste_x + nw)
    src = face_r[
        y0 - paste_y : y0 - paste_y + (y1 - y0),
        x0 - paste_x : x0 - paste_x + (x1 - x0),
    ]
    dst = out[y0:y1, x0:x1]
    sa = src[:, :, 3:4].astype(np.float32) / 255.0
    out[y0:y1, x0:x1, :3] = (
        dst[:, :, :3].astype(np.float32) * (1 - sa) + src[:, :, :3].astype(np.float32) * sa
    ).astype(np.uint8)
    out[y0:y1, x0:x1, 3:4] = np.maximum(dst[:, :, 3:4], src[:, :, 3:4])

    face_mask = np.zeros((H, W), dtype=bool)
    face_mask[y0:y1, x0:x1] = src[:, :, 3] > 40
    return out, face_mask


def fill_internal_face_holes(arr: np.ndarray, face_mask: np.ndarray) -> np.ndarray:
    """Fill accidental transparent specks inside the pasted face without touching the body."""
    if not face_mask.any():
        return arr
    region = ndimage.binary_dilation(face_mask, iterations=2)
    alpha = arr[:, :, 3]
    rgb = arr[:, :, :3].astype(np.float32)
    holes = region & (alpha < 40)
    if not holes.any():
        return arr
    known = region & (alpha >= 200) & (rgb.max(axis=2) > 8)
    if not known.any():
        return arr
    out = arr.copy()
    _, (iy, ix) = ndimage.distance_transform_edt(~known, return_indices=True)
    ys, xs = np.where(holes)
    out[ys, xs, :3] = arr[iy[ys, xs], ix[ys, xs], :3]
    out[ys, xs, 3] = 255
    return out


def expand_face_mask(face_mask: np.ndarray) -> np.ndarray:
    """Include crown cap and cheek fringe so keying gaps do not survive sealing."""
    if not face_mask.any():
        return face_mask
    fys, fxs = np.where(face_mask)
    fy0, fy1 = int(fys.min()), int(fys.max())
    fx0, fx1 = int(fxs.min()), int(fxs.max())
    face_h = fy1 - fy0 + 1
    face_w = fx1 - fx0 + 1
    cx = (fx0 + fx1) // 2
    out = face_mask.copy()
    crown_h = max(12, int(face_h * 0.16))
    for i in range(crown_h):
        y = fy0 - crown_h + i
        if y < 0:
            continue
        t = (i + 1) / crown_h
        half_w = max(3, int(face_w * 0.24 * t))
        out[y, cx - half_w : cx + half_w + 1] = True
    out |= ndimage.binary_dilation(face_mask, iterations=max(8, int(face_h * 0.05)))
    return out


def solidify_face_region(arr: np.ndarray, face_mask: np.ndarray) -> np.ndarray:
    """Force the pasted face fully opaque — seal closing must not eat the crown."""
    if not face_mask.any():
        return arr
    region = expand_face_mask(face_mask)
    out = arr.copy()
    rgb = out[:, :, :3].astype(np.float32)
    alpha = out[:, :, 3]
    need = region & (alpha < 255)
    if not need.any():
        return out
    known = region & (alpha >= 200) & (rgb.max(axis=2) > 8)
    if known.any():
        _, (iy, ix) = ndimage.distance_transform_edt(~known, return_indices=True)
        ys, xs = np.where(need)
        out[ys, xs, :3] = out[iy[ys, xs], ix[ys, xs], :3]
    out[region, 3] = 255
    return out


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


def seal_silhouette(
    im: Image.Image,
    close_iters: int = SEAL_CLOSE_ITERS,
    face_mask: np.ndarray | None = None,
    allow_clear: np.ndarray | None = None,
) -> Image.Image:
    a = np.array(im.convert('RGBA'))
    alpha = a[:, :, 3]
    rgb = a[:, :, :3].astype(np.float32)
    mx = rgb.max(axis=2)
    body = alpha > 40
    if face_mask is not None and face_mask.any():
        body = body | expand_face_mask(face_mask)
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
        claim |= (~silhouette) & (n4 >= 4)
        if not claim.any():
            break
        silhouette = silhouette | claim
    silhouette = ndimage.binary_fill_holes(silhouette)
    labeled, n = ndimage.label(silhouette)
    if n > 1:
        sizes = ndimage.sum(silhouette, labeled, range(1, n + 1))
        keep = int(np.argmax(sizes)) + 1
        keep_labels = {keep}
        if face_mask is not None and face_mask.any():
            keep_labels |= set(int(x) for x in np.unique(labeled[face_mask]) if x > 0)
        silhouette = np.isin(labeled, list(keep_labels))
    if face_mask is not None and face_mask.any():
        silhouette = silhouette | expand_face_mask(face_mask)
    if allow_clear is not None:
        silhouette = silhouette & ~allow_clear
    known = body & silhouette & (mx > 4)
    need = silhouette & ((alpha < 255) | (mx <= 4))
    rgb = _horizontal_paint(rgb, need, known)
    still = silhouette & ((alpha < 255) | (rgb.max(axis=2) <= 4))
    rgb = _nearest_color(rgb, still, known)
    out = a.copy()
    out[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[:, :, 3] = np.where(silhouette, 255, 0).astype(np.uint8)
    return Image.fromarray(out)


def pack_fit(
    im: Image.Image,
    face_mask: np.ndarray | None = None,
    allow_clear: np.ndarray | None = None,
) -> tuple[Image.Image, np.ndarray | None, np.ndarray | None]:
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 40)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    crop = Image.fromarray(a).crop((x0, y0, x1 + 1, y1 + 1))
    fw, fh = crop.size
    sole_y = int(H * (1 - FEET_SOLE)) - 1
    avail_h = sole_y - TOP_PAD
    avail_w = W - 2 * SIDE_PAD
    scale = min(avail_w / fw, avail_h / fh) * 0.98

    packed_mask = None
    packed_clear = None
    if face_mask is not None and face_mask.any():
        fys, fxs = np.where(face_mask)
        face_h = int(fys.max() - fys.min()) + 1
        max_scale = (avail_h - 12) / max(fh, 1)
        head_room = TOP_PAD + int(face_h * 0.12)
        head_scale = (avail_h - head_room) / max(face_h, 1) / max(face_h / max(fh, 1), 0.05)
        scale = min(scale, head_scale, max_scale)

    nw, nh = max(1, int(round(fw * scale))), max(1, int(round(fh * scale)))
    scaled = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    paste_x = (W - nw) // 2
    paste_y = max(TOP_PAD + 8, sole_y - nh + 1)
    canvas.paste(scaled, (paste_x, paste_y), scaled)

    if face_mask is not None and face_mask.any():
        fm_crop = face_mask[y0 : y1 + 1, x0 : x1 + 1].astype(np.uint8) * 255
        fm_scaled = np.asarray(
            Image.fromarray(fm_crop).resize((nw, nh), Image.Resampling.NEAREST)
        ) > 128
        packed_mask = np.zeros((H, W), dtype=bool)
        packed_mask[paste_y : paste_y + nh, paste_x : paste_x + nw] = fm_scaled

    if allow_clear is not None and allow_clear.any():
        ac_crop = allow_clear[y0 : y1 + 1, x0 : x1 + 1].astype(np.uint8) * 255
        ac_scaled = np.asarray(
            Image.fromarray(ac_crop).resize((nw, nh), Image.Resampling.NEAREST)
        ) > 128
        packed_clear = np.zeros((H, W), dtype=bool)
        packed_clear[paste_y : paste_y + nh, paste_x : paste_x + nw] = ac_scaled

    return canvas, packed_mask, packed_clear


def assert_head_present(im: Image.Image, pose: str) -> None:
    arr = np.asarray(im)
    ys = np.where(arr[:, :, 3] > 40)[0]
    if len(ys) == 0:
        raise SystemExit(f'{pose}: empty figure')
    top_y = int(ys.min())
    head_band = arr[top_y : top_y + 180, :, 3] > 40
    if head_band.sum() < 8000:
        raise SystemExit(f'{pose}: head missing after pack (top_y={top_y}, band={head_band.sum()})')


def strip_exterior_pale(arr: np.ndarray) -> np.ndarray:
    a = arr[:, :, 3]
    rgb = arr[:, :, :3].astype(np.int16)
    mx = rgb.max(axis=2)
    chroma = mx - rgb.min(axis=2)
    pale = (a > 0) & (mx > 200) & (chroma < 35)
    gray = (a > 0) & (mx > 160) & (mx < 235) & (chroma < 25)
    clear = a < 8
    exterior = _edge_flood(pale | gray | clear)
    frac = ndimage.uniform_filter(((a > 200) & ~pale & ~gray).astype(np.float32), size=7)
    kill = exterior & (pale | gray) & (frac < 0.35)
    out = arr.copy()
    out[kill, 3] = 0
    return out


def fill_tiny_holes(
    arr: np.ndarray, allow_clear: np.ndarray | None = None, max_size: int = 6
) -> np.ndarray:
    """Close pinhole gaps left by armpit carving or face overlay seams."""
    out = arr.copy()
    alpha = out[:, :, 3]
    opaque = alpha == 255
    holes = ndimage.binary_fill_holes(opaque) & ~opaque
    if allow_clear is not None:
        holes = holes & ~allow_clear
    labeled, n = ndimage.label(holes)
    if n == 0:
        return out
    known = opaque
    _, (iy, ix) = ndimage.distance_transform_edt(~known, return_indices=True)
    for i in range(1, n + 1):
        comp = labeled == i
        if int(comp.sum()) > max_size:
            continue
        out[comp, :3] = arr[iy[comp], ix[comp], :3]
        out[comp, 3] = 255
    return out


def assert_solid(
    im: Image.Image, name: str, allow_clear: np.ndarray | None = None
) -> None:
    a = np.array(im)
    alpha = a[:, :, 3]
    soft = int(((alpha > 0) & (alpha < 255)).sum())
    opaque = alpha == 255
    holes = int((ndimage.binary_fill_holes(opaque) & ~opaque).sum())
    clear_zone = alpha < 128
    if allow_clear is not None:
        clear_zone = clear_zone & ~allow_clear
    interior_clear = (~_edge_flood(clear_zone)) & (alpha < 255)
    if allow_clear is not None:
        interior_clear = interior_clear & ~allow_clear
    clear_inside = int(interior_clear.sum())
    frac = ndimage.uniform_filter(opaque.astype(np.float32), size=11)
    surrounded_mask = (alpha < 128) & (frac > 0.55)
    if allow_clear is not None:
        surrounded_mask = surrounded_mask & ~allow_clear
    surrounded = int(surrounded_mask.sum())
    if soft or holes or clear_inside or surrounded > 200:
        raise SystemExit(
            f'{name} not solid: soft={soft} holes={holes} '
            f'clear_inside={clear_inside} surrounded={surrounded}'
        )
    print(f'{name}: solid opaque={int(opaque.sum())} surrounded={surrounded}')


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
    """Refresh Options / bag / bobo face packs from user-provided full renders."""
    idle_path = USER_IMPORTS.get('idle')
    ooh_path = USER_IMPORTS.get('ooh')
    if idle_path and idle_path.exists():
        idle = key_white_bg_safe(np.asarray(Image.open(idle_path).convert('RGBA')))
        Image.fromarray(extract_face_pack(idle)).save(FACES / 'clean.png', optimize=True)
    if ooh_path and ooh_path.exists():
        ooh = key_white_bg_safe(np.asarray(Image.open(ooh_path).convert('RGBA')))
        pack = extract_face_pack(ooh)
        Image.fromarray(pack).save(FACES / 'ooh.png', optimize=True)
        ko_src = USER_KNOCKOUT_FACE if USER_KNOCKOUT_FACE.exists() else ooh_path
        if ko_src == ooh_path:
            Image.fromarray(pack).save(FACES / 'knockout.png', optimize=True)
        else:
            ko = key_white_bg_safe(np.asarray(Image.open(ko_src).convert('RGBA')))
            Image.fromarray(extract_face_pack(ko)).save(FACES / 'knockout.png', optimize=True)


def process_imported_render(path: Path, pose: str) -> tuple[Image.Image, np.ndarray | None]:
    """Pack and seal a user-authored full-body ring pose."""
    arr = key_white_bg_safe(np.asarray(Image.open(path).convert('RGBA')))
    allow_clear = armpit_clear_mask(arr) if pose == 'ooh' else None
    if allow_clear is not None:
        arr = arr.copy()
        arr[allow_clear, 3] = 0
    sealed = seal_silhouette(Image.fromarray(arr), allow_clear=allow_clear)
    packed, _, packed_clear = pack_fit(sealed, allow_clear=allow_clear)
    packed_allow = (
        ndimage.binary_dilation(packed_clear, iterations=2)
        if packed_clear is not None
        else None
    )
    packed = seal_silhouette(packed, allow_clear=packed_allow, close_iters=6)
    assert_head_present(packed, pose)
    final_arr = np.asarray(packed).copy()
    if packed_allow is not None:
        final_arr[packed_allow] = (0, 0, 0, 0)
    final_arr[:, :, 3] = np.where(final_arr[:, :, 3] > 40, 255, 0).astype(np.uint8)
    final_arr = fill_tiny_holes(final_arr, allow_clear=packed_allow)
    return Image.fromarray(final_arr), packed_allow


def save_pose_outputs(pose: str, packed: Image.Image, sealed: Image.Image | None = None) -> None:
    packed.save(OUT / f'greenie-{pose}.png', optimize=True)
    if sealed is not None:
        Image.fromarray(np.asarray(sealed)).save(SRC / f'{pose}-composited.png')
    thumb = packed.resize((128, 192), Image.Resampling.LANCZOS)
    t = np.array(thumb.convert('RGBA'))
    t[:, :, 3] = np.where(t[:, :, 3] > 40, 255, 0).astype(np.uint8)
    Image.fromarray(np.array(seal_silhouette(Image.fromarray(t), close_iters=3))).save(
        OUT / f'greenie-{pose}-thumb.png', optimize=True
    )
    print('wrote', pose)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sync_user_face_packs()
    for pose, body_name, face_name, chin_frac in JOBS:
        import_path = USER_IMPORTS.get(pose)
        if import_path and import_path.exists():
            packed, packed_allow = process_imported_render(import_path, pose)
            assert_solid(packed, pose, allow_clear=packed_allow)
            save_pose_outputs(pose, packed)
            continue

        body_path = SRC / body_name
        face_path = FACES / face_name
        if not body_path.exists():
            raise SystemExit(f'missing body ref {body_path}')
        if not face_path.exists():
            raise SystemExit(f'missing face {face_path}')
        body = key_white_bg_safe(np.asarray(Image.open(body_path).convert('RGBA')))
        top, head_bottom, cx = detect_mannequin_head(body)
        body2 = erase_head_disk(body, top, head_bottom, cx)
        allow_clear = armpit_clear_mask(body2) if pose == 'ooh' else None
        face = np.asarray(Image.open(face_path).convert('RGBA'))
        composited, face_mask = paste_head(body2, face, head_bottom, cx, chin_frac)
        composited = solidify_face_region(composited, face_mask)
        if allow_clear is not None:
            composited = composited.copy()
            composited[allow_clear, 3] = 0
        composited = bridge_neck_column(composited, face_mask, cx)
        composited = weld_head_to_body(composited, face_mask, cx)
        composited = fill_neck_gap(composited, head_bottom)
        composited = solidify_face_region(composited, face_mask)
        sealed = seal_silhouette(
            Image.fromarray(composited), face_mask=face_mask, allow_clear=allow_clear
        )
        packed, packed_face, packed_clear = pack_fit(sealed, face_mask, allow_clear)
        packed_mask = packed_face if packed_face is not None else face_mask
        packed_allow = packed_clear if packed_clear is not None else allow_clear
        if packed_allow is not None:
            packed_allow = ndimage.binary_dilation(packed_allow, iterations=2)
        packed = seal_silhouette(
            packed, face_mask=packed_mask, allow_clear=packed_allow
        )
        assert_head_present(packed, pose)
        body_arr = np.asarray(packed).copy()
        body_arr[packed_mask] = (0, 0, 0, 0)
        body_sealed = seal_silhouette(
            Image.fromarray(body_arr),
            close_iters=6,
            allow_clear=packed_allow,
        )
        final_arr, final_face = overlay_face_from_pack(
            np.asarray(body_sealed), packed_mask, face_path, chin_frac
        )
        final_arr = fill_internal_face_holes(final_arr, final_face)
        if packed_allow is not None:
            final_arr[packed_allow] = (0, 0, 0, 0)
        final_arr[:, :, 3] = np.where(final_arr[:, :, 3] > 40, 255, 0).astype(np.uint8)
        final_arr = fill_tiny_holes(final_arr, allow_clear=packed_allow)
        packed = Image.fromarray(final_arr)
        assert_solid(packed, pose, allow_clear=packed_allow)
        save_pose_outputs(pose, packed, sealed=sealed)


if __name__ == '__main__':
    main()
