"""OpenAI image edit provider for style transformation."""

import base64
import io
import os

from openai import OpenAI
from PIL import Image

from styles import CaricatureStyle


class OpenAIError(Exception):
    pass


def _get_client() -> OpenAI | None:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return None
    return OpenAI(api_key=key)


def _prepare_png(image_bytes: bytes, max_size: int = 1024) -> bytes:
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    width, height = img.size
    if max(width, height) > max_size:
        ratio = max_size / max(width, height)
        img = img.resize((int(width * ratio), int(height * ratio)), Image.Resampling.LANCZOS)

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def transform_openai(image_bytes: bytes, style: CaricatureStyle) -> bytes:
    """Transform photo using OpenAI image edit API."""
    client = _get_client()
    if not client:
        raise OpenAIError("OPENAI_API_KEY is not set")

    png_bytes = _prepare_png(image_bytes)
    model = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")

    prompt = (
        f"Transform this portrait photo into an animated caricature in this style: {style.prompt}. "
        "Preserve the person's likeness and facial features. "
        "High quality cartoon illustration, clean lines, vibrant colors. "
        "No text, no watermark."
    )

    try:
        response = client.images.edit(
            model=model,
            image=("photo.png", png_bytes, "image/png"),
            prompt=prompt,
            size="1024x1024",
            quality="medium",
            input_fidelity="high",
        )
    except Exception as error:
        raise OpenAIError(str(error)) from error

    if not response.data:
        raise OpenAIError("OpenAI returned no image")

    item = response.data[0]
    if item.b64_json:
        return base64.b64decode(item.b64_json)
    if item.url:
        import httpx

        with httpx.Client(timeout=120.0) as http:
            resp = http.get(item.url)
            resp.raise_for_status()
            return resp.content

    raise OpenAIError("OpenAI response contained no image data")
