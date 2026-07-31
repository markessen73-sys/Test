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

- Source sheet: repo root `file_0000000030888246b8a0103e7ee2caf7.png` (30 styles, 5×6)
- Extract: `python3 scripts/extract_hair_styles.py`
- `hair/*.png` — 30 transparent 1024 overlays aligned to blank (neutral brown; recolored in UI)
- Colours (UI): light blonde, blonde, light brown, brown, dark brown, black, grey, auburn
- `catalog.json` — styles + colour swatches

## Contract

- Canvas: **1024×1024**
- Transparent background for overlays
- Align to the same head oval as `blank-no-features.png`
