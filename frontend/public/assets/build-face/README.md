# Build a Face assets

## Mapped blank (for hair / ear catalogue)

- `blank-no-features.png` — **mapped template** (1024×1024, transparent): head / neck / ears only
- `blank-no-ears.png` — same blank with protruding ears removed (builder base so selected ears replace them)
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

Stack order (builder): blank-no-ears → ears → hair  
Full stack later: blank → ears → eyebrows → eyes → nose → mouth → hair

## Hair

- Source sheet: repo root `254778899bf63ae536da91436c4294bb9d812192e3c6151553016268a92de65d.png`
  (hair only on black, 5×6)
- Extract: `python3 scripts/extract_hair_styles.py`
- `hair/*.png` — 30 transparent 1024 overlays
- UI flow: pick colour → cycle styles (overlays already placed on the blank)
- Colours (UI): light blonde, blonde, light brown, brown, dark brown, black, grey, auburn

## Ears

- Source sheet: repo root `file_00000000c184820a8c0203d285a8c48c.png` (3×3 ear pairs)
- Extract: `python3 scripts/extract_ear_styles.py`
- `ears/*.png` — 9 transparent 1024 overlays (Standard, Small, Large, Low set, High set, Pointed top, Round, Prominent, Folded)
- UI flow: after colour + hair, browse ear styles the same way (strip / swipe)

## Contract

- Canvas: **1024×1024**
- Transparent background for overlays
- Align to the same head oval as `blank-no-features.png`
- `catalog.json` — styles + colour swatches + ear list
