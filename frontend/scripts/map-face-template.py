#!/usr/bin/env python3
"""Map a test portrait / template face onto boxing engine targets.

Reads a front-facing face image, estimates oval + feature regions, and writes
`public/faces/face-template-map.json` plus `src/play/face/faceTemplateMap.ts`.

Usage:
  python3 scripts/map-face-template.py [path/to/template.png]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = ROOT.parent / "file_00000000ffb871f4ac76239e6911f3b9.png"
OUT_JSON = ROOT / "public/faces/face-template-map.json"
OUT_TS = ROOT / "src/play/face/faceTemplateMap.ts"
PUBLIC_FACE = ROOT / "public/faces/test-template-face.png"
SPARRING_SPRITE = ROOT / "public/boxer/sparring-boxer.png"
REFERENCE_MOCKUP = ROOT.parent / "1783451254081.png"


def norm_rect(x0: float, y0: float, x1: float, y1: float, w: int, h: int) -> list[float]:
    return [round(x0 / w, 4), round(y0 / h, 4), round(x1 / w, 4), round(y1 / h, 4)]


def analyze_reference_mockup(mockup_path: Path) -> list[float] | None:
    """Face placement rect from the user's composited reference mockup."""
    if not mockup_path.is_file():
        return None

    arr = np.array(Image.open(mockup_path).convert("RGBA"))
    h, w = arr.shape[:2]
    r, g, b, a = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int), arr[:, :, 3]
    top = np.zeros((h, w), dtype=bool)
    top[: int(h * 0.32), :] = True
    red_glow = (r > 150) & (g < 100) & (b < 100)
    face = top & (a > 50) & ~((r < 30) & (g < 30) & (b < 30)) & ~red_glow
    ys, xs = np.where(face)
    if len(xs) < 200:
        return None

    return [
        round(xs.min() / w, 4),
        round(ys.min() / h, 4),
        round((xs.max() + 1) / w, 4),
        round((ys.max() + 1) / h, 4),
    ]


def analyze_sparring_head(sprite_path: Path, inset_frac: float = 0.02) -> list[float]:
    """Head oval on sparring-boxer.png (1024×1536, top-left norm)."""
    im = Image.open(sprite_path).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]
    alpha = arr[:, :, 3] > 30

    row_counts = alpha.sum(axis=1)
    opaque_rows = np.where(row_counts > w * 0.05)[0]
    if len(opaque_rows) == 0:
        return [0.28, 0.06, 0.72, 0.22]

    # Full head crown-to-chin — stop when silhouette reaches shoulder width.
    y_top = int(opaque_rows[0])

    def row_extent(y: int) -> tuple[int, int, int] | None:
        cols = np.where(alpha[y])[0]
        if len(cols) == 0:
            return None
        return int(cols[0]), int(cols[-1]), int(cols[-1] - cols[0] + 1)

    head_rows: list[tuple[int, int, int, int]] = []
    head_bottom = y_top
    for y in range(y_top, y_top + int(0.22 * h)):
        ex = row_extent(y)
        if not ex:
            continue
        head_rows.append((y, ex[0], ex[1], ex[2]))
        if y > y_top + 12 and ex[2] > w * 0.22:
            head_bottom = y
            break
        head_bottom = y

    if not head_rows:
        return [0.28, 0.06, 0.72, 0.22]

    hx0 = min(r[1] for r in head_rows)
    hx1 = max(r[2] for r in head_rows)
    hy0 = head_rows[0][0]
    hy1 = head_bottom

    ix = max(1, int((hx1 - hx0 + 1) * inset_frac))
    iy = max(1, int((hy1 - hy0 + 1) * inset_frac))
    hx0 += ix
    hx1 -= ix
    hy0 += iy
    hy1 -= iy

    return norm_rect(hx0, hy0, hx1 + 1, hy1, w, h)


def ring_partner_face_rect() -> list[float]:
    """Prefer the user mockup; fall back to sprite head analysis."""
    ref = analyze_reference_mockup(REFERENCE_MOCKUP)
    if ref:
        return ref
    return analyze_sparring_head(SPARRING_SPRITE)


