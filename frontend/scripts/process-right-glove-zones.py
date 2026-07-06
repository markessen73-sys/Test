#!/usr/bin/env python3
"""Extract right-glove zone sprites from reference grid; remove white backgrounds."""
from pathlib import Path
from PIL import Image

SRC = Path(__file__).resolve().parents[2] / "1783349448736.png"
OUT = Path(__file__).resolve().parents[1] / "public/gloves/right-zones"

COLS, ROWS = 3, 4


def is_white(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return True
    return r > 240 and g > 240 and b > 240


def strip_white(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_white(r, g, b, a):
                px[x, y] = (r, g, b, 0)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    return im


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    img = Image.open(SRC).convert("RGBA")
    w, h = img.size
    cw, ch = w // COLS, h // ROWS
    for r in range(ROWS):
        for c in range(COLS):
            cell = strip_white(img.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)))
            # screen columns 1,2,3 → grid c 0,1,2
            name = f"zone-r{r}-c{c + 1}.png"
            cell.save(OUT / name, optimize=True)
            print(f"Wrote {name} {cell.size}")


if __name__ == "__main__":
    main()
