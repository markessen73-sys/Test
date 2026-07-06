#!/usr/bin/env python3
"""Extract articulated boxer parts via anatomical polygon masks (not grid tiles).

Each part is clipped to a body-region polygon, background-flooded, then tight-trimmed
to non-transparent alpha so only the limb silhouette remains.
"""
from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

SRC = Path(__file__).resolve().parents[1] / "public/boxer/boxer-behind-guard.png"
OUT = Path(__file__).resolve().parents[1] / "public/boxer/parts"

# Source-image joint anchors (px on boxer-behind-guard.png, 1086×1448)
J = {
    "head_top": (543, 72),
    "neck": (543, 248),
    "chest": (543, 360),
    "waist": (543, 565),
    "shoulder_l": (248, 318),
    "shoulder_r": (838, 318),
    "elbow_l": (148, 538),
    "elbow_r": (938, 538),
    "wrist_l": (108, 698),
    "wrist_r": (978, 698),
    "hand_l": (88, 792),
    "hand_r": (998, 792),
    "hip_l": (418, 668),
    "hip_r": (668, 668),
    "knee_l": (398, 968),
    "knee_r": (688, 968),
    "ankle_l": (368, 1198),
    "ankle_r": (718, 1198),
    "foot_l": (348, 1378),
    "foot_r": (738, 1378),
}

# Anatomical region polygons (source px) — overlap at joints for seamless blending
POLYGONS: dict[str, list[tuple[int, int]]] = {
    "head": [
        (400, 40), (686, 40), (720, 120), (710, 230), (640, 280), (446, 280), (376, 230), (366, 120)
    ],
    "torso": [
        (240, 230), (846, 230), (870, 360), (850, 560), (236, 560), (216, 360)
    ],
    "pelvis": [
        (330, 520), (756, 520), (770, 620), (750, 720), (336, 720), (316, 620)
    ],
    "upper-arm-left": [
        (200, 280), (340, 260), (360, 380), (320, 520), (180, 540), (120, 420), (140, 320)
    ],
    "forearm-left": [
        (100, 480), (240, 460), (260, 600), (220, 720), (80, 740), (40, 600), (60, 500)
    ],
    "glove-left": [
        (40, 620), (200, 600), (230, 760), (180, 880), (60, 900), (20, 760)
    ],
    "upper-arm-right": [
        (886, 280), (746, 260), (726, 380), (766, 520), (906, 540), (966, 420), (946, 320)
    ],
    "forearm-right": [
        (986, 480), (846, 460), (826, 600), (866, 720), (1006, 740), (1046, 600), (1026, 500)
    ],
    "glove-right": [
        (1046, 620), (886, 600), (856, 760), (906, 880), (1026, 900), (1066, 760)
    ],
    "thigh-left": [
        (350, 640), (490, 630), (510, 820), (480, 1000), (340, 1010), (310, 820)
    ],
    "calf-left": [
        (330, 940), (470, 930), (490, 1120), (460, 1280), (320, 1290), (290, 1120)
    ],
    "boot-left": [
        (310, 1165), (470, 1155), (490, 1420), (450, 1447), (280, 1447), (260, 1240)
    ],
    "thigh-right": [
        (736, 640), (596, 630), (576, 820), (606, 1000), (746, 1010), (776, 820)
    ],
    "calf-right": [
        (756, 940), (616, 930), (596, 1120), (626, 1280), (766, 1290), (796, 1120)
    ],
    "boot-right": [
        (776, 1165), (616, 1155), (596, 1420), (636, 1447), (806, 1447), (826, 1240)
    ],
}

# pivot = proximal joint, attach = distal joint (child connection point)
PART_JOINTS: dict[str, dict[str, tuple[int, int]]] = {
    "head": {"pivot": J["neck"], "attach": J["head_top"]},
    "torso": {"pivot": J["waist"], "attach": J["chest"]},
    "pelvis": {"pivot": J["waist"], "attach": J["hip_l"]},  # attach unused; hips are separate bones
    "upper-arm-left": {"pivot": J["shoulder_l"], "attach": J["elbow_l"]},
    "forearm-left": {"pivot": J["elbow_l"], "attach": J["wrist_l"]},
    "glove-left": {"pivot": J["wrist_l"], "attach": J["hand_l"]},
    "upper-arm-right": {"pivot": J["shoulder_r"], "attach": J["elbow_r"]},
    "forearm-right": {"pivot": J["elbow_r"], "attach": J["wrist_r"]},
    "glove-right": {"pivot": J["wrist_r"], "attach": J["hand_r"]},
    "thigh-left": {"pivot": J["hip_l"], "attach": J["knee_l"]},
    "calf-left": {"pivot": J["knee_l"], "attach": J["ankle_l"]},
    "boot-left": {"pivot": J["ankle_l"], "attach": J["foot_l"]},
    "thigh-right": {"pivot": J["hip_r"], "attach": J["knee_r"]},
    "calf-right": {"pivot": J["knee_r"], "attach": J["ankle_r"]},
    "boot-right": {"pivot": J["ankle_r"], "attach": J["foot_r"]},
}

