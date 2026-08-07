#!/usr/bin/env python3
"""
Paint Union Jack / USA flag patterns onto default red glove zone packs.

Preserves alpha silhouette, cream palm, and original luminance shading.
Only recolors red leather shell pixels.

  python3 scripts/make-flag-glove-zones.py
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "public/gloves/right-zones"
OUT_UJ = ROOT / "public/gloves/union-jack-zones"
OUT_USA = ROOT / "public/gloves/usa-zones"

# UK / USA palette
UK_BLUE = (1, 33, 105)
UK_RED = (200, 16, 46)
UK_WHITE = (255, 255, 255)
USA_BLUE = (10, 49, 97)
USA_RED = (179, 25, 50)
USA_WHITE = (255, 255, 255)


def is_red_leather(r: int, g: int, b: int, a: int) -> bool:
    if a < 40:
        return False
    # Cream / off-white palm
    if r > 200 and g > 180 and b > 160 and abs(r - g) < 40:
        return False
    # Near-white specular stays handled via luminance; still treat as leather if reddish
    # Red leather: strong R dominance
    if r < 70:
        return False
    if r >= g + 18 and r >= b + 18 and r > 90:
        return True
    # Dark red shadows
    if r > g + 10 and r > b + 10 and r > 55 and g < 90 and b < 90:
        return True
    return False


def lum(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


def apply_shade(base: tuple[int, int, int], shade: float) -> tuple[int, int, int]:
    shade = max(0.35, min(1.45, shade))
    return (
        max(0, min(255, int(round(base[0] * shade)))),
        max(0, min(255, int(round(base[1] * shade)))),
        max(0, min(255, int(round(base[2] * shade)))),
    )


def union_jack_color(u: float, v: float) -> tuple[int, int, int]:
    """u,v in [0,1] across glove bbox — stylized Union Jack."""
    # Centered coords
    x = u - 0.5
    y = v - 0.5
    ax, ay = abs(x), abs(y)

    # St. George's cross (red on white) — vertical & horizontal bands
    cross_half = 0.07
    cross_white = 0.12
    # St. Andrew's / Patrick's diagonals
    # Distance to diagonal y=x and y=-x
    d1 = abs(x - y) / math.sqrt(2)
    d2 = abs(x + y) / math.sqrt(2)
    diag_red = 0.045
    diag_white = 0.085

    on_cross = ax < cross_half or ay < cross_half
    on_cross_white = ax < cross_white or ay < cross_white
    on_diag_red = d1 < diag_red or d2 < diag_red
    on_diag_white = d1 < diag_white or d2 < diag_white

    if on_cross:
        return UK_RED
    if on_cross_white:
        return UK_WHITE
    if on_diag_red:
        return UK_RED
    if on_diag_white:
        return UK_WHITE
    return UK_BLUE


def usa_color(u: float, v: float) -> tuple[int, int, int]:
    """Stars & stripes over glove bbox."""
    # Canton: upper-left third
    if u < 0.42 and v < 0.45:
        # Star field — simple grid of dots
        cols, rows = 6, 5
        cu = u / 0.42
        cv = v / 0.45
        cell_u = cu * cols
        cell_v = cv * rows
        fx = cell_u - math.floor(cell_u)
        fy = cell_v - math.floor(cell_v)
        # Offset alternate rows slightly
        row = int(cell_v)
        if row % 2 == 1:
            fx = (fx + 0.5) % 1.0
        dx, dy = fx - 0.5, fy - 0.5
        if dx * dx + dy * dy < 0.045:
            return USA_WHITE
        return USA_BLUE

    # Horizontal stripes
    stripes = 13
    stripe = int(v * stripes) % 2
    return USA_RED if stripe == 0 else USA_WHITE


def recolor_glove(src: Path, out: Path, pattern: str) -> None:
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size

    # Opaque bbox for UV
    x0, y0, x1, y1 = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > 40:
                x0 = min(x0, x)
                y0 = min(y0, y)
                x1 = max(x1, x)
                y1 = max(y1, y)
    bw = max(1, x1 - x0)
    bh = max(1, y1 - y0)

    # Mean luminance of red leather for shade normalize
    sum_l = 0.0
    n_l = 0
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            r, g, b, a = px[x, y]
            if is_red_leather(r, g, b, a):
                sum_l += lum(r, g, b)
                n_l += 1
    mean_l = (sum_l / n_l) if n_l else 120.0

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not is_red_leather(r, g, b, a):
                continue
            u = (x - x0) / bw
            v = (y - y0) / bh
            base = union_jack_color(u, v) if pattern == "union-jack" else usa_color(u, v)
            shade = lum(r, g, b) / max(1.0, mean_l)
            nr, ng, nb = apply_shade(base, shade)
            px[x, y] = (nr, ng, nb, a)

    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out)


def main() -> None:
    files = sorted(SRC_DIR.glob("zone-r*-c*.png"))
    if not files:
        raise SystemExit(f"No source zones in {SRC_DIR}")
    for src in files:
        recolor_glove(src, OUT_UJ / src.name, "union-jack")
        recolor_glove(src, OUT_USA / src.name, "usa")
        print("wrote", src.name)
    print("Done →", OUT_UJ, "and", OUT_USA)


if __name__ == "__main__":
    main()
