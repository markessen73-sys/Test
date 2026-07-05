# Caricature Studio

Monetization-ready SaaS for AI portrait caricatures. Users upload a photo, pick a style, and pay credits for each AI transformation. **You** hold the API keys and earn the margin.

## Business model

```
User pays you (Stripe)  →  User gets credits  →  Credit spent per caricature
                                ↓
                    Your server calls Replicate/OpenAI
                    (~$0.01 cost) for ~$0.50–$1.40 revenue per credit
```

| Pack | Credits | Price | Your margin (approx.) |
|------|---------|-------|------------------------|
| Starter | 5 | $2.99 | ~$2.94 after API costs |
| Popular | 15 | $6.99 | ~$6.84 |
| Pro | 50 | $19.99 | ~$19.49 |

Adjust packs in `backend/billing.py`. API cost per transform is ~$0.01 on Replicate.

## Architecture

- **Server-side API keys** — `REPLICATE_API_TOKEN` never exposed to users
- **Credit system** — SQLite tracks balances, purchases, and usage
- **Stripe Checkout** — users buy credit packs; webhook adds credits
- **Free trial** — `FREE_TRIAL_CREDITS=1` gives new users one free try
- **Usage logging** — every transform logged for analytics

## Quick start

```bash
cp .env.example .env
# Add your REPLICATE_API_TOKEN (server-side)
# Add STRIPE_SECRET_KEY for payments

cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

cd frontend && npm install && npm run dev
```

Open http://localhost:5173

## Environment

| Variable | Purpose |
|----------|---------|
| `REPLICATE_API_TOKEN` | Your Replicate key (server only) |
| `STRIPE_SECRET_KEY` | Stripe secret key for payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `APP_URL` | Public URL for Stripe redirects |
| `MONETIZATION_MODE` | `true` = credits required (production) |
| `CREDITS_PER_TRANSFORM` | Credits charged per caricature (default: 1) |
| `FREE_TRIAL_CREDITS` | Free credits for new users (default: 1) |

## Stripe setup

1. Create account at [stripe.com](https://stripe.com)
2. Copy **Secret key** → `STRIPE_SECRET_KEY`
3. Add webhook endpoint: `https://yourdomain.com/api/billing/webhook`
4. Event: `checkout.session.completed`
5. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET`

For local testing: `stripe listen --forward-to localhost:8000/api/billing/webhook`

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/account` | Customer credits (auto-creates account) |
| `GET /api/pricing` | Credit packs and pricing |
| `POST /api/billing/checkout` | Start Stripe checkout |
| `POST /api/billing/webhook` | Stripe payment webhook |
| `POST /api/transform` | Create caricature (deducts credits) |

Customers identified by `X-Customer-Id` header (stored in browser localStorage).

## Styles

Simpsons, Family Guy, Exaggerated, South Park, Anime, Pixar 3D, Disney, Comic Book, Claymation, Retro Cartoon

## Dev mode

Set `MONETIZATION_MODE=false` to disable credit gating and enable local fallback for development without API costs.

## License

MIT
