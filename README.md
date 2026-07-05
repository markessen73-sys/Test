# Mickey's Caricature Boxing Gym

Upload a photo → AI caricature → fight your face on equipment in a cartoon Rocky-style gym.

## The gym

One unified **3D cartoon gym** inspired by Mickey Goldmill's gym from Rocky — exposed brick, wooden floors, warm lights, "MICKEY'S GYM" sign.

All four stations live in the same room. Use **◀ ▶ arrows** (or keyboard arrows / bottom dots) to rotate between them:

| Station | What you do |
|---------|-------------|
| **Mickey's Ring** | Sparring — punch your caricature opponent in the ring |
| **Speedball** | Fast hands — face spins on jabs |
| **Heavy Bag** | Power shots — face squashes on hooks |
| **Bobo Doll** | Wobble shots — dizzy stars on uppercuts |

Click the active station to punch. Face reactions change by hit type (jab, cross, hook, uppercut, body).

## Flow

```
1. CREATE    Upload photo → AI caricature (Simpsons, Family Guy, etc.)
2. GYM       Enter Mickey's Gym → arrow through stations → fight!
```

## Monetization

Users buy credits via Stripe → 1 credit per AI caricature → you hold API keys.

## Quick start

```bash
cp .env.example .env
cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000
cd frontend && npm install && npm run dev
```

## Tech

React Three Fiber · Cartoon procedural gym · Live face texture reactions · FastAPI + Stripe credits

## Roadmap

- GLTF equipment models with better cartoon shading
- Punch sound effects and comic impact SFX
- Physics-based bag swing (Cannon.js)
- Record & share fight clips
- Multiplayer — fight a friend's caricature

## License

MIT
