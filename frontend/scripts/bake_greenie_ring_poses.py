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
OUT = ROOT / 'public/boxer/bodies'
SRC = OUT / 'greenie-source-refs'
FACES = ROOT / 'public/faces/characters/the-greenie'
W, H = 1024, 1536
FEET_SOLE = 0.0664
TOP_PAD = 56
SIDE_PAD = 36

SEAL_CLOSE_ITERS = 8
SURROUND_FILL_PASSES = 16
SURROUND_KERNEL = 13
SURROUND_FRAC = 0.55

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
    rgb = arr[:, :, :3].astype(np.int16)
    a = arr[:, :, 3]
    mx = rgb.max(axis=2)
    chroma = mx - rgb.min(axis=2)
    corner = rgb[2, 2]
    dist = np.abs(rgb - corner).sum(axis=2)
    studio = ((mx > 245) & (chroma < 18)) | ((mx > 238) & (chroma < 12)) | (dist <= 18) | (a < 8)
    exterior = _edge_flood(studio)
    protect = (chroma > 12) | (mx < 230)
    for _ in range(2):
        grown = ndimage.binary_dilation(exterior, iterations=1) & ~protect
        claim = grown & (((mx > 242) & (chroma < 20)) | (a < 40) | (dist <= 22))
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


def paste_head(
    body: np.ndarray, face: np.ndarray, head_bottom: int, cx: int, chin_frac: float
) -> np.ndarray:
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
    return out


def fill_neck_gap(arr: np.ndarray, head_bottom: int) -> np.ndarray:
    a = arr[:, :, 3]
    rgb = arr[:, :, :3].astype(np.float32)
    mx = rgb.max(axis=2)
    chroma = mx - rgb.min(axis=2)
    skin = (
        (a > 200)
        & (mx > 120)
        & (mx < 230)
        & (chroma < 70)
        & (rgb[:, :, 0] > rgb[:, :, 2] - 10)
    )
    zone = np.zeros_like(a, dtype=bool)
    zone[max(0, head_bottom - 80) : head_bottom + 90, W // 2 - 180 : W // 2 + 180] = True
    need = zone & (a < 40)
    frac = ndimage.uniform_filter((a > 200).astype(np.float32), size=11)
    need |= zone & (a < 128) & (frac > 0.45)
    if not need.any() or not skin.any():
        return arr
    _, (iy, ix) = ndimage.distance_transform_edt(~skin, return_indices=True)
    out = arr.copy()
    ys, xs = np.where(need)
    out[ys, xs, :3] = arr[iy[ys, xs], ix[ys, xs], :3]
    out[ys, xs, 3] = 255
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


def seal_silhouette(im: Image.Image, close_iters: int = SEAL_CLOSE_ITERS) -> Image.Image:
    a = np.array(im.convert('RGBA'))
    alpha = a[:, :, 3]
    rgb = a[:, :, :3].astype(np.float32)
    mx = rgb.max(axis=2)
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
    need = silhouette & ((alpha < 255) | (mx <= 4))
    rgb = _horizontal_paint(rgb, need, known)
    still = silhouette & ((alpha < 255) | (rgb.max(axis=2) <= 4))
    rgb = _nearest_color(rgb, still, known)
    out = a.copy()
    out[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[:, :, 3] = np.where(silhouette, 255, 0).astype(np.uint8)
    return Image.fromarray(out)


def pack_fit(im: Image.Image) -> Image.Image:
    a = np.array(im)
    ys, xs = np.where(a[:, :, 3] > 40)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    crop = Image.fromarray(a).crop((x0, y0, x1 + 1, y1 + 1))
    fw, fh = crop.size
    sole_y = int(H * (1 - FEET_SOLE)) - 1
    avail_h = sole_y - TOP_PAD
    avail_w = W - 2 * SIDE_PAD
    scale = min(avail_w / fw, avail_h / fh) * 0.98
    nw, nh = max(1, int(round(fw * scale))), max(1, int(round(fh * scale)))
    scaled = crop.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    paste_x = (W - nw) // 2
    paste_y = sole_y - nh + 1
    if paste_y < TOP_PAD // 2:
        paste_y = TOP_PAD // 2
    canvas.paste(scaled, (paste_x, paste_y), scaled)
    return canvas


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


def assert_solid(im: Image.Image, name: str) -> None:
    a = np.array(im)
    alpha = a[:, :, 3]
    soft = int(((alpha > 0) & (alpha < 255)).sum())
    opaque = alpha == 255
    holes = int((ndimage.binary_fill_holes(opaque) & ~opaque).sum())
    clear_inside = int(((~_edge_flood(alpha < 128)) & (alpha < 255)).sum())
    frac = ndimage.uniform_filter(opaque.astype(np.float32), size=11)
    surrounded = int(((alpha < 128) & (frac > 0.55)).sum())
    if soft or holes or clear_inside or surrounded > 200:
        raise SystemExit(
            f'{name} not solid: soft={soft} holes={holes} '
            f'clear_inside={clear_inside} surrounded={surrounded}'
        )
    print(f'{name}: solid opaque={int(opaque.sum())} surrounded={surrounded}')


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for pose, body_name, face_name, chin_frac in JOBS:
        body_path = SRC / body_name
        face_path = FACES / face_name
        if not body_path.exists():
            raise SystemExit(f'missing body ref {body_path}')
        if not face_path.exists():
            raise SystemExit(f'missing face {face_path}')
        body = key_white_bg_safe(np.asarray(Image.open(body_path).convert('RGBA')))
        top, head_bottom, cx = detect_mannequin_head(body)
        body2 = erase_head_disk(body, top, head_bottom, cx)
        face = np.asarray(Image.open(face_path).convert('RGBA'))
        composited = paste_head(body2, face, head_bottom, cx, chin_frac)
        composited = fill_neck_gap(composited, head_bottom)
        sealed = seal_silhouette(Image.fromarray(composited))
        packed = seal_silhouette(pack_fit(sealed))
        pa = np.asarray(packed)
        ys, xs = np.where(pa[:, :, 3] > 200)
        approx_neck = ys.min() + int(0.22 * (ys.max() - ys.min()))
        pa = fill_neck_gap(pa, approx_neck)
        pa = strip_exterior_pale(pa)
        packed = seal_silhouette(Image.fromarray(pa))
        assert_solid(packed, pose)
        packed.save(OUT / f'greenie-{pose}.png', optimize=True)
        Image.fromarray(np.asarray(packed)).save(SRC / f'{pose}-composited.png')
        thumb = packed.resize((128, 192), Image.Resampling.LANCZOS)
        t = np.array(thumb.convert('RGBA'))
        t[:, :, 3] = np.where(t[:, :, 3] > 40, 255, 0).astype(np.uint8)
        Image.fromarray(np.array(seal_silhouette(Image.fromarray(t), close_iters=3))).save(
            OUT / f'greenie-{pose}-thumb.png', optimize=True
        )
        print('wrote', pose)


if __name__ == '__main__':
    main()
