# Build a Face assets

## Mapped blank (for hair catalogue)

- `blank-no-features.png` — **mapped template** (1024×1024, transparent): head / neck / ears only
- `blank-no-features-on-black.png` — same on black (easy to open / share)

## Generic features (damage-map aligned)

Transparent 1024×1024 layers locked to bake / damage landmarks:

| File | Landmark(s) |
|------|-------------|
| `features/eyes.png` | `rightEye` (0.382, 0.459), `leftEye` (0.595, 0.443) |
| `features/eyebrows.png` | above each eye |
| `features/nose.png` | `nose` (0.5, 0.52) |
| `features/mouth.png` | `mouth` (0.504, 0.665) |
| `features/features.png` | all of the above combined |
| `features/blank-with-generic-features-on-black.png` | blank + features preview |
| `features/damage-map-landmarks.png` | landmark dots (debug) |

Stack order: blank → eyebrows → eyes → nose → mouth → hair

## Hair

- `hair/*.png` — temporary procedural styles (same colour `#2a1c16`)
- `catalog.json` — index

## Contract

- Canvas: **1024×1024**
- Transparent background for overlays
- Align to the same head oval as `blank-no-features.png`
