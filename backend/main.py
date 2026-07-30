"""Photo-to-Caricature API server — monetization-ready."""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from billing import (
    CREDITS_PER_TRANSFORM,
    FREE_TRIAL_CREDITS,
    create_checkout_session,
    get_pricing,
    handle_checkout_completed,
    is_stripe_configured,
    verify_webhook,
)
from database import (
    create_customer,
    deduct_credits,
    get_customer,
    init_db,
    log_usage,
)
from styles import get_style, list_styles
from transformer import TransformError, ai_available, transform_image
from face_engine import convert_photo_to_caricature

load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv()

init_db()

app = FastAPI(
    title="Photo Caricature Studio",
    description="Transform photos into animated caricatures",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MONETIZATION_MODE = os.environ.get("MONETIZATION_MODE", "true").lower() == "true"


def get_or_create_customer(x_customer_id: str | None = Header(None)) -> dict:
    if x_customer_id:
        customer = get_customer(x_customer_id)
        if customer:
            return customer
    return create_customer(free_trial_credits=FREE_TRIAL_CREDITS if MONETIZATION_MODE else 0)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "monetization_mode": MONETIZATION_MODE,
        "ai_available": ai_available(),
        "stripe_enabled": is_stripe_configured(),
        "credits_per_transform": CREDITS_PER_TRANSFORM,
    }


@app.get("/api/pricing")
async def pricing():
    return get_pricing()


@app.post("/api/account")
async def register_account():
    """Create a new customer with free trial credits."""
    customer = create_customer(free_trial_credits=FREE_TRIAL_CREDITS if MONETIZATION_MODE else 0)
    return {
        "customer_id": customer["id"],
        "credits": customer["credits"],
        "free_trial": FREE_TRIAL_CREDITS if MONETIZATION_MODE else 0,
    }


@app.get("/api/account")
async def account(customer: dict = Depends(get_or_create_customer)):
    return {
        "customer_id": customer["id"],
        "credits": customer["credits"],
        "credits_per_transform": CREDITS_PER_TRANSFORM,
        "can_transform": customer["credits"] >= CREDITS_PER_TRANSFORM or not MONETIZATION_MODE,
    }


@app.post("/api/billing/checkout")
async def checkout(
    pack_id: str = Form(...),
    customer: dict = Depends(get_or_create_customer),
):
    if not is_stripe_configured():
        raise HTTPException(
            status_code=503,
            detail="Payments not configured. Set STRIPE_SECRET_KEY to enable purchases.",
        )
    try:
        url = create_checkout_session(customer["id"], pack_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"checkout_url": url}


@app.post("/api/billing/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = verify_webhook(payload, sig)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    if event["type"] == "checkout.session.completed":
        handle_checkout_completed(event["data"]["object"])

    return JSONResponse({"received": True})


@app.get("/api/styles")
async def styles():
    return {"styles": list_styles()}


@app.post("/api/face-engine/caricature")
async def face_engine_caricature(photo: UploadFile = File(...)):
    """
    Standalone background engine: photo → Mickey's Gym flat caricature.
    No AI credits required — feature sampling + cartoon render.
    """
    if photo.content_type and photo.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {photo.content_type}.",
        )
    image_bytes = await photo.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 10 MB.")
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    try:
        result = convert_photo_to_caricature(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Face engine failed: {e}") from e

    return Response(
        content=result.png_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": 'inline; filename="mickeys-gym-caricature.png"',
            "X-Provider": "face_engine",
            "X-Canvas-Size": str(result.canvas_size),
        },
    )


@app.post("/api/transform")
async def transform(
    photo: UploadFile = File(...),
    style_id: str = Form(...),
    customer: dict = Depends(get_or_create_customer),
    x_customer_id: str | None = Header(None),
):
    if style_id not in {s["id"] for s in list_styles()}:
        raise HTTPException(status_code=400, detail=f"Unknown style: {style_id}")

    if photo.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {photo.content_type}.",
        )

    image_bytes = await photo.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 10 MB.")
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    if MONETIZATION_MODE:
        if not ai_available():
            raise HTTPException(
                status_code=503,
                detail="AI service unavailable. Configure REPLICATE_API_TOKEN on the server.",
            )
        if customer["credits"] < CREDITS_PER_TRANSFORM:
            raise HTTPException(
                status_code=402,
                detail={
                    "message": "Not enough credits. Purchase a credit pack to continue.",
                    "credits": customer["credits"],
                    "required": CREDITS_PER_TRANSFORM,
                },
            )

    style = get_style(style_id)

    try:
        result_bytes, provider_used = await transform_image(image_bytes, style)
    except TransformError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transformation failed: {e}") from e

    credits_remaining = customer["credits"]
    if MONETIZATION_MODE and provider_used != "local":
        if not deduct_credits(customer["id"], CREDITS_PER_TRANSFORM):
            raise HTTPException(status_code=402, detail="Credit deduction failed.")
        credits_remaining = customer["credits"] - CREDITS_PER_TRANSFORM
        log_usage(customer["id"], style_id, provider_used, CREDITS_PER_TRANSFORM)

    return Response(
        content=result_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f'inline; filename="caricature-{style_id}.png"',
            "X-Style-Name": style.name,
            "X-Provider": provider_used,
            "X-Customer-Id": customer["id"],
            "X-Credits-Remaining": str(credits_remaining),
        },
    )


frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