# Torso attachment points for child bones (source px)
TORSO_ATTACH = {
    "chest": J["chest"],
    "neck": J["neck"],
    "shoulder_l": J["shoulder_l"],
    "shoulder_r": J["shoulder_r"],
    "waist": J["waist"],
    "hip_l": J["hip_l"],
    "hip_r": J["hip_r"],
}

PART_Z = {
    "thigh-left": 5,
    "thigh-right": 5,
    "calf-left": 6,
    "calf-right": 6,
    "boot-left": 7,
    "boot-right": 7,
    "pelvis": 10,
    "torso": 12,
    "upper-arm-left": 18,
    "upper-arm-right": 18,
    "forearm-left": 20,
    "forearm-right": 20,
    "head": 28,
    "glove-left": 35,
    "glove-right": 35,
}


def is_background(r: int, g: int, b: int, a: int) -> bool:
    if a < 8:
        return True
    # gym wall / floor haze
    if r > 200 and g > 195 and b > 175:
        return True
    if r > 175 and g > 160 and b > 130 and max(r, g, b) - min(r, g, b) < 28:
        return True
    # cyan/teal matte remnants
    if b > 130 and g > 120 and r < 110 and b > r + 15:
        return True
    return False


def strip_background(im: Image.Image) -> Image.Image:
    """Remove all background-like pixels (not only edge-connected)."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_background(r, g, b, a):
                px[x, y] = (0, 0, 0, 0)
    return im


def flood_background(im: Image.Image) -> Image.Image:
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


def norm_point(px: tuple[int, int], bbox: tuple[int, int, int, int]) -> list[float]:
    x0, y0, x1, y1 = bbox
    w = max(x1 - x0, 1)
    h = max(y1 - y0, 1)
    return [round((px[0] - x0) / w, 4), round((px[1] - y0) / h, 4)]


def extract_part(
    src: Image.Image, name: str, polygon: list[tuple[int, int]]
) -> tuple[Image.Image, dict]:
    mask = Image.new("L", src.size, 0)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    layer = Image.new("RGBA", src.size, (0, 0, 0, 0))
    layer.paste(src, mask=mask)
    bbox = layer.getbbox()
    if not bbox:
        raise RuntimeError(f"No pixels for part {name}")
    part = layer.crop(bbox)
    part = strip_background(part)
    joints = PART_JOINTS[name]
    meta = {
        "pivot": norm_point(joints["pivot"], bbox),
        "attach": norm_point(joints["attach"], bbox),
        "width": part.size[0],
        "height": part.size[1],
        "zIndex": PART_Z[name],
    }
    return part, meta


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    src = flood_background(Image.open(SRC).convert("RGBA"))
    rig: dict = {
        "sourceSize": list(src.size),
        "joints": {k: list(v) for k, v in J.items()},
        "torsoAttach": {k: list(v) for k, v in TORSO_ATTACH.items()},
        "parts": {},
        "scaleVmin": 36,
    }

    for name, polygon in POLYGONS.items():
        part, meta = extract_part(src, name, polygon)
        part.save(OUT / f"{name}.png", optimize=True)
        meta["src"] = f"/boxer/parts/{name}.png"
        meta["aspect"] = round(part.size[0] / part.size[1], 4)
        rig["parts"][name] = meta
        print(f"{name}: {part.size} pivot={meta['pivot']} attach={meta['attach']}")

    # torso attach points in torso-local normalized space
    torso_bbox = None
    for name, polygon in POLYGONS.items():
        if name == "torso":
            mask = Image.new("L", src.size, 0)
            ImageDraw.Draw(mask).polygon(polygon, fill=255)
            layer = Image.new("RGBA", src.size, (0, 0, 0, 0))
            layer.paste(src, mask=mask)
            torso_bbox = layer.getbbox()
            break
    assert torso_bbox
    rig["torsoAttachNorm"] = {
        k: norm_point(tuple(v), torso_bbox) for k, v in TORSO_ATTACH.items()
    }

    pelvis_bbox = None
    for name, polygon in POLYGONS.items():
        if name == "pelvis":
            mask = Image.new("L", src.size, 0)
            ImageDraw.Draw(mask).polygon(polygon, fill=255)
            layer = Image.new("RGBA", src.size, (0, 0, 0, 0))
            layer.paste(src, mask=mask)
            pelvis_bbox = layer.getbbox()
            break
    assert pelvis_bbox
    rig["pelvisAttachNorm"] = {
        "hip_l": norm_point(J["hip_l"], pelvis_bbox),
        "hip_r": norm_point(J["hip_r"], pelvis_bbox),
    }

    (OUT / "rig-guard.json").write_text(json.dumps(rig, indent=2))
    ts = "/* Auto-generated by scripts/extract-boxer-parts.py — do not edit */\n"
    ts += f"export default {json.dumps(rig, indent=2)} as const;\n"
    (Path(__file__).resolve().parents[1] / "src/play/sprite/rigGuardData.ts").write_text(ts)
    print("Wrote rig-guard.json and rigGuardData.ts")

    # remove legacy shin-* files
    for legacy in OUT.glob("shin-*.png"):
        legacy.unlink()
        print(f"Removed legacy {legacy.name}")


if __name__ == "__main__":
    main()
