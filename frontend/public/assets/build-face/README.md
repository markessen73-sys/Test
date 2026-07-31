# Build a Face assets

- `blank-no-features.png` — **mapped template** (1024×1024, transparent BG): head / neck / ears only, no eyes / brows / nose / mouth. Use this as the base when drawing hair overlays.
- `blank-no-features-on-black.png` — same template composited on black (easy to open / share)
- `blank.png` — blank with simple placeholder features (preview helper)
- `hair/*.png` — temporary procedural hair styles (same colour `#2a1c16`); will be replaced by the authored catalogue
- `catalog.json` — index of styles

## Hair overlay contract

- Canvas: **1024×1024**
- Background: transparent
- Colour for the default catalogue: keep hair on its own layer; the head oval / ears stay fixed
- Align to the same head oval as `blank-no-features.png` (centre ≈ 500,502; rx≈307; ry≈363)
