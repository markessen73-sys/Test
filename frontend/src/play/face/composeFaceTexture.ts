import type { FacePunchWarp } from './types';
import { DEFAULT_FACE_WARP, type NormRect } from './types';
import { FACE_SOURCE_OVAL } from './faceTemplate';

function rectPixels(rect: NormRect, w: number, h: number) {
  const [x0, y0, x1, y1] = rect;
  return {
    x: Math.round(x0 * w),
    y: Math.round(y0 * h),
    width: Math.round((x1 - x0) * w),
    height: Math.round((y1 - y0) * h),
  };
}

/** Load an image for canvas compositing. */
export function loadFaceImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Draw the template face (cropped to faceOval) into a square canvas.
 * Used for 3D decals and HUD portraits until caricature pipeline is wired.
 */
export function drawFaceOnCanvas(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  size: number,
  sourceOval: NormRect = FACE_SOURCE_OVAL,
  warp: FacePunchWarp = DEFAULT_FACE_WARP
) {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const crop = rectPixels(sourceOval, w, h);

  ctx.clearRect(0, 0, size, size);
  const cx = size / 2 + (warp.offsetX ?? 0) * size;
  const cy = size / 2 + (warp.offsetY ?? 0) * size;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(warp.rotation ?? 0);
  ctx.scale(warp.squashX ?? 1, warp.squashY ?? 1);

  const draw = size * 0.96;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, -draw / 2, -draw / 2, draw, draw);
  ctx.restore();
}

/** Punch reaction warp — jab squashes horizontally. */
export function warpForPunch(): FacePunchWarp {
  return { squashX: 0.78, squashY: 1.08, offsetX: -0.04, rotation: -0.08 };
}
