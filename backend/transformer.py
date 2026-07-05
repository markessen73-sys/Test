"""Image transformation — multi-provider with free local fallback."""

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

from local_processor import transform_local
from openai_provider import OpenAIError, transform_openai
from styles import CaricatureStyle

KONTEXT_MODEL = "flux-kontext-apps/face-to-many-kontext"
FACE_TO_MANY_MODEL = "fofr/face-to-many"


class TransformError(Exception):
    pass


def get_available_providers() -> list[str]:
    """Return list of configured providers in priority order."""
    providers = []
    if os.environ.get("REPLICATE_API_TOKEN"):
        providers.append("replicate")
    if os.environ.get("OPENAI_API_KEY"):
        providers.append("openai")
    providers.append("local")
    return providers


def _get_replicate_token() -> str | None:
    return os.environ.get("REPLICATE_API_TOKEN")


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


def _is_billing_error(error: Exception) -> bool:
    msg = str(error).lower()
    return any(k in msg for k in ("402", "insufficient credit", "billing", "payment"))


def _is_rate_limit(error: Exception) -> bool:
    return "429" in str(error) or "throttled" in str(error).lower()


def _parse_retry_seconds(error: ReplicateError) -> float:
    detail = str(error)
    match = re.search(r"resets in ~(\d+)s", detail)
    if match:
        return float(match.group(1)) + 2
    return 15.0


def _friendly_error(error: Exception) -> str:
    message = str(error)
    if _is_rate_limit(error):
        wait = 15
        match = re.search(r"resets in ~(\d+)s", message)
        if match:
            wait = int(match.group(1))
        return (
            f"Rate limit reached. Please wait {wait} seconds and try again. "
            "Free Replicate accounts are limited to 6 requests per minute."
        )
    if _is_billing_error(error):
        return (
            "Replicate account has no credit. Add billing at "
            "https://replicate.com/account/billing — or use free local mode below."
        )
    return message


async def _run_replicate(model: str, input_params: dict[str, Any], retries: int = 1):
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            return await replicate.async_run(model, input=input_params)
        except ReplicateError as error:
            last_error = error
            if _is_rate_limit(error) and attempt < retries:
                await asyncio.sleep(_parse_retry_seconds(error))
                continue
            raise
    raise last_error or Exception("Unknown Replicate error")


async def transform_with_replicate(image_bytes: bytes, style: CaricatureStyle) -> bytes:
    """Transform using Replicate kontext model."""
    token = _get_replicate_token()
    if not token:
        raise TransformError("REPLICATE_API_TOKEN is not set")
    os.environ["REPLICATE_API_TOKEN"] = token

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
    Transform image using the requested provider or auto-select.
    Returns (image_bytes, provider_used).
    """
    available = get_available_providers()
    if not available:
        raise TransformError("No providers available")

    if provider and provider != "auto":
        if provider not in available:
            raise TransformError(f"Provider '{provider}' is not available")
        order = [provider]
    else:
        order = available

    errors: list[str] = []

    for prov in order:
        try:
            if prov == "replicate":
                result = await transform_with_replicate(image_bytes, style)
                return result, "replicate"
            if prov == "openai":
                result = await asyncio.to_thread(transform_openai, image_bytes, style)
                return result, "openai"
            if prov == "local":
                result = await asyncio.to_thread(transform_local, image_bytes, style)
                return result, "local"
        except Exception as error:
            if prov == "local":
                raise TransformError(_friendly_error(error)) from error
            if _is_billing_error(error) or _is_rate_limit(error):
                errors.append(f"{prov}: {_friendly_error(error)}")
                continue
            errors.append(f"{prov}: {error}")
            continue

    raise TransformError(
        "All providers failed. " + " | ".join(errors) if errors
        else "Transformation failed"
    )
