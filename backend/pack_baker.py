"""Bake damage + clown packs using the same Node scripts as built-in characters."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
FACES = FRONTEND / "public" / "faces"

TEMPLATE_CLEAN = FACES / "test-template-face.png"
TEMPLATE_OOH = FACES / "test-template-face-ooh.png"
TEMPLATE_KO = FACES / "test-template-face-knockout.png"
DAMAGE_OUT = FACES / "damage-stages"
CLOWN_OUT = FACES / "bobo-clown-stages"


class PackBakeError(Exception):
    pass


def bake_character_pack(clean: bytes, ooh: bytes, knockout: bytes) -> dict[str, bytes]:
    """
    Swap face templates, run npm bake:damage + bake:clown, collect outputs.
    Mirrors the built-in character workflow in public/faces/README.md.
    """
    backups: dict[Path, bytes | None] = {}
    for path in (TEMPLATE_CLEAN, TEMPLATE_OOH, TEMPLATE_KO):
        backups[path] = path.read_bytes() if path.exists() else None

    try:
        TEMPLATE_CLEAN.write_bytes(clean)
        TEMPLATE_OOH.write_bytes(ooh)
        TEMPLATE_KO.write_bytes(knockout)

        for script in ("bake:damage", "bake:clown"):
            proc = subprocess.run(
                ["npm", "run", script],
                cwd=FRONTEND,
                capture_output=True,
                text=True,
            )
            if proc.returncode != 0:
                raise PackBakeError(
                    f"{script} failed:\n{proc.stdout}\n{proc.stderr}"
                )

        out: dict[str, bytes] = {
            "clean.png": clean,
            "ooh.png": ooh,
            "knockout.png": knockout,
        }
        if DAMAGE_OUT.is_dir():
            for f in sorted(DAMAGE_OUT.glob("*.png")):
                out[f"damage/{f.name}"] = f.read_bytes()
        if CLOWN_OUT.is_dir():
            for f in sorted(CLOWN_OUT.glob("*.png")):
                out[f"clown/{f.name}"] = f.read_bytes()
        return out
    finally:
        for path, data in backups.items():
            if data is None:
                path.unlink(missing_ok=True)
            else:
                path.write_bytes(data)
