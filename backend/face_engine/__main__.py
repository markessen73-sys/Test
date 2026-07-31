"""CLI: python -m face_engine photo.jpg -o clean.png"""

from __future__ import annotations

import argparse
from pathlib import Path

from .engine import VALID_MODES, convert_photo_to_caricature


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Convert a face photo into a Mickey's Gym flat caricature."
    )
    parser.add_argument("photo", type=Path, help="Input face photo (jpg/png)")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("caricature.png"),
        help="Output PNG path (default: caricature.png)",
    )
    parser.add_argument(
        "--size",
        type=int,
        default=1024,
        help="Canvas size (default: 1024, matching character packs)",
    )
    parser.add_argument(
        "--mode",
        choices=sorted(VALID_MODES),
        default="full",
        help="full = caricature; skin = skin-tone test plate only",
    )
    args = parser.parse_args(argv)

    result = convert_photo_to_caricature(args.photo, canvas_size=args.size, mode=args.mode)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(result.png_bytes)
    print(f"Wrote {args.output} ({args.size}×{args.size}, mode={args.mode})")
    face = result.landmarks.face
    print(f"Face box: x={face.x} y={face.y} w={face.w} h={face.h}")
    print(
        f"Skin: {result.features.skin_hex} "
        f"rgb={result.features.skin_tone.rgb if result.features.skin_tone else '?'} "
        f"samples={result.features.skin_sample_count}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
