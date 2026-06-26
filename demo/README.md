# Arena physics demo

## Assets

- `arena-source.png` — full background visual (rocks + shading on black)
- `arena-collision.png` — solid mask (rock platforms only; shading is not solid)

## View

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765/demo/cloud-background.html`

## Physics

- Gravity: 2 seconds from top to bottom of the screen
- Horizontal wrap: objects leaving the right edge re-enter from the left (and vice versa)
- Red ball starts at the top centre

## Rebuild collision map

```bash
node demo/build-assets.mjs
```
