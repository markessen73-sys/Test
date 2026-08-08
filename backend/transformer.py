"""Image transformation — server-side AI for monetized product."""

import asyncio
import base64
import io
import os
import re
from typing import Any

import httpx
import replicate
from PIL import Image
from replicate.exceptions import ReplicateError

from openai_provider import transform_openai
from styles import CaricatureStyle

KONTEXT_MODEL = "flux-kontext-apps/face-to-many-kontext"
MONETIZATION_MODE = os.environ.get("MONETIZATION_MODE", "true").lower() == "true"


class TransformError(Exception):
    pass


def ai_available() -> bool:
    return bool(os.environ.get("REPLICATE_API_TOKEN") or os.environ.get("OPENAI_API_KEY"))


def _get_ai_provider_order() -> list[str]:
    order = []
    if os.environ.get("REPLICATE_API_TOKEN"):
        order.append("replicate")
    if os.environ.get("OPENAI_API_KEY"):
        order.append("openai")
    return order


def _image_to_data_uri(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def _prepare_image(image_bytes: bytes, max_size: int = 1024) -> tuple[bytes, str]:
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    width, height = img.size
    if max(width, height) > max_size:
        ratio = max_size / max(width, height)
        new_size = (int(width * ratio), int(height * ratio))
        img = img.resize(new_size, Image.Resampling.LANCZOS)

    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=90)
    return buffer.getvalue(), "image/jpeg"


async def _download_result(url: str) -> bytes:
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.content


def _is_rate_limit(error: Exception) -> bool:
    return "429" in str(error) or "throttled" in str(error).lower()


def _parse_retry_seconds(error: ReplicateError) -> float:
    match = re.search(r"resets in ~(\d+)s", str(error))
    return float(match.group(1)) + 2 if match else 15.0


def _friendly_error(error: Exception) -> str:
    msg = str(error).lower()
    if "429" in str(error) or "throttled" in msg:
        return "AI service is busy. Please try again in a few seconds."
    if "402" in str(error) or "insufficient credit" in msg:
        return "AI service temporarily unavailable. Please try again later."
    return str(error)


async def _run_replicate(model: str, input_params: dict[str, Any], retries: int = 1):
    os.environ["REPLICATE_API_TOKEN"] = os.environ["REPLICATE_API_TOKEN"]
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            return await replicate.async_run(model, input=input_params)
        except ReplicateError as error:
            last_error = error
            if _is_rate_limit(error) and attempt < retries:
                await asyncio.sleep(_parse_retry_seconds(error))
                continue
            raise TransformError(_friendly_error(error)) from error
    raise TransformError(_friendly_error(last_error or Exception("Unknown error")))


async def transform_with_replicate(image_bytes: bytes, style: CaricatureStyle) -> bytes:
    prepared, mime = _prepare_image(image_bytes)
    data_uri = _image_to_data_uri(prepared, mime)

    output = await _run_replicate(
        KONTEXT_MODEL,
        {
            "input_image": data_uri,
            "style": style.kontext_style,
            "num_images": 1,
            "preserve_background": False,
            "preserve_outfit": True,
            "aspect_ratio": "match_input_image",
            "output_format": "png",
            "safety_tolerance": 2,
        },
    )

    if not output:
        raise TransformError("Model returned no output")

    result_url = output[0] if isinstance(output, list) else str(output)
    return await _download_result(result_url)


async def transform_image(
    image_bytes: bytes, style: CaricatureStyle, provider: str | None = None
) -> tuple[bytes, str]:
    """
    AI-only transformation for production. Server API keys — never user keys.
    Dev mode (MONETIZATION_MODE=false) allows local fallback.
    """
    order = _get_ai_provider_order()
    if provider and provider not in ("auto", "local"):
        if provider not in order:
            raise TransformError(f"Provider '{provider}' is not configured on the server.")
        order = [provider]

    errors: list[str] = []
    for prov in order:
        try:
            if prov == "replicate":
                return await transform_with_replicate(image_bytes, style), "replicate"
            if prov == "openai":
                result = await asyncio.to_thread(transform_openai, image_bytes, style)
                return result, "openai"
        except Exception as error:
            errors.append(f"{prov}: {_friendly_error(error)}")
            continue

    if not MONETIZATION_MODE:
        from local_processor import transform_local
        result = await asyncio.to_thread(transform_local, image_bytes, style)
        return result, "local"

    raise TransformError(
        "AI transformation unavailable. " + (" | ".join(errors) if errors else "Configure server API keys.")
    )
