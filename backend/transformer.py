"""Image transformation using Replicate AI models."""

import base64
import io
import os
from typing import Any

import httpx
import replicate
from PIL import Image

from styles import CaricatureStyle


class TransformError(Exception):
    pass


def _get_replicate_token() -> str | None:
    return os.environ.get("REPLICATE_API_TOKEN")


def _image_to_data_uri(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def _detect_mime(image_bytes: bytes) -> str:
    if image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if image_bytes[:3] == b"GIF":
        return "image/gif"
    if image_bytes[:4] == b"RIFF":
        return "image/webp"
    return "image/jpeg"


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


async def transform_with_kontext(
    image_bytes: bytes, style: CaricatureStyle
) -> bytes:
    """Transform using flux-kontext face-to-many model."""
    prepared, mime = _prepare_image(image_bytes)
    data_uri = _image_to_data_uri(prepared, mime)

    input_params: dict[str, Any] = {
        "input_image": data_uri,
        "num_images": 1,
        "preserve_background": False,
        "preserve_outfit": True,
        "aspect_ratio": "match_input_image",
        "output_format": "png",
        "safety_tolerance": 2,
    }

    if style.kontext_style:
        input_params["style"] = style.kontext_style
    else:
        input_params["style"] = "Random"

    output = await replicate.async_run(
        "flux-kontext-apps/face-to-many-kontext",
        input=input_params,
    )

    if not output:
        raise TransformError("Model returned no output")

    result_url = output[0] if isinstance(output, list) else str(output)
    return await _download_result(result_url)


async def transform_with_face_to_many(
    image_bytes: bytes, style: CaricatureStyle
) -> bytes:
    """Transform using fofr/face-to-many model with custom prompts."""
    prepared, mime = _prepare_image(image_bytes)
    data_uri = _image_to_data_uri(prepared, mime)

    input_params: dict[str, Any] = {
        "image": data_uri,
        "prompt": style.prompt,
        "negative_prompt": style.negative_prompt,
        "instant_id_strength": 0.85,
        "ip_adapter_strength": 0.65,
        "control_depth_strength": 0.7,
        "num_outputs": 1,
    }

    if style.face_to_many_style:
        input_params["style"] = style.face_to_many_style

    output = await replicate.async_run("fofr/face-to-many", input=input_params)

    if not output:
        raise TransformError("Model returned no output")

    result_url = output[0] if isinstance(output, list) else str(output)
    return await _download_result(result_url)


async def transform_with_prompt(
    image_bytes: bytes, style: CaricatureStyle
) -> bytes:
    """Fallback: use flux-kontext cartoonify with style-aware prompting."""
    prepared, mime = _prepare_image(image_bytes)
    data_uri = _image_to_data_uri(prepared, mime)

    # Try face-to-many first (better style control), then kontext
    try:
        return await transform_with_face_to_many(image_bytes, style)
    except Exception:
        return await transform_with_kontext(image_bytes, style)


async def transform_image(image_bytes: bytes, style: CaricatureStyle) -> bytes:
    """Main entry point for image transformation."""
    token = _get_replicate_token()
    if not token:
        raise TransformError(
            "REPLICATE_API_TOKEN is not set. "
            "Get a free API token at https://replicate.com/account/api-tokens"
        )

    os.environ["REPLICATE_API_TOKEN"] = token

    try:
        return await transform_with_face_to_many(image_bytes, style)
    except Exception as first_error:
        try:
            return await transform_with_kontext(image_bytes, style)
        except Exception as second_error:
            raise TransformError(
                f"Transformation failed. Primary: {first_error}. "
                f"Fallback: {second_error}"
            ) from second_error
