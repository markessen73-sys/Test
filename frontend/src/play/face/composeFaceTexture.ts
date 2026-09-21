import type { FacePunchWarp } from './types';
import { DEFAULT_FACE_WARP, type NormRect } from './types';
import { FACE_SOURCE_OVAL } from './faceTemplate';

/** Match drawFullFaceOnCanvas contain padding. */
export const FACE_CONTAIN_PAD = 0.94;

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
 * Draw the template face (cropped to faceOval) into a canvas.
 * Uses cover-fit so the head fills wide or tall destination rects.
 */
export function drawFaceOnCanvas(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number = width,
  sourceOval: NormRect = FACE_SOURCE_OVAL,
  warp: FacePunchWarp = DEFAULT_FACE_WARP
) {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const crop = rectPixels(sourceOval, w, h);

  ctx.clearRect(0, 0, width, height);
  const cx = width / 2 + (warp.offsetX ?? 0) * width;
  const cy = height / 2 + (warp.offsetY ?? 0) * height;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(warp.rotation ?? 0);
  ctx.scale(warp.squashX ?? 1, warp.squashY ?? 1);

  const cover = Math.max(width / crop.width, height / crop.height) * 0.98;
  const drawW = crop.width * cover;
  const drawH = crop.height * cover;
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}

/** Punch reaction warp — jab squashes horizontally. */
export function warpForPunch(): FacePunchWarp {
  return { squashX: 0.78, squashY: 1.08, offsetX: -0.04, rotation: -0.08 };
}

/**
 * Draw the full caricature image with contain-fit — nothing clipped.
 * Used for the sparring partner where the whole head must remain visible.
 */
export function drawFullFaceOnCanvas(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number = width,
  warp: FacePunchWarp = DEFAULT_FACE_WARP
) {
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;

  ctx.clearRect(0, 0, width, height);
  const cx = width / 2 + (warp.offsetX ?? 0) * width;
  const cy = height / 2 + (warp.offsetY ?? 0) * height;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(warp.rotation ?? 0);
  ctx.scale(warp.squashX ?? 1, warp.squashY ?? 1);

  const contain = Math.min(width / iw, height / ih) * FACE_CONTAIN_PAD;
  const drawW = iw * contain;
  const drawH = ih * contain;
  ctx.drawImage(image, 0, 0, iw, ih, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}
