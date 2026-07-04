# Arena physics demo

## Assets

- `arena-source.png` — full background visual (rocks + shading on black)
- `arena-collision.png` — solid mask (rock platforms only; shading is not solid)

## View

Local:

```bash
python3 -m http.server 8765
```

Open http://localhost:8765/docs/index.html

**Live demo (GitHub Pages):**

https://markessen73-sys.github.io/Test/

**Preview via raw file (self-contained build, works without Pages):**

https://htmlpreview.github.io/?https://raw.githubusercontent.com/markessen73-sys/Test/cursor/lunar-muskman-2ae2/docs/index.html

Look for **build 2026-07-04q** under the title to confirm the latest version loaded.

> Do not use jsDelivr or raw GitHub URLs directly — they serve HTML as plain text and show source code.

## Physics

- Gravity: 2 seconds from top to bottom of the screen
- Horizontal wrap: objects leaving the right edge re-enter from the left (and vice versa)
- Red ball starts at the top centre

## Rebuild collision map

```bash
node demo/build-assets.mjs
```
