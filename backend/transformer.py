"""Image transformation using Replicate AI models."""

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

from styles import CaricatureStyle

KONTEXT_MODEL = "flux-kontext-apps/face-to-many-kontext"
FACE_TO_MANY_MODEL = "fofr/face-to-many"
CARTOONIFY_MODEL = "flux-kontext-apps/cartoonify"


class TransformError(Exception):
    pass


def _get_replicate_token() -> str | None:
    return os.environ.get("REPLICATE_API_TOKEN")


def _image_to_data_uri(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def _prepare_image(image_bytes: bytes, max_size: int = 1024) -> tuple[bytes, str]:
    """Resize and normalize uploaded image for model input."""
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


def _parse_retry_seconds(error: ReplicateError) -> float:
    """Extract suggested wait time from a Replicate 429 error."""
    detail = str(error)
    match = re.search(r"resets in ~(\d+)s", detail)
    if match:
        return float(match.group(1)) + 2
    return 15.0


def _friendly_error(error: Exception) -> str:
    message = str(error)
    if "429" in message or "throttled" in message.lower():
        wait = 15
        match = re.search(r"resets in ~(\d+)s", message)
        if match:
            wait = int(match.group(1))
        return (
            f"Rate limit reached. Please wait {wait} seconds and try again. "
            "Free Replicate accounts are limited to 6 requests per minute."
        )
    if "402" in message or "insufficient credit" in message.lower():
        return (
            "Insufficient Replicate credit. Add billing at "
            "https://replicate.com/account/billing and try again."
        )
    if "404" in message:
        return "The AI model could not be found. Please try again in a moment."
    return message


async def _run_with_retry(model: str, input_params: dict[str, Any], retries: int = 2):
    """Run a Replicate model with automatic retry on rate limits."""
    last_error: Exception | None = None

    for attempt in range(retries + 1):
        try:
            return await replicate.async_run(model, input=input_params)
        except ReplicateError as error:
            last_error = error
            if "429" in str(error) and attempt < retries:
                wait = _parse_retry_seconds(error)
                await asyncio.sleep(wait)
                continue
            raise TransformError(_friendly_error(error)) from error
        except Exception as error:
            raise TransformError(_friendly_error(error)) from error

    raise TransformError(_friendly_error(last_error or Exception("Unknown error")))


async def transform_with_kontext(image_bytes: bytes, style: CaricatureStyle) -> bytes:
    """Transform using flux-kontext face-to-many (best style support)."""
    prepared, mime = _prepare_image(image_bytes)
    data_uri = _image_to_data_uri(prepared, mime)

    input_params: dict[str, Any] = {
        "input_image": data_uri,
        "style": style.kontext_style,
        "num_images": 1,
        "preserve_background": False,
        "preserve_outfit": True,
        "aspect_ratio": "match_input_image",
        "output_format": "png",
        "safety_tolerance": 2,
    }

    output = await _run_with_retry(KONTEXT_MODEL, input_params)

    if not output:
        raise TransformError("Model returned no output")

    result_url = output[0] if isinstance(output, list) else str(output)
    return await _download_result(result_url)


async def transform_with_face_to_many(image_bytes: bytes, style: CaricatureStyle) -> bytes:
    """Fallback using fofr/face-to-many with valid style enum + custom prompt."""
    prepared, mime = _prepare_image(image_bytes)
    data_uri = _image_to_data_uri(prepared, mime)

    input_params: dict[str, Any] = {
        "image": data_uri,
        "style": style.face_to_many_style or "3D",
        "prompt": style.prompt,
        "negative_prompt": style.negative_prompt,
        "instant_id_strength": 0.85,
        "control_depth_strength": 0.7,
    }

    output = await _run_with_retry(FACE_TO_MANY_MODEL, input_params)

    if not output:
        raise TransformError("Model returned no output")

    result_url = output[0] if isinstance(output, list) else str(output)
    return await _download_result(result_url)


async def transform_with_cartoonify(image_bytes: bytes) -> bytes:
    """Last-resort fallback: generic cartoonify."""
    prepared, mime = _prepare_image(image_bytes)
    data_uri = _image_to_data_uri(prepared, mime)

    output = await _run_with_retry(
        CARTOONIFY_MODEL,
        {
            "input_image": data_uri,
            "aspect_ratio": "match_input_image",
            "output_format": "png",
            "safety_tolerance": 2,
        },
    )

    if not output:
        raise TransformError("Model returned no output")

    result_url = output if isinstance(output, str) else str(output)
    return await _download_result(result_url)


async def transform_image(image_bytes: bytes, style: CaricatureStyle) -> bytes:
    """Main entry point — tries one model at a time to avoid rate-limit bursts."""
    token = _get_replicate_token()
    if not token:
        raise TransformError(
            "REPLICATE_API_TOKEN is not set. "
            "Get a free API token at https://replicate.com/account/api-tokens"
        )

    os.environ["REPLICATE_API_TOKEN"] = token

    # Primary: kontext model (supports Simpsons, South Park, Anime, etc.)
    try:
        return await transform_with_kontext(image_bytes, style)
    except TransformError as kontext_error:
        # Only try fallback if it's not a billing/rate-limit issue
        msg = str(kontext_error).lower()
        if "rate limit" in msg or "insufficient" in msg or "credit" in msg:
            raise

        # Fallback: face-to-many (only if we have a valid style mapping)
        if style.face_to_many_style:
            try:
                return await transform_with_face_to_many(image_bytes, style)
            except TransformError:
                pass

        raise kontext_error from kontext_error
