# Cloud background demo

## Your foreground image

Place **your exact foreground PNG** here:

`demo/assets/arena-source.png`

Do not edit the rocks — only the black background should be pure black (`#000000`). The demo makes black pixels transparent so clouds fill those gaps. Rock pixels are never changed.

## View locally

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765/demo/cloud-background.html`

If `arena-source.png` is missing, use **Load your foreground image** on the page.

## Rebuild baked assets (optional)

```bash
node demo/build-assets.mjs
```

This writes `arena-rocks.png` and `arena-cloud-mask.png` from your source file.
