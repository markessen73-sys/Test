# Caricature Boxing Gym

A monetizable 3D boxing gym where users upload a photo, get an AI caricature, mount it on boxing equipment, and fight it — with comedic face reactions that change based on punch style.

## The experience

```
1. CREATE     Upload photo → AI caricature (Simpsons, Family Guy, etc.)
2. GYM        Pick equipment: Speedball, Heavy Bag, or Bobo Doll
3. FIGHT      Click to punch — face squashes, spins, gets stars, black eyes...
```

## Punch reactions

| Punch | How to trigger | Face reaction |
|-------|----------------|---------------|
| Jab | Click left side | Sideways squash, cross-eyed spiral |
| Cross | Click right | Black eye, red cheeks |
| Hook | Click sides hard | Stars, heavy squash, rotation |
| Uppercut | Click top | Face stretches up, dizzy stars, tongue out |
| Body shot | Click low | Red cheeks, tongue out |

Equipment animates differently:
- **Speedball** — ricochets fast on hit
- **Heavy Bag** — big swing on hooks
- **Bobo Doll** — wobbles back on impact

## Business model

Users buy credits via Stripe → 1 credit per AI caricature → you hold API keys and keep margin.

See monetization setup in `.env.example`.

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | React, Three.js (R3F), Vite |
| 3D Gym | @react-three/fiber, @react-three/drei |
| Backend | FastAPI, SQLite credits, Stripe |
| AI | Replicate face-to-many-kontext |

## Quick start

```bash
cp .env.example .env
# Add REPLICATE_API_TOKEN (server-side)

cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

cd frontend && npm install && npm run dev
```

Open http://localhost:5173

## Project structure

```
frontend/src/
  steps/          CreateStep, GymStep, FightStep
  gym/            3D scene, equipment, face reactions
  components/     Photo upload, style picker, credits
backend/
  main.py         API + billing
  transformer.py  AI caricature generation
  billing.py      Stripe credit packs
  database.py     SQLite credits/usage
```

## Roadmap

- [ ] VR / hand-tracking punches
- [ ] Multiplayer — fight a friend's caricature
- [ ] More equipment (double-end bag, maize ball)
- [ ] Record and share fight clips
- [ ] Custom gym environments
- [ ] Sound effects and impact haptics

## License

MIT
