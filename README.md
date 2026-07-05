# Caricature Studio

Transform portrait photos into animated-style caricatures. Upload a photo, pick a style (Simpsons, Family Guy, Exaggerated, and more), and get an AI-generated caricature in seconds.

## How it works

1. **Upload** a portrait photograph (JPEG, PNG, WebP, or GIF)
2. **Choose** a caricature style from 10 presets
3. **Generate** — AI transforms your photo while preserving likeness
4. **Download** the result as a PNG

## Styles

| Style | Description |
|-------|-------------|
| The Simpsons | Yellow skin, overbite, bold outlines |
| Family Guy | Rounded, satirical cartoon look |
| Exaggerated | Classic caricature with oversized features |
| South Park | Paper cutout animation style |
| Anime | Japanese animation with expressive eyes |
| Pixar 3D | Warm, rounded 3D movie character |
| Disney Classic | Hand-drawn golden-age animation |
| Comic Book | Bold ink lines and halftone dots |
| Claymation | Stop-motion clay figure texture |
| Retro Cartoon | 1930s rubber-hose vintage style |

## Quick start

### Prerequisites

- Python 3.10+
- Node.js 18+
- A [Replicate API token](https://replicate.com/account/api-tokens) (free tier available)

### Setup

```bash
# Clone and configure
cp .env.example .env
# Edit .env and add your REPLICATE_API_TOKEN

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Production

```bash
cd frontend && npm run build
cd ../backend && uvicorn main:app --host 0.0.0.0 --port 8000
```

The backend serves the built frontend from `frontend/dist/`.

## API

### `GET /api/styles`

Returns available caricature styles.

### `POST /api/transform`

| Field | Type | Description |
|-------|------|-------------|
| `photo` | file | Portrait image (max 10 MB) |
| `style_id` | string | Style ID from `/api/styles` |

Returns the caricature as `image/png`.

### `GET /api/health`

Returns API status and whether Replicate is configured.

## Architecture

```
frontend/          React + Vite UI
  src/
    components/    Photo upload, style picker, result panel
    api.ts         API client

backend/           FastAPI server
  main.py          Routes and file handling
  styles.py        Style definitions and prompts
  transformer.py   Replicate AI integration
```

Transformation uses [fofr/face-to-many](https://replicate.com/fofr/face-to-many) with [flux-kontext face-to-many](https://replicate.com/flux-kontext-apps/face-to-many-kontext) as fallback. Each style has tuned prompts and model parameters for best results.

## Cost

Replicate charges ~$0.01 per transformation. Check [replicate.com/pricing](https://replicate.com/pricing) for current rates.

## License

MIT
