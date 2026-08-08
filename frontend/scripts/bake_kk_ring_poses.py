#!/usr/bin/env python3
"""Bake KK whole-body ring poses from body-kk + face pack.

Fixes applied for solid silhouette methodology test:
- Seal interior holes / weak alpha (nothing clear inside silhouette)
- Inpaint pale yellow-white broken highlights (read as clear patches)
- Convert yellow outline + gold skin patches to pink accents
- Lift small crushed-black islands that read as holes on dark backgrounds
- Fit face with top margin so the crown is not cropped

Idle = gloves up. Ooh = gloves drop. Knockout = hands fully down.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
BODY_SRC = PUBLIC / 'boxer/bodies/body-kk.png'
FACE_ROOT = PUBLIC / 'faces/characters/kk'
OUT_DIR = PUBLIC / 'boxer/bodies'

FACE_RECT = [0.4082, 0.0215, 0.6064, 0.179]


def nearest_fill(a: np.ndarray, mask: np.ndarray, solid: np.ndarray) -> np.ndarray:
    if not mask.any():
        return a
    a = a.copy()
    _, (iy, ix) = ndimage.distance_transform_edt(~solid, return_indices=True)
    a[mask] = a[iy, ix][mask]
    a[mask, 3] = 255
    return a


def seal(a: np.ndarray, close_iter: int = 3, neighbor_passes: int = 12) -> np.ndarray:
    al = a[:, :, 3]
    solid = al > 180
    soft = (al > 0) & (al <= 180)
    sil = ndimage.binary_closing(solid | soft, iterations=close_iter)
    filled = ndimage.binary_fill_holes(sil)
    a = nearest_fill(a, filled & ~(al > 180), al > 180)
    a[filled, 3] = 255
    a[~filled, 3] = 0
    kernel = np.ones((3, 3), np.float32)
    kernel[1, 1] = 0
    for _ in range(neighbor_passes):
        al = a[:, :, 3]
        opaque = al > 200
        neigh = ndimage.convolve(opaque.astype(np.float32), kernel, mode='constant')
        todo = ((~opaque) & (neigh >= 5)) | ((al > 0) & (al <= 200) & (neigh >= 3))
        if not todo.any():
            break
        a = nearest_fill(a, todo, opaque)
    filled = ndimage.binary_fill_holes(ndimage.binary_closing(a[:, :, 3] > 40, iterations=2))
    a[filled, 3] = 255
    a[~filled, 3] = 0
    return a


def is_pale(r: np.ndarray, g: np.ndarray, b: np.ndarray, al: np.ndarray) -> np.ndarray:
    opaque = al > 40
    return opaque & (r > 175) & (g > 145) & (b > 70) & ((r.astype(int) + g) > (2 * b + 30))


def repair_pale(a: np.ndarray) -> np.ndarray:
    r, g, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    pale = is_pale(r, g, b, al)
    good = (al > 200) & ~pale
    return nearest_fill(a, pale, good)


def lift_dark_islands(a: np.ndarray, max_size: int = 900) -> np.ndarray:
    """Fill small crushed-black islands that read as clear holes on dark UIs."""
    r, g, b = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)
    al = a[:, :, 3]
    opaque = al > 40
    mx = np.maximum(np.maximum(r, g), b)
    dark = opaque & (mx < 42)
    good = opaque & (mx >= 60)
    lab, n = ndimage.label(dark)
    cand = np.zeros_like(dark)
    for i in range(1, n + 1):
        m = lab == i
        s = int(m.sum())
        if s < 3 or s > max_size:
            continue
        dil = ndimage.binary_dilation(m, iterations=2)
        border = dil & ~m & opaque
        if border.sum() == 0:
            continue
        if (good[border]).mean() < 0.4:
            continue
        cand |= m
    return nearest_fill(a, cand, good)


def yellow_to_pink(a: np.ndarray) -> np.ndarray:
    a = a.copy()
    r = a[:, :, 0].astype(np.float32)
    g = a[:, :, 1].astype(np.float32)
    b = a[:, :, 2].astype(np.float32)
    al = a[:, :, 3]
    opaque = al > 40
    eroded = ndimage.binary_erosion(opaque, iterations=3)
    rim = opaque & ~eroded
    rim_warm = rim & (r > 90) & (r >= g - 8)
    a[rim_warm, 0] = np.clip(np.maximum(r[rim_warm], 205), 205, 255).astype(np.uint8)
    a[rim_warm, 1] = np.clip(g[rim_warm] * 0.26 + 50, 45, 110).astype(np.uint8)
    a[rim_warm, 2] = np.clip(b[rim_warm] * 0.35 + 130, 125, 210).astype(np.uint8)
    yellow = opaque & (r > 195) & (g > 135) & (b < 125) & ((r - b) > 85) & ((g - b) > 30)
    strength = np.clip(((g - b) / np.maximum(r - b, 1) - 0.3) / 0.5, 0, 1) * yellow
    a[:, :, 1] = np.clip(g * (1 - 0.75 * strength) + 50 * strength, 0, 255).astype(np.uint8)
    a[:, :, 2] = np.clip(b * (1 - 0.4 * strength) + (g * 0.45 + 55) * strength, 0, 255).astype(np.uint8)
    return a


def clear_blank_head(a: np.ndarray) -> np.ndarray:
    h, w = a.shape[:2]
    fr = FACE_RECT
    y0, y1 = int(fr[1] * h) - 8, int(fr[3] * h) + 55
    x0, x1 = int(fr[0] * w) - 45, int(fr[2] * w) + 45
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            r, g, b, al = map(int, a[y, x])
            if al < 40:
                continue
            if (r > 160 and 80 < g < 200 and b < 120 and r > g and r - b > 60) or (
                r > 180 and g > 110 and b < 100 and abs(r - g) < 80
            ):
                a[y, x, 3] = 0
    return a


def is_hanging_hair(r: int, g: int, b: int, a: int) -> bool:
    if a < 40:
        return False
    mx, mn = max(r, g, b), min(r, g, b)
    if mx < 48:
        return True
    if mx <= 140 and r >= g - 6 and g >= b - 18 and mx - mn < 70 and r > 25:
        return True
    if r > 120 and r - b > 55 and r > g + 8 and b < 120 and mx < 250:
        return True
    return False


def is_neck_skin(r: int, g: int, b: int, a: int) -> bool:
    if a < 40:
        return False
    if r < 70 or g < 35 or b < 15:
        return False
    if r < g - 8 or g < b - 20:
        return False
    return r - b > 25 and r > 90


def face_layers(face_img: Image.Image, dest_w: int, dest_h: int, top_margin: int = 60):
    fw, fh = face_img.size
    x0, y0, x1, y1 = FACE_RECT
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    scale = 1.05 * 1.02 * 1.02 * 1.04 * 0.74
    half_w = (x1 - x0) / 2 * scale * 1.15
    half_h = (y1 - y0) / 2 * scale * 1.25
    contain = min((2 * half_w * dest_w) / fw, (2 * half_h * dest_h) / fh) * 0.94
    draw_w, draw_h = int(fw * contain), int(fh * contain)
    face_r = face_img.resize((draw_w, draw_h), Image.Resampling.LANCZOS)
    px = int(cx * dest_w - draw_w / 2)
    py = max(top_margin, int(cy * dest_h - draw_h / 2))
    canvas = Image.new('RGBA', (dest_w, dest_h), (0, 0, 0, 0))
    canvas.paste(face_r, (px, py), face_r)
    arr = np.array(canvas)
    front = arr.copy()
    ys, xs = np.where(arr[:, :, 3] > 40)
    if len(xs) == 0:
        return canvas, canvas
    bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
    chin_y = int(by0 + (by1 - by0) * 0.68)
    cxp = (bx0 + bx1) / 2
    neck_half = (bx1 - bx0) * 0.16
    for y in range(chin_y, by1 + 1):
        for x in range(bx0, bx1 + 1):
            r, g, b, al = map(int, front[y, x])
            if al < 40:
                continue
            if abs(x - cxp) <= neck_half and is_neck_skin(r, g, b, al) and not is_hanging_hair(
                r, g, b, al
            ):
                continue
            front[y, x, 3] = 0
    return Image.fromarray(arr), Image.fromarray(front)


def glove_blobs(body_img: Image.Image):
    a = np.array(body_img)
    h, w = a.shape[:2]
    r, g, b, al = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int), a[:, :, 3]
    gear = ((al > 160) & (np.maximum(np.maximum(r, g), b) < 100)) | (
        (al > 160) & (r > 150) & (b > 80) & (g < 150) & (r > g + 25)
    )
    upper = (np.arange(h)[:, None] > 20) & (np.arange(h)[:, None] < 400)
    left_roi = upper & (np.arange(w)[None, :] > 200) & (np.arange(w)[None, :] < 460)
    right_roi = upper & (np.arange(w)[None, :] > 560) & (np.arange(w)[None, :] < 820)

    def largest(m: np.ndarray) -> np.ndarray:
        lab, n = ndimage.label(m)
        if n == 0:
            return m
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        return lab == (int(np.argmax(sizes)) + 1)

    return ndimage.binary_dilation(largest(gear & left_roi), iterations=2), ndimage.binary_dilation(
        largest(gear & right_roi), iterations=2
    )


def translate_gloves(body_img: Image.Image, dy: int, dx_out: int = 0) -> Image.Image:
    a = np.array(body_img)
    h, w = a.shape[:2]
    left, right = glove_blobs(body_img)

    def shift(mask: np.ndarray, dx: int, drop: int) -> Image.Image:
        layer = np.zeros_like(a)
        layer[mask] = a[mask]
        return Image.fromarray(layer).transform(
            (w, h), Image.AFFINE, (1, 0, -dx, 0, 1, -drop), resample=Image.Resampling.BICUBIC
        )

    out = a.copy()
    out[ndimage.binary_dilation(left | right, iterations=2), 3] = 0
    out_im = Image.alpha_composite(Image.fromarray(out), shift(left, -dx_out, dy))
    out_im = Image.alpha_composite(out_im, shift(right, +dx_out, dy))
    arr = seal(np.array(out_im))
    arr = repair_pale(arr)
    arr = lift_dark_islands(arr, max_size=400)
    return Image.fromarray(arr)


def shrink_fit(a: np.ndarray, scale: float = 0.86, top_margin: int = 70) -> np.ndarray:
    im = Image.fromarray(a)
    h, w = a.shape[:2]
    ys, xs = np.where(a[:, :, 3] > 40)
    y0, y1 = ys.min(), ys.max()
    foot_x = (xs.min() + xs.max()) / 2
    nw, nh = int(w * scale), int(h * scale)
    scaled = im.resize((nw, nh), Image.Resampling.LANCZOS)
    paste_x = int(foot_x - foot_x * scale)
    paste_y = int(y1 - y1 * scale)
    new_top = int(y0 * scale) + paste_y
    if new_top < top_margin:
        paste_y += top_margin - new_top
    canvas = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    canvas.paste(scaled, (paste_x, paste_y), scaled)
    return np.array(canvas)


def prepare_body(path: Path) -> Image.Image:
    a = np.array(Image.open(path).convert('RGBA'))
    a = seal(a)
    a = repair_pale(a)
    a = yellow_to_pink(a)
    a = lift_dark_islands(a)
    a = seal(a, close_iter=2, neighbor_passes=8)
    a = repair_pale(a)
    a = yellow_to_pink(a)
    return Image.fromarray(a)


def prepare_face(path: Path) -> Image.Image:
    fa = seal(np.array(Image.open(path).convert('RGBA')), close_iter=2, neighbor_passes=8)
    fa = repair_pale(fa)
    return Image.fromarray(fa)


def bake(pose: str, face_path: Path, body: Image.Image) -> Image.Image:
    b = body.copy()
    if pose == 'ooh':
        b = translate_gloves(b, 95, 25)
    elif pose == 'knockout':
        b = translate_gloves(b, 220, 55)
    ba = clear_blank_head(np.array(b))
    hair, front = face_layers(prepare_face(face_path), *b.size)
    out = Image.new('RGBA', b.size, (0, 0, 0, 0))
    out = Image.alpha_composite(out, hair)
    out = Image.alpha_composite(out, Image.fromarray(ba))
    out = Image.alpha_composite(out, front)
    a = seal(np.array(out))
    a = repair_pale(a)
    a = lift_dark_islands(a)
    a = yellow_to_pink(a)
    a = shrink_fit(a, scale=0.86, top_margin=70)
    a = seal(a)
    a = repair_pale(a)
    a = lift_dark_islands(a)
    a = yellow_to_pink(a)
    return Image.fromarray(a)


def main() -> None:
    faces = {
        'idle': FACE_ROOT / 'clean.png',
        'ooh': FACE_ROOT / 'ooh.png',
        'knockout': FACE_ROOT / 'knockout.png',
    }
    body = prepare_body(BODY_SRC)
    for pose, face_path in faces.items():
        baked = bake(pose, face_path, body)
        out = OUT_DIR / f'kk-{pose}.png'
        baked.save(out, optimize=True)
        baked.resize((128, 192), Image.Resampling.LANCZOS).save(OUT_DIR / f'kk-{pose}-thumb.png')
        print('wrote', out)


if __name__ == '__main__':
    main()
