# Arena background demo

## Foreground image

`demo/assets/arena-source.png` — your rock arena on a black background.

## View locally

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765/demo/cloud-background.html`

## Rebuild baked rocks layer (optional)

```bash
node demo/build-assets.mjs
```

Writes `arena-rocks.png` with transparent gaps over black.
