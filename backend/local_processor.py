"""Local free caricature processing (no API credits required)."""

import io

import cv2
import numpy as np
from PIL import Image

from styles import CaricatureStyle


def _pil_to_cv2(image_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def _cv2_to_png_bytes(image: np.ndarray) -> bytes:
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    pil = Image.fromarray(rgb)
    buffer = io.BytesIO()
    pil.save(buffer, format="PNG")
    return buffer.getvalue()


def _cartoon_base(image: np.ndarray, edge_strength: float = 1.0) -> np.ndarray:
    """Edge-preserving cartoon filter."""
    h, w = image.shape[:2]
    scale = min(1.0, 800 / max(h, w))
    if scale < 1.0:
        image = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    smooth = cv2.bilateralFilter(image, d=9, sigmaColor=80, sigmaSpace=80)
    smooth = cv2.bilateralFilter(smooth, d=9, sigmaColor=80, sigmaSpace=80)

    gray = cv2.cvtColor(smooth, cv2.COLOR_BGR2GRAY)
    blur = cv2.medianBlur(gray, 7)
    edges = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 9, 2
    )
    edges = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)

    # Reduce color levels for flat cartoon look
    data = smooth.reshape((-1, 3)).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    _, labels, centers = cv2.kmeans(data, 8, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
    centers = np.uint8(centers)
    flat = centers[labels.flatten()].reshape(smooth.shape)

    edges_inv = cv2.bitwise_not(edges)
    cartoon = cv2.bitwise_and(flat, edges_inv)

    if edge_strength != 1.0:
        cartoon = cv2.addWeighted(cartoon, 1.0, edges, edge_strength * 0.3, 0)

    return cartoon


def _apply_color_grade(image: np.ndarray, style: CaricatureStyle) -> np.ndarray:
    """Apply style-specific color grading."""
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)

    style_id = style.id
    if style_id == "simpsons":
        hsv[:, :, 0] = np.clip(hsv[:, :, 0] * 0.3 + 20, 0, 179)  # yellow hue
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.4, 0, 255)
        hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 1.1, 0, 255)
    elif style_id == "family_guy":
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.2, 0, 255)
        hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 1.05, 0, 255)
    elif style_id == "south_park":
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 0.6, 0, 255)
        data = image.reshape((-1, 3)).astype(np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
        _, labels, centers = cv2.kmeans(data, 5, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
        image = centers[labels.flatten()].reshape(image.shape).astype(np.uint8)
        return image
    elif style_id == "anime":
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.5, 0, 255)
        hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 1.15, 0, 255)
    elif style_id == "pixar":
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.1, 0, 255)
        hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 1.2, 0, 255)
    elif style_id == "exaggerated":
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.3, 0, 255)
    elif style_id == "retro":
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 0.4, 0, 255)
        hsv[:, :, 2] = np.clip(hsv[:, :, 2] * 0.85, 0, 255)
    elif style_id == "comic":
        hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.6, 0, 255)

    return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)


def _exaggerate_features(image: np.ndarray) -> np.ndarray:
    """Bulge warp toward center for caricature proportions."""
    h, w = image.shape[:2]
    center = (w // 2, int(h * 0.38))
    radius = min(w, h) // 3
    strength = 0.35

    map_x = np.zeros((h, w), dtype=np.float32)
    map_y = np.zeros((h, w), dtype=np.float32)

    for y in range(h):
        for x in range(w):
            dx = x - center[0]
            dy = y - center[1]
            dist = np.sqrt(dx * dx + dy * dy)
            if dist < radius:
                factor = 1.0 - strength * (1.0 - (dist / radius) ** 2)
                map_x[y, x] = center[0] + dx * factor
                map_y[y, x] = center[1] + dy * factor
            else:
                map_x[y, x] = x
                map_y[y, x] = y

    return cv2.remap(image, map_x, map_y, interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def transform_local(image_bytes: bytes, style: CaricatureStyle) -> bytes:
    """Apply free local cartoon/caricature filter."""
    image = _pil_to_cv2(image_bytes)

    if style.id == "exaggerated":
        image = _exaggerate_features(image)

    edge = 1.4 if style.id in ("simpsons", "comic", "south_park") else 1.0
    cartoon = _cartoon_base(image, edge_strength=edge)
    styled = _apply_color_grade(cartoon, style)

    return _cv2_to_png_bytes(styled)
