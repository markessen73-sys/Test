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

/**
 * Paint transparent holes *inside* a cutout silhouette black (leave exterior clear).
 * Used on stock boxer faces on the white bobo head so glasses / mouth gaps don't show white.
 */
export function fillClearInteriorBlack(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  alphaThreshold = 12,
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const n = width * height;
  const exterior = new Uint8Array(n);
  const queue = new Int32Array(n);
  let qh = 0;
  let qt = 0;

  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (exterior[i]) return;
    if ((data[i * 4 + 3] ?? 0) > alphaThreshold) return;
    exterior[i] = 1;
    queue[qt++] = i;
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (qh < qt) {
    const i = queue[qh++]!;
    const x = i % width;
    const y = (i / width) | 0;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }

  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3] ?? 0;
    if (a > alphaThreshold) continue;
    if (exterior[i]) continue;
    const o = i * 4;
    data[o] = 0;
    data[o + 1] = 0;
    data[o + 2] = 0;
    data[o + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}