def detect_foreground(arr: np.ndarray) -> np.ndarray:
    """Mask subject pixels — handles photo backgrounds and black-backdrop caricatures."""
    h, w = arr.shape[:2]
    if arr.shape[2] == 4:
        r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    else:
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        a = np.full((h, w), 255, dtype=np.uint8)

    ri, gi, bi = r.astype(int), g.astype(int), b.astype(int)
    dark_bg = (ri < 36) & (gi < 36) & (bi < 36)
    light_bg = (np.abs(ri - gi) < 15) & (np.abs(gi - bi) < 15) & (ri > 160)
    fg = (a > 48) & ~dark_bg & ~light_bg
    if int(fg.sum()) < 500:
        fg = (a > 20) & ~dark_bg
    if int(fg.sum()) < 500:
        fg = (np.maximum(np.maximum(r, g), b) > 24) & (a > 10)
    return fg


def map_template(src_path: Path) -> dict:
    im = Image.open(src_path).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]
    fg = detect_foreground(arr)
    ys, xs = np.where(fg)
    if len(xs) == 0:
        raise RuntimeError("No foreground detected in template image")

    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    # Head-only caricatures fill the frame; photos crop to upper face oval.
    chin_frac = 0.92 if (x1 - x0) > 0.7 * w and (y1 - y0) > 0.7 * h else 0.62
    face_y1 = y0 + int((y1 - y0) * chin_frac)
    face_x0 = x0 + int((x1 - x0) * 0.06)
    face_x1 = x1 - int((x1 - x0) * 0.06)
    face_y0 = y0 + int((face_y1 - y0) * 0.02)
    fw, fh = face_x1 - face_x0 + 1, face_y1 - face_y0 + 1

    def lm(fx: float, fy: float) -> list[float]:
        return [round((face_x0 + fx * fw) / w, 4), round((face_y0 + fy * fh) / h, 4)]

    return {
        "template": "/faces/test-template-face.png",
        "sourceSize": [w, h],
        "faceOval": norm_rect(face_x0, face_y0, face_x1 + 1, face_y1 + 1, w, h),
        "regions": {
            "leftEye": norm_rect(face_x0 + 0.18 * fw, face_y0 + 0.28 * fh, face_x0 + 0.40 * fw, face_y0 + 0.40 * fh, w, h),
            "rightEye": norm_rect(face_x0 + 0.60 * fw, face_y0 + 0.28 * fh, face_x0 + 0.82 * fw, face_y0 + 0.40 * fh, w, h),
            "nose": norm_rect(face_x0 + 0.36 * fw, face_y0 + 0.40 * fh, face_x0 + 0.64 * fw, face_y0 + 0.56 * fh, w, h),
            "mouth": norm_rect(face_x0 + 0.28 * fw, face_y0 + 0.58 * fh, face_x0 + 0.72 * fw, face_y0 + 0.74 * fh, w, h),
        },
        "landmarks": {
            "leftEye": lm(0.29, 0.34),
            "rightEye": lm(0.71, 0.34),
            "nose": lm(0.50, 0.48),
            "mouth": lm(0.50, 0.66),
            "chin": lm(0.50, 1.0),
        },
        "targets": {
            "heavyBag": {
                "comment": "Screen trapezoid — matches BAG_HIT_CORNERS in gloveZoneGrid.ts",
                "corners": [[0.305, 0.18], [0.685, 0.18], [0.695, 0.46], [0.295, 0.46]],
            },
            "heavyBagMesh": {
                "comment": "3D decal on cylinder body (bag-local metres)",
                "center": [0, 0.35, 0.44],
                "size": [0.52, 0.62],
            },
            "ringPartner": {
                "comment": "Face rect calibrated from 1783451254081.png mockup (1024×1536 norm)",
                "rect": ring_partner_face_rect(),
            },
            "hudPlayer": {"rect": [0.02, 0.02, 0.22, 0.18]},
            "hudOpponent": {"rect": [0.78, 0.02, 0.98, 0.18]},
        },
    }


def write_ts(data: dict) -> str:
    return (
        "/* Auto-generated by scripts/map-face-template.py — do not edit */\n"
        f"export default {json.dumps(data, indent=2)} as const;\n"
    )


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not src.is_file():
        raise SystemExit(f"Template not found: {src}")

    PUBLIC_FACE.parent.mkdir(parents=True, exist_ok=True)
    Image.open(src).convert("RGBA").save(PUBLIC_FACE, optimize=True)

    data = map_template(src)
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(data, indent=2) + "\n")
    OUT_TS.parent.mkdir(parents=True, exist_ok=True)
    OUT_TS.write_text(write_ts(data))
    print(f"Mapped {src.name} ({data['sourceSize'][0]}×{data['sourceSize'][1]})")
    print(f"  faceOval: {data['faceOval']}")
    print(f"Wrote {OUT_JSON.relative_to(ROOT)} and {OUT_TS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
