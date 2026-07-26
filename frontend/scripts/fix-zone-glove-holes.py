#!/usr/bin/env python3
"""Fill dark holes and grey dash artifacts inside zone glove sprites."""
from pathlib import Path

from PIL import Image

ZONES = Path(__file__).resolve().parents[1] / "public/gloves/right-zones"


def is_artifact(r: int, g: int, b: int, a: int) -> bool:
    if a <= 128:
        return False
    # Pure black finger-gap holes
    if r < 45 and g < 45 and b < 45:
        return True
    # Low-saturation grey dashes (anti-aliased gaps bleeding through)
    spread = max(r, g, b) - min(r, g, b)
    avg = (r + g + b) / 3
    return spread < 28 and avg < 105


def fill_artifacts(im: Image.Image, passes: int = 8) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size

    for _ in range(passes):
        changed = False
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if not is_artifact(r, g, b, a):
                    continue
                neighbors = []
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        nr, ng, nb, na = px[nx, ny]
                        if na > 128 and not is_artifact(nr, ng, nb, na):
                            neighbors.append((nr, ng, nb))
                if neighbors:
                    ar = sum(c[0] for c in neighbors) // len(neighbors)
                    ag = sum(c[1] for c in neighbors) // len(neighbors)
                    ab = sum(c[2] for c in neighbors) // len(neighbors)
                    px[x, y] = (ar, ag, ab, 255)
                    changed = True
        if not changed:
            break
    return im


def main() -> None:
    for path in sorted(ZONES.glob("zone-r*-c*.png")):
        fixed = fill_artifacts(Image.open(path))
        tmp = path.with_suffix(".tmp.png")
        fixed.save(tmp, optimize=True)
        tmp.replace(path)
        print(f"Fixed {path.name}")


if __name__ == "__main__":
    main()
