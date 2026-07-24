# Face template mapping

Test portrait used to prototype how caricature faces attach to boxing targets before the AI cartoon pipeline is wired.

| File | Purpose |
|------|---------|
| `test-template-face.png` | Source portrait (from `file_00000000ffb871f4ac76239e6911f3b9.png`) |
| `damage/cauliflower-ear.png` | Ear damage reference — mirrored for L/R (`file_00000000174071…`) |
| `damage/black-right-eye.png` | Black-eye reference — mirrored for left (`file_00000000878871…`) |
| `damage/swollen-left-eye.png` | Swollen-eye reference — mirrored for right (`file_000000005a5c71…`) |
| `face-template-map.json` | Generated regions + engine targets |

Punch damage: every 3–6 landed hits applies one unused injury. Ear/eye damages composite reference PNGs (diff vs base, backdrop pixels ignored, mirrored when needed). Bandage / nose / lip still use procedural overlays until references are supplied.

## Regenerate map

```bash
cd frontend
python3 scripts/map-face-template.py ../file_00000000ffb871f4ac76239e6911f3b9.png
```

Writes `face-template-map.json` and `src/play/face/faceTemplateMap.ts`.

## Mapped targets

| Target | Use |
|--------|-----|
| `faceOval` + `regions` | Source crop from template photo |
| `targets.heavyBag` | 2D screen trapezoid (punch hit zone) |
| `targets.heavyBagMesh` | 3D decal on heavy bag cylinder |
| `targets.ringPartner` | Sparring sprite face rect |
| `targets.hudPlayer` / `hudOpponent` | Punch-Out style corner portraits |
