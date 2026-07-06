#!/usr/bin/env python3
"""Slice boxer-behind-guard.png into layered sprite parts with clean alpha."""
from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image

SRC = Path(__file__).resolve().parents[1] / "public/boxer/boxer-behind-guard.png"
OUT = Path(__file__).resolve().parents[1] / "public/boxer/parts"

# crop: (x, y, w, h) in source pixels; pivot: proximal joint as fraction of crop
PARTS: dict[str, dict] = {
    "head": {"crop": (395, 35, 296, 210), "pivot": [0.5, 0.94], "z": 30},
    "torso": {"crop": (295, 210, 496, 360), "pivot": [0.5, 0.93], "z": 10},
    "pelvis": {"crop": (335, 530, 416, 210), "pivot": [0.5, 0.28], "z": 12},
    "upper-arm-left": {"crop": (95, 265, 290, 270), "pivot": [0.82, 0.14], "z": 22},
    "forearm-left": {"crop": (55, 470, 310, 300), "pivot": [0.84, 0.12], "z": 24},
    "glove-left": {"crop": (81, 346, 226, 418), "pivot": [0.55, 0.08], "z": 40},
    "upper-arm-right": {"crop": (701, 265, 290, 270), "pivot": [0.18, 0.14], "z": 22},
    "forearm-right": {"crop": (721, 470, 310, 300), "pivot": [0.16, 0.12], "z": 24},
    "glove-right": {"crop": (746, 226, 156, 236), "pivot": [0.48, 0.12], "z": 40},
    "thigh-left": {"crop": (310, 710, 230, 340), "pivot": [0.55, 0.1], "z": 8},
    "shin-left": {"crop": (285, 1000, 210, 290), "pivot": [0.52, 0.08], "z": 9},
    "boot-left": {"crop": (265, 1240, 250, 190), "pivot": [0.5, 0.08], "z": 11},
    "thigh-right": {"crop": (546, 710, 230, 340), "pivot": [0.45, 0.1], "z": 8},
    "shin-right": {"crop": (591, 1000, 210, 290), "pivot": [0.48, 0.08], "z": 9},
    "boot-right": {"crop": (571, 1240, 250, 190), "pivot": [0.5, 0.08], "z": 11},
}


def is_background(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return True
    if r > 200 and g > 195 and b > 175:
        return True
    if r > 175 and g > 160 and b > 130 and max(r, g, b) - min(r, g, b) < 28:
        return True
    return False


def flood_transparent(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    seen = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))

    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        seen[y][x] = True
        r, g, b, a = px[x, y]
        if not is_background(r, g, b, a):
            continue
        px[x, y] = (r, g, b, 0)
        q.append((x + 1, y))
        q.append((x - 1, y))
        q.append((x, y + 1))
        q.append((x, y - 1))

    return im


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    img = Image.open(SRC).convert("RGBA")
    meta: dict[str, dict] = {}

    for name, spec in PARTS.items():
        x, y, w, h = spec["crop"]
        part = flood_transparent(img.crop((x, y, x + w, y + h)))
        part.save(OUT / f"{name}.png", optimize=True)
        meta[name] = {
            "src": f"/boxer/parts/{name}.png",
            "pivot": spec["pivot"],
            "zIndex": spec["z"],
            "widthVw": spec.get("widthVw", 0),
        }
        print(f"Wrote {name}.png {part.size}")

    (OUT / "parts-meta.json").write_text(json.dumps(meta, indent=2))
    print("Wrote parts-meta.json")


if __name__ == "__main__":
    main()
