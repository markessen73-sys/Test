#!/usr/bin/env python3
"""Extract right-glove zone sprites — strip frames, numbers, and white backgrounds."""
from pathlib import Path

from PIL import Image

SRC = Path(__file__).resolve().parents[2] / "1783349448736.png"
OUT = Path(__file__).resolve().parents[1] / "public/gloves/right-zones"

COLS, ROWS = 3, 4

# Inset per cell to drop printed numbers and grey cell borders
INSET_LEFT = 0.08
INSET_RIGHT = 0.08
INSET_TOP = 0.16
INSET_BOTTOM = 0.08


def is_background(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return True
    if r > 232 and g > 232 and b > 232:
        return True
    # Light grey frame lines
    if abs(r - g) < 18 and abs(g - b) < 18 and r > 175:
        return True
    return False


def is_number_ink(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return False
    return r < 95 and g < 95 and b < 95


def strip_cell(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size

    # Erase number ink in upper band
    for y in range(int(h * 0.22)):
        for x in range(int(w * 0.28)):
            r, g, b, a = px[x, y]
            if is_number_ink(r, g, b, a):
                px[x, y] = (0, 0, 0, 0)

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_background(r, g, b, a):
                px[x, y] = (0, 0, 0, 0)

    bbox = im.getbbox()
    if not bbox:
        return im
    return im.crop(bbox)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    img = Image.open(SRC).convert("RGBA")
    w, h = img.size
    cw, ch = w // COLS, h // ROWS

    for r in range(ROWS):
        for c in range(COLS):
            x0 = int(c * cw + cw * INSET_LEFT)
            y0 = int(r * ch + ch * INSET_TOP)
            x1 = int((c + 1) * cw - cw * INSET_RIGHT)
            y1 = int((r + 1) * ch - ch * INSET_BOTTOM)
            cell = strip_cell(img.crop((x0, y0, x1, y1)))
            name = f"zone-r{r}-c{c + 1}.png"
            cell.save(OUT / name, optimize=True)
            print(f"Wrote {name} {cell.size}")


if __name__ == "__main__":
    main()
