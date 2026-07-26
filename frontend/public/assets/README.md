# Modular character layer assets

Every face is assembled from independent layers. All layers share **512×512** pixels with anchor at **(0.5, 0.5)** — the canvas centre.

## Folders

| Folder | Character JSON key | Notes |
|--------|-------------------|--------|
| `head/` | `head` | Base head silhouette (shape never changes between characters) |
| `skin/` | `skin` | Skin tone overlay |
| `ears/` | `ears` | |
| `eyes/` | `eyes` | |
| `eyebrows/` | `eyebrows` | |
| `noses/` | `nose` | |
| `mouths/` | `mouth` | |
| `hair/` | `hair` | |
| `beards/` | `beard` | `0` = none |
| `glasses/` | `glasses` | `0` = none |
| `accessories/` | `accessories` | `0` = none (future) |

## File naming

Drop images named with a numeric index: `1.png`, `2.webp`, `style-17.png`, etc.
The manifest scanner picks up any image whose basename ends in a number.

## Manifest

Run `npm run assets:manifest` (or start dev/build) to regenerate `manifest.json`.
The renderer loads every index listed there — no hardcoded asset counts.

## Character JSON

```json
{
  "head": 1,
  "skin": 4,
  "ears": 3,
  "eyes": 17,
  "eyebrows": 8,
  "nose": 12,
  "mouth": 21,
  "hair": 35,
  "beard": 0,
  "glasses": 0,
  "accessories": 0
}
```
