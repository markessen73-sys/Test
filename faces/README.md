# Face template mapping

Test portrait used to prototype how caricature faces attach to boxing targets before the AI cartoon pipeline is wired.

| File | Purpose |
|------|---------|
| `test-template-face.png` | Active playable face (flat 2D caricature of photo man) |
| `test-template-face-2d.png` | Backup of the flat 2D normal expression |
| `test-template-face-ooh.png` | Matching punched/"ooh!" expression (same layout) |
| `test-template-face-knockout.png` | Knockout face — eyes closed, frown, stars (100% damage) |
| `test-template-face-cartoon-man.png` | Earlier 3D-style cartoon (kept for reference) |
| `test-template-face-photo-man.png` | Photo-aligned cutout (pre-cartoon) |
| `test-template-face-male.png` | Male caricature template (damage baseline + layout canon) |
| `test-template-face-female.png` | Female caricature (same head/feature layout as male) |
| `source-photo-909c.png` | Source dual portrait used for the photo playable face |
| `damage/cauliflower-ear.png` | Ear damage reference — mirrored for L/R (`file_00000000174071…`) |
| `damage/black-right-eye.png` | Black-eye reference — mirrored for left (`file_00000000878871…`) |
| `damage/swollen-left-eye.png` | Swollen-eye reference — mirrored for right (`file_000000005a5c71…`) |
| `damage/broken-nose.png` | Broken nose reference (`file_00000000204081…`) |
| `damage/missing-tooth.png` | Missing tooth reference (`file_00000000757082…`) |
| `damage/forehead-bandage.png` | Bandaged head reference (`file_00000000494481…`) |
| `damage/swollen-lip.png` | Swollen lip reference (`file_00000000c51081…`) |
| `face-template-map.json` | Generated regions + engine targets |

Punch damage: every 3–6 landed hits adds one unused **bruise or small cut** on the
**top-right damage HUD face**. Marks are landmark-anchored so they work on any face.
The meter fills to 100% when all marks are applied — then both the HUD and the live
partner swap to `test-template-face-knockout.png` (closed eyes, frown, stars).
Before KO, the live face briefly swaps to `test-template-face-ooh.png` on each hit.

## Fit a photo into the caricature layout

Male + female caricatures share head shape and feature positions. To bring a
photograph into that same layout (so punch damage transfers):

```bash
cd frontend
python3 scripts/fit-photo-to-caricature-template.py ../file_00000000909c720cbc344633f22a1b2f.png --side right --install
python3 scripts/map-face-template.py public/faces/test-template-face.png
```

Writes a transparent 1024×1024 face aligned to the canonical landmarks.

## Regenerate map

```bash
cd frontend
python3 scripts/map-face-template.py public/faces/test-template-face.png
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

## Bobo doll comedy-clown faces

Same caricature + injury ladder as the ring damage stages, with **natural
skin tone** (no whiteface), red/blue clown accents, black pupils, and a
large multi-coloured curly wig.

```bash
cd frontend
npm run bake:clown
```

Writes 11 PNGs to `bobo-clown-stages/00-clean.png` … `10-knockout.png`, plus
`ooh.png` and `knockout-clean.png` for the live doll. Preview: `/clown-preview.html`.
In play (`?play=bobo-doll`) the doll stays undamaged, swaps to ooh on hit and
KO at 100%; injuries advance only in the damage box. Preview a HUD step with
`?play=bobo-doll&damageStage=0..10`.

## Adding a new playable character

Drop a full pack under `characters/<id>/` (see `default/` / `byson/`), register it
in `src/play/face/characters.ts`, then run the guardrail script:

```bash
cd frontend
# Align clean/ooh/KO so eyes+mouth sit on bake LM (reuse clean's affine for ooh+KO).
# Scale the pack so clean mid-face width matches Default (±4%), pivot on the eye midpoint.
# Swap templates → bake damage + clown into characters/<id>/… → restore templates.
npm run bake:damage
npm run bake:clown
npm run check:characters
```

`check:characters` fails the build-prep checklist if any of these regress:

| Check | Why it matters |
|-------|----------------|
| Required clean / ooh / KO / damage / clown files | Incomplete packs crash stations |
| Clean mid-face width ≈ Default (±4%) | Heads must match Default size in ring / HUD |
| Clean eyes on damage-bake `LM` | Black eye / stamps land on forehead |
| `isIris()` hits near eyes | Non-green irises break bruise + clown pupil bake |
| KO / ooh mid-face width ≈ clean | Head “shrinks” on knockout |
| Clown cheek ≈ clean skin (no whiteface) | Clown face must keep natural skin colour |
| Clown red nose + blue/red eye diamonds | Red/blue accents required |
| Clown curly multicolour wig in crown | Large curly wig template, not short candy tips |
| Clown pupils are black (+ glint) like Default | Colored irises left through clown bake |
| Damage stage `02-blackRightEye` darkens the orbital | Wrong LM / iris skip / stale bake |
