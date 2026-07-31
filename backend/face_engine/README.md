# Face Caricature Engine

Standalone **background** engine that turns a face photo into a Mickey's Gym
flat 2D caricature — the same visual contract as Default / Byson / Tin Mick / The Don.

## What it does

1. Detects the primary face in a photo
2. Estimates facial landmarks (eyes, nose, mouth, …)
3. Samples skin, hair, iris, and lip colours from the photo
4. Renders a cel-shaded cartoon head on a pure black background
5. Locks features to the damage-bake landmark layout (`LM` in `faceDamageBake.mjs`)

Output: **1024×1024 PNG**, head + neck only, bold black outlines.

This engine does **not** depend on the game UI, React, or browser APIs.

## Quick start

```bash
cd backend
python -m face_engine path/to/photo.jpg -o clean.png
# Skin-tone test plate first (head/neck/ears + swatch, no features):
python -m face_engine path/to/photo.jpg --mode skin -o skin.png
```

## Python API

```python
from face_engine import convert_photo_to_caricature

result = convert_photo_to_caricature("photo.jpg")
Path("clean.png").write_bytes(result.png_bytes)

# Verify skin tone before full caricature:
skin = convert_photo_to_caricature("photo.jpg", mode="skin")
print(skin.features.skin_hex, skin.features.skin_sample_count)
```

## HTTP (optional)

With the FastAPI server running:

```bash
curl -F photo=@face.jpg http://localhost:8000/api/face-engine/caricature -o clean.png
curl -F photo=@face.jpg -F mode=skin http://localhost:8000/api/face-engine/caricature -o skin.png
```

Skin sampling uses a YCrCb cheek/forehead mask and the **median** colour (not
quantized) so the tone stays close to the photo.
## Design notes

| Rule | Value |
|------|--------|
| Canvas | 1024×1024 |
| Background | Pure black |
| Content | Head + neck only |
| Layout | Bake `LM` (eyes / mouth / ears) |
| Style | Flat colour, bold outline, punch-out caricature |

AI image models are **not** required. The engine is deterministic feature→cartoon
conversion so it can run offline as a background worker.
