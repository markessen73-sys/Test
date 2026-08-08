#!/usr/bin/env python3
"""Bake KK whole-body ring poses from body-kk + face pack.

Idle = gloves up. Ooh = gloves drop. Knockout = hands fully down.
Hair is composited behind the torso so it sits naturally as one figure.

Outputs:
  public/boxer/bodies/kk-{idle,ooh,knockout}.png (+ thumbs)
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


def is_blank_head(r: int, g: int, b: int, a: int) -> bool:
    if a < 40:
        return False
    if r > 160 and 80 < g < 200 and b < 120 and r > g and r - b > 60:
        return True
    if r > 180 and g > 110 and b < 100 and abs(r - g) < 80:
        return True
    return False


def recolor_pink_to_black(im: Image.Image) -> Image.Image:
    a = np.array(im)
    r = a[:, :, 0].astype(np.int16)
    g = a[:, :, 1].astype(np.int16)
    b = a[:, :, 2].astype(np.int16)
    al = a[:, :, 3]
    pink = (al > 40) & (r > 130) & (b > 60) & (g < 160) & (r > g + 12) & ((r - g) > 20)
    pink |= (al > 40) & (r > 150) & (b > 90) & (g < 130) & (r > g)
    out = a.copy()
    out[pink, 0] = np.clip(r[pink] // 7, 10, 42).astype(np.uint8)
    out[pink, 1] = np.clip(g[pink] // 9, 8, 36).astype(np.uint8)
    out[pink, 2] = np.clip(b[pink] // 7, 12, 48).astype(np.uint8)
    return Image.fromarray(out)


def clear_blank_head(im: Image.Image) -> Image.Image:
    a = np.array(im)
    h, w = a.shape[:2]
    fr = FACE_RECT
    y0, y1 = int(fr[1] * h) - 8, int(fr[3] * h) + 50
    x0, x1 = int(fr[0] * w) - 40, int(fr[2] * w) + 40
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            r, g, b, al = map(int, a[y, x])
            if is_blank_head(r, g, b, al):
                a[y, x, 3] = 0
    return Image.fromarray(a)


def face_layers(
    face_path: Path,
    dest_w: int,
    dest_h: int,
    face_rect: list[float],
    face_scale: float = 1.05,
    nudge_y: float = 0.04,
) -> tuple[Image.Image, Image.Image]:
    face = Image.open(face_path).convert('RGBA')
    fw, fh = face.size
    x0, y0, x1, y1 = face_rect
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    scale = 1.25 * 1.1 * 1.1 * 1.1 * 1.2 * face_scale
    half_w = (x1 - x0) / 2 * scale * 1.35
    half_h = (y1 - y0) / 2 * scale * 1.55
    cy = cy - nudge_y * (y1 - y0) * scale - half_h * 0.12
    contain = min((2 * half_w * dest_w) / fw, (2 * half_h * dest_h) / fh) * 0.94
    draw_w = int(fw * contain)
    draw_h = int(fh * contain)
    face_r = face.resize((draw_w, draw_h), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (dest_w, dest_h), (0, 0, 0, 0))
    px = int(cx * dest_w - draw_w / 2)
    py = int(cy * dest_h - draw_h / 2)
    canvas.paste(face_r, (px, py), face_r)
    arr = np.array(canvas)
    front = arr.copy()
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > 40)
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


def glove_blobs(body: Image.Image) -> tuple[np.ndarray, np.ndarray]:
    a = np.array(body)
    h, w = a.shape[:2]
    r = a[:, :, 0].astype(int)
    g = a[:, :, 1].astype(int)
    b = a[:, :, 2].astype(int)
    al = a[:, :, 3]
    dark = (al > 160) & (np.maximum(np.maximum(r, g), b) < 100)
    upper = (np.arange(h)[:, None] > 20) & (np.arange(h)[:, None] < 380)
    left_roi = upper & (np.arange(w)[None, :] > 200) & (np.arange(w)[None, :] < 460)
    right_roi = upper & (np.arange(w)[None, :] > 560) & (np.arange(w)[None, :] < 820)

    def largest(m: np.ndarray) -> np.ndarray:
        lab, n = ndimage.label(m)
        if n == 0:
            return m
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        return lab == (int(np.argmax(sizes)) + 1)

    left = ndimage.binary_dilation(largest(dark & left_roi), iterations=2)
    right = ndimage.binary_dilation(largest(dark & right_roi), iterations=2)
    return left, right


def translate_gloves(body: Image.Image, dy: int, dx_out: int = 0) -> Image.Image:
    a = np.array(body)
    h, w = a.shape[:2]
    left, right = glove_blobs(body)

    def shift(mask: np.ndarray, dx: int, drop: int) -> Image.Image:
        layer = np.zeros_like(a)
        layer[mask] = a[mask]
        lim = Image.fromarray(layer)
        return lim.transform(
            (w, h), Image.AFFINE, (1, 0, -dx, 0, 1, -drop), resample=Image.Resampling.BICUBIC
        )

    out = a.copy()
    clear = ndimage.binary_dilation(left | right, iterations=2)
    out[clear, 3] = 0
    out_im = Image.fromarray(out)
    out_im = Image.alpha_composite(out_im, shift(left, -dx_out, dy))
    out_im = Image.alpha_composite(out_im, shift(right, +dx_out, dy))
    return out_im


def fill_shoulder_gaps(idle: np.ndarray, posed: np.ndarray) -> np.ndarray:
    h, w = posed.shape[:2]
    hole = (posed[:, :, 3] < 40) & (idle[:, :, 3] > 160)
    band = (np.arange(h)[:, None] > 80) & (np.arange(h)[:, None] < 420)
    sides = ((np.arange(w)[None, :] > 220) & (np.arange(w)[None, :] < 470)) | (
        (np.arange(w)[None, :] > 550) & (np.arange(w)[None, :] < 800)
    )
    r, g, b = idle[:, :, 0].astype(int), idle[:, :, 1].astype(int), idle[:, :, 2].astype(int)
    skin = (r > 120) & (r - b > 30) & (r > g - 10)
    fill = hole & band & sides & skin
    fill = ndimage.binary_dilation(fill, iterations=1) & hole & band & sides & (idle[:, :, 3] > 160) & skin
    out = posed.copy()
    out[fill] = idle[fill]
    return out


def bake_pose(body: Image.Image, face_path: Path, pose: str) -> Image.Image:
    body = recolor_pink_to_black(body)
    if pose == 'ooh':
        body = translate_gloves(body, dy=95, dx_out=25)
    elif pose == 'knockout':
        body = translate_gloves(body, dy=220, dx_out=55)
    body = clear_blank_head(body)
    w, h = body.size
    hair, face_front = face_layers(face_path, w, h, FACE_RECT)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out = Image.alpha_composite(out, hair)
    out = Image.alpha_composite(out, body)
    out = Image.alpha_composite(out, face_front)
    return out


def main() -> None:
    faces = {
        'idle': FACE_ROOT / 'clean.png',
        'ooh': FACE_ROOT / 'ooh.png',
        'knockout': FACE_ROOT / 'knockout.png',
    }
    base = Image.open(BODY_SRC).convert('RGBA')
    idle_arr = None
    for pose, face_path in faces.items():
        baked = bake_pose(base.copy(), face_path, pose)
        arr = np.array(baked)
        if pose == 'idle':
            idle_arr = arr
        else:
            assert idle_arr is not None
            arr = fill_shoulder_gaps(idle_arr, arr)
            baked = Image.fromarray(arr)
        out = OUT_DIR / f'kk-{pose}.png'
        baked.save(out, optimize=True)
        baked.resize((128, 192), Image.Resampling.LANCZOS).save(OUT_DIR / f'kk-{pose}-thumb.png')
        print('wrote', out)


if __name__ == '__main__':
    main()
