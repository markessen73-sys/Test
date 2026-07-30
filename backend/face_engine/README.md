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
```

## Python API

```python
from face_engine import convert_photo_to_caricature

result = convert_photo_to_caricature("photo.jpg")
Path("clean.png").write_bytes(result.png_bytes)
```

## HTTP (optional)

With the FastAPI server running:

```bash
curl -F photo=@face.jpg http://localhost:8000/api/face-engine/caricature -o clean.png
```

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
