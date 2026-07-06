# Boxer sprite parts

Layered character art sliced from `boxer-behind-guard.png` (reference style matches `reference-game-screen.png`).

## Parts

| File | Joint pivot |
|------|-------------|
| head | neck |
| torso | pelvis / chest |
| pelvis | hips |
| upper-arm-left/right | shoulder |
| forearm-left/right | elbow |
| glove-left/right | wrist (visual; touch via ScreenGlove) |
| thigh-left/right | hip |
| shin-left/right | knee |
| boot-left/right | ankle |

## Regenerate parts

```bash
cd frontend && python3 scripts/slice-boxer-parts.py
```

IK drives **translate + rotate** only — no procedural body drawing.
