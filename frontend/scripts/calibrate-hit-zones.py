#!/usr/bin/env python3
"""Calibrate bag hit zone (green) and glove tip offsets from user annotation image."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ANNOTATION = ROOT / "57a20c7f-157d-4457-bfdc-4ad5b25a8732.png"
ZONES = Path(__file__).resolve().parents[1] / "public/gloves/right-zones"
DISPLAY_W, DISPLAY_H = 130, 155
CUFF_X, CUFF_Y = DISPLAY_W * 0.5, DISPLAY_H * 0.68


def is_green(c: tuple[int, int, int]) -> bool:
    r, g, b = c
    return g > 140 and r < 120 and b < 120 and g > r + 30


def is_red(c: tuple[int, ...]) -> bool:
    r, g, b = c[0], c[1], c[2]
    return r > 120 and r > g + 25 and r > b + 25


def main() -> None:
    im = Image.open(ANNOTATION).convert("RGB")
    w, h = im.size
    px = im.load()

    greens = [(x, y) for y in range(h) for x in range(w) if is_green(px[x, y])]
    xs = [p[0] for p in greens]
    ys = [p[1] for p in greens]
    print("BAG_HIT_ZONE (green AABB, normalized)")
    print(f"  minX={min(xs)/w:.3f} maxX={max(xs)/w:.3f}")
    print(f"  minY={min(ys)/h:.3f} maxY={max(ys)/h:.3f}")

    for p in sorted(ZONES.glob("zone-*.png")):
        z = Image.open(p).convert("RGBA")
        zw, zh = z.size
        scale = min(DISPLAY_W / zw, DISPLAY_H / zh)
        disp_w, disp_h = zw * scale, zh * scale
        off_x, off_y = (DISPLAY_W - disp_w) / 2, (DISPLAY_H - disp_h) / 2
        zpx = z.load()
        reds: list[tuple[float, float]] = []
        for y in range(zh):
            for x in range(zw):
                r, g, b, a = zpx[x, y]
                if a < 40 or not is_red((r, g, b)):
                    continue
                reds.append((off_x + x * scale, off_y + y * scale))
        reds.sort(key=lambda t: t[1])
        top = reds[: max(1, len(reds) // 12)]
        cx = sum(t[0] for t in top) / len(top)
        cy = sum(t[1] for t in top) / len(top)
        print(
            f"  '{p.stem}': {{ dx: {cx - CUFF_X:.1f}, dy: {cy - CUFF_Y:.1f} }},"
        )


if __name__ == "__main__":
    main()
