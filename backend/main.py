"""Photo-to-Caricature API server."""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from styles import get_style, list_styles
from transformer import TransformError, get_available_providers, transform_image

load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv()

app = FastAPI(
    title="Photo Caricature Studio",
    description="Transform photos into animated caricatures",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@app.get("/api/health")
async def health():
    providers = get_available_providers()
    return {
        "status": "ok",
        "providers": providers,
        "replicate_configured": bool(os.environ.get("REPLICATE_API_TOKEN")),
        "openai_configured": bool(os.environ.get("OPENAI_API_KEY")),
        "local_available": True,
        "default_provider": providers[0] if providers else "local",
    }


@app.get("/api/styles")
async def styles():
    return {"styles": list_styles()}


@app.post("/api/transform")
async def transform(
    photo: UploadFile = File(..., description="Portrait photo to caricaturize"),
    style_id: str = Form(..., description="Caricature style ID"),
    provider: str = Form("auto", description="Provider: auto, replicate, openai, local"),
):
    if style_id not in {s["id"] for s in list_styles()}:
        raise HTTPException(status_code=400, detail=f"Unknown style: {style_id}")

    if photo.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {photo.content_type}. Use JPEG, PNG, WebP, or GIF.",
        )

    image_bytes = await photo.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10 MB.")
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    style = get_style(style_id)

    try:
        result_bytes, provider_used = await transform_image(
            image_bytes, style, provider=provider
        )
    except TransformError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during transformation: {e}",
        ) from e

    return Response(
        content=result_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f'inline; filename="caricature-{style_id}.png"',
            "X-Style-Name": style.name,
            "X-Provider": provider_used,
        },
    )


# Serve frontend static files in production
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
