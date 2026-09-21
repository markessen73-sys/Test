# Boxer sprite parts

Articulated 2D character layers for Heavy Bag play mode — **not** grid tiles.

Each PNG is clipped to an anatomical body-region polygon, background removed, and
tight-trimmed to the limb silhouette. Parts overlap at joints so seams stay hidden.

## Parts (15)

| Layer | Parent attach |
|-------|----------------|
| torso | root (chest anchor) |
| head | neck |
| pelvis | waist |
| upper-arm-left/right | shoulder |
| forearm-left/right | elbow |
| glove-left/right | wrist |
| thigh-left/right | hip |
| calf-left/right | knee |
| boot-left/right | ankle |

## Regenerate

```bash
cd frontend && python3 scripts/extract-boxer-parts.py
```

Writes PNGs here plus `src/play/sprite/rigGuardData.ts` with pivot/attach metadata.

IK drives hierarchical **translate + rotate** only — Flash-style skeletal animation.
