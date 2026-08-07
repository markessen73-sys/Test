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
    const x = i % width;
    const y = (i / width) | 0;
    // Sample nearby opaque colour. Dark surrounds (mouth cavities) stay black;
    // light surrounds (blonde hair gaps) fill with that hair colour — not ink black.
    let sr = 0,
      sg = 0,
      sb = 0,
      sn = 0,
      sumL = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = (ny * width + nx) * 4;
        if ((data[j + 3] ?? 0) <= alphaThreshold) continue;
        const r = data[j] ?? 0;
        const g = data[j + 1] ?? 0;
        const b = data[j + 2] ?? 0;
        sr += r;
        sg += g;
        sb += b;
        sumL += 0.299 * r + 0.587 * g + 0.114 * b;
        sn++;
      }
    }
    if (sn > 0 && sumL / sn >= 90) {
      data[o] = Math.round(sr / sn);
      data[o + 1] = Math.round(sg / sn);
      data[o + 2] = Math.round(sb / sn);
      data[o + 3] = 255;
    } else {
      data[o] = 0;
      data[o + 1] = 0;
      data[o + 2] = 0;
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function easeInQuad(t: number) {
  return t * t;
}

/**
 * Soft-blend the bottom of a face cutout toward a body/neck colour and fade alpha.
 * Bottom of opaque content → transparent + body tint; top of band → original face.
 * Call after drawing the face (and after hole-fill) so the chin meets mismatched bodies.
 */
export function blendNeckTowardColor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bodyRgb: { r: number; g: number; b: number },
  frac = 0.12,
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if ((data[row + x * 4 + 3] ?? 0) > 12) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        break;
      }
    }
  }
  if (maxY < 0 || maxY <= minY) return;

  const contentH = maxY - minY + 1;
  const fadeH = Math.max(10, Math.round(contentH * Math.min(0.28, Math.max(0.06, frac))));
  const fadeStart = Math.max(minY, maxY - fadeH + 1);

  for (let y = fadeStart; y <= maxY; y++) {
    const t = (y - fadeStart) / Math.max(1, maxY - fadeStart);
    const ease = easeInQuad(t);
    // Colour shift ramps faster than alpha so a tinted seam reads before the fade-out.
    const colorMix = Math.min(1, ease * 1.15);
    const alphaMul = 1 - ease * 0.92;
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      const o = row + x * 4;
      const a = data[o + 3] ?? 0;
      if (a < 8) continue;
      data[o] = Math.round((data[o] ?? 0) * (1 - colorMix) + bodyRgb.r * colorMix);
      data[o + 1] = Math.round((data[o + 1] ?? 0) * (1 - colorMix) + bodyRgb.g * colorMix);
      data[o + 2] = Math.round((data[o + 2] ?? 0) * (1 - colorMix) + bodyRgb.b * colorMix);
      data[o + 3] = Math.round(a * alphaMul);
    }
  }
  for (let y = maxY + 1; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      data[row + x * 4 + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Average opaque RGB in a band just below the head slot on a body texture.
 * Returns null if the sample is empty / mostly clear.
 */
export function sampleBodyNeckColor(
  image: HTMLImageElement | HTMLCanvasElement,
  faceRect: NormRect,
): { r: number; g: number; b: number } | null {
  const w = 'naturalWidth' in image ? image.naturalWidth || image.width : image.width;
  const h = 'naturalHeight' in image ? image.naturalHeight || image.height : image.height;
  if (w < 4 || h < 4) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);

  const [, , , faceY1] = faceRect;
  const y0 = Math.min(h - 2, Math.max(0, Math.floor(faceY1 * h)));
  const y1 = Math.min(h - 1, y0 + Math.max(6, Math.round(h * 0.045)));
  const x0 = Math.floor(faceRect[0] * w);
  const x1 = Math.ceil(faceRect[2] * w);
  const midW = Math.max(4, Math.round((x1 - x0) * 0.55));
  const cx = Math.round((x0 + x1) / 2);
  const sx0 = Math.max(0, cx - Math.floor(midW / 2));
  const sx1 = Math.min(w - 1, cx + Math.ceil(midW / 2));

  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = sx0; x <= sx1; x++) {
      const i = (y * w + x) * 4;
      if ((data[i + 3] ?? 0) < 140) continue;
      // Prefer skin-ish / mid tones over pure black head blanks / neon.
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const L = (r + g + b) / 3;
      if (L < 25 || L > 245) continue;
      const wgt = L > 55 && L < 210 ? 2 : 1;
      sr += r * wgt;
      sg += g * wgt;
      sb += b * wgt;
      n += wgt;
    }
  }
  if (n < 8) return null;
  return { r: Math.round(sr / n), g: Math.round(sg / n), b: Math.round(sb / n) };
}
