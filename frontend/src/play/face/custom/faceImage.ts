import { assetUrl } from '../../../assetUrl';
import { LM, W, H } from '../bake/faceDamageBake';
import { detectFaceLandmarks, type FaceLandmarks } from './faceDetect';

export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

/** Crop a face box with padding onto a square canvas (still a photo). */
export function cropFaceToSquare(
  source: HTMLImageElement | HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
  padding = 0.55
): HTMLCanvasElement {
  const srcW = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const side = Math.max(box.width, box.height) * (1 + padding * 2);
  const x0 = Math.max(0, cx - side / 2);
  const y0 = Math.max(0, cy - side / 2);
  const x1 = Math.min(srcW, cx + side / 2);
  const y1 = Math.min(srcH, cy + side / 2);
  const sw = x1 - x0;
  const sh = y1 - y0;
  const size = Math.max(sw, sh);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const dx = (size - sw) / 2;
  const dy = (size - sh) / 2;
  ctx.drawImage(source, x0, y0, sw, sh, dx, dy, sw, sh);
  return canvas;
}

export async function canvasToJpegFile(canvas: HTMLCanvasElement, name = 'face.jpg'): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG encode failed'))), 'image/jpeg', 0.92);
  });
  return new File([blob], name, { type: 'image/jpeg' });
}

function getImageData(img: HTMLImageElement | HTMLCanvasElement, w = W, h = H): ImageData {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Affine-align eyes + mouth to bake landmarks, then scale mid-face width toward Default.
 */
export async function alignFaceToLandmarks(
  source: HTMLImageElement | HTMLCanvasElement,
  landmarks?: FaceLandmarks | null
): Promise<ImageData> {
  const lm = landmarks ?? (await detectFaceLandmarks(source instanceof HTMLCanvasElement ? source : source));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);

  const srcW = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  if (!lm) {
    // Fallback: center-fit.
    const scale = Math.min(W / srcW, H / srcH) * 0.92;
    const dw = srcW * scale;
    const dh = srcH * scale;
    ctx.drawImage(source, (W - dw) / 2, (H - dh) / 2, dw, dh);
    return cutBlackBackdrop(ctx.getImageData(0, 0, W, H));
  }

  // Source points (pixels) → destination LM points.
  const srcPts = [
    { x: lm.rightEye.x * srcW, y: lm.rightEye.y * srcH },
    { x: lm.leftEye.x * srcW, y: lm.leftEye.y * srcH },
    { x: lm.mouth.x * srcW, y: lm.mouth.y * srcH },
  ];
  const dstPts = [
    { x: LM.rightEye.x * W, y: LM.rightEye.y * H },
    { x: LM.leftEye.x * W, y: LM.leftEye.y * H },
    { x: LM.mouth.x * W, y: LM.mouth.y * H },
  ];

  const M = similarityFromThree(srcPts, dstPts);
  ctx.save();
  ctx.setTransform(M.a, M.b, M.c, M.d, M.e, M.f);
  ctx.drawImage(source, 0, 0);
  ctx.restore();

  let face = cutBlackBackdrop(ctx.getImageData(0, 0, W, H));
  face = await matchDefaultMidFaceWidth(face);
  return face;
}

/** Similarity transform from 3 point pairs (least squares on first 2 for scale/rot, mouth for refine). */
function similarityFromThree(
  src: { x: number; y: number }[],
  dst: { x: number; y: number }[]
): { a: number; b: number; c: number; d: number; e: number; f: number } {
  // Use eye pair for scale + rotation + translation.
  const s0 = src[0];
  const s1 = src[1];
  const d0 = dst[0];
  const d1 = dst[1];
  const svx = s1.x - s0.x;
  const svy = s1.y - s0.y;
  const dvx = d1.x - d0.x;
  const dvy = d1.y - d0.y;
  const sLen = Math.hypot(svx, svy) || 1;
  const dLen = Math.hypot(dvx, dvy) || 1;
  const scale = dLen / sLen;
  const sAng = Math.atan2(svy, svx);
  const dAng = Math.atan2(dvy, dvx);
  const ang = dAng - sAng;
  const cos = Math.cos(ang) * scale;
  const sin = Math.sin(ang) * scale;
  // Map s0 → d0
  const e = d0.x - (cos * s0.x - sin * s0.y);
  const f = d0.y - (sin * s0.x + cos * s0.y);
  return { a: cos, b: sin, c: -sin, d: cos, e, f };
}

function cutBlackBackdrop(img: ImageData): ImageData {
  const { data, width, height } = img;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < 18 || (min > 235 && max - min < 12)) {
      data[i + 3] = 0;
    }
  }
  // Soft fringe: keep as-is. Return same buffer.
  void width;
  void height;
  return img;
}

let defaultMidFaceWidth: number | null = null;

async function getDefaultMidFaceWidth(): Promise<number> {
  if (defaultMidFaceWidth != null) return defaultMidFaceWidth;
  const img = await loadImageFromUrl(assetUrl('/faces/characters/default/clean.png'));
  const id = getImageData(img);
  defaultMidFaceWidth = measureMidFaceWidth(id);
  return defaultMidFaceWidth;
}

export function measureMidFaceWidth(img: ImageData, yNorm = 0.55): number {
  const y = Math.floor(yNorm * img.height);
  const row = y * img.width * 4;
  let left = -1;
  let right = -1;
  for (let x = 0; x < img.width; x++) {
    if (img.data[row + x * 4 + 3] > 40) {
      left = x;
      break;
    }
  }
  for (let x = img.width - 1; x >= 0; x--) {
    if (img.data[row + x * 4 + 3] > 40) {
      right = x;
      break;
    }
  }
  if (left < 0 || right < 0) return img.width * 0.5;
  return right - left + 1;
}

async function matchDefaultMidFaceWidth(face: ImageData): Promise<ImageData> {
  const target = await getDefaultMidFaceWidth();
  const current = measureMidFaceWidth(face);
  if (current < 8) return face;
  const scale = target / current;
  if (Math.abs(scale - 1) < 0.02) return face;

  const pivotX = ((LM.rightEye.x + LM.leftEye.x) / 2) * W;
  const pivotY = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);
  const tmp = canvasFromImageData(face);
  ctx.translate(pivotX, pivotY);
  ctx.scale(scale, scale);
  ctx.translate(-pivotX, -pivotY);
  ctx.drawImage(tmp, 0, 0);
  return cutBlackBackdrop(ctx.getImageData(0, 0, W, H));
}

function canvasFromImageData(img: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

/** Build a simple ooh expression (widen mouth zone) from clean. */
export function synthesizeOoh(clean: ImageData): ImageData {
  const out = new ImageData(clean.width, clean.height);
  out.data.set(clean.data);
  const mouth = LM.mouth;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const dx = (nx - mouth.x) / 0.12;
      const dy = (ny - mouth.y) / 0.07;
      if (dx * dx + dy * dy > 1) continue;
      // Sample from slightly above to open the mouth.
      const srcY = Math.min(H - 1, Math.max(0, Math.round(y - 10 * (1 - dy * dy))));
      const i = (y * W + x) * 4;
      const si = (srcY * W + x) * 4;
      if (clean.data[si + 3] < 20) continue;
      out.data[i] = clean.data[si];
      out.data[i + 1] = clean.data[si + 1];
      out.data[i + 2] = clean.data[si + 2];
      out.data[i + 3] = clean.data[si + 3];
    }
  }
  return out;
}

/** Build a KO expression: shut lids + frown + stars. */
export function synthesizeKnockout(clean: ImageData): ImageData {
  const out = new ImageData(clean.width, clean.height);
  out.data.set(clean.data);
  for (const eye of [LM.leftEye, LM.rightEye]) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        const dx = (nx - eye.x) / 0.07;
        const dy = (ny - eye.y) / 0.055;
        if (dx * dx + dy * dy > 1) continue;
        const i = (y * W + x) * 4;
        // Sample cheek skin below the eye for lid colour.
        const sx = Math.max(0, Math.min(W - 1, x + (x < W / 2 ? -18 : 18)));
        const sy = Math.max(0, Math.min(H - 1, y + 22));
        const si = (sy * W + sx) * 4;
        let lr = clean.data[si];
        let lg = clean.data[si + 1];
        let lb = clean.data[si + 2];
        if (clean.data[si + 3] < 40) {
          lr = 220;
          lg = 160;
          lb = 120;
        }
        out.data[i] = lr;
        out.data[i + 1] = lg;
        out.data[i + 2] = lb;
        out.data[i + 3] = 255;
        const lidY = eye.y + 0.01 + Math.pow(Math.abs(nx - eye.x) / 0.055, 2) * 0.014;
        if (Math.abs(ny - lidY) < 0.008 && Math.abs(nx - eye.x) < 0.055) {
          out.data[i] = 40;
          out.data[i + 1] = 28;
          out.data[i + 2] = 30;
        }
      }
    }
  }
  // Stars in the corners.
  const stars = [
    { x: 0.2, y: 0.2, s: 0.034 },
    { x: 0.8, y: 0.18, s: 0.032 },
    { x: 0.16, y: 0.36, s: 0.028 },
    { x: 0.84, y: 0.34, s: 0.028 },
  ];
  for (const st of stars) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        const dx = (nx - st.x) / st.s;
        const dy = (ny - st.y) / st.s;
        const ang = Math.atan2(dy, dx);
        const r = Math.hypot(dx, dy);
        const tip = Math.cos(ang * 5) * 0.5 + 0.5;
        const rad = 0.45 + tip * 0.55;
        if (r > rad) continue;
        const i = (y * W + x) * 4;
        if (out.data[i + 3] > 40 && ny > 0.28) continue;
        out.data[i] = 255;
        out.data[i + 1] = 220;
        out.data[i + 2] = 60;
        out.data[i + 3] = 255;
      }
    }
  }
  return out;
}

/**
 * Client-side flat-cartoon fallback when the transform API is unavailable.
 * Posterize + ink edges on a black backdrop (head already cropped).
 */
export async function localCartoonize(file: File): Promise<Blob> {
  const img = await loadImageFromBlob(file);
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
  const id = ctx.getImageData(0, 0, size, size);
  const d = id.data;
  // Posterize + slight saturation boost.
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 10) continue;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (Math.max(r, g, b) < 20) {
      d[i + 3] = 0;
      continue;
    }
    const levels = 7;
    const q = 255 / (levels - 1);
    d[i] = Math.round(r / q) * q;
    d[i + 1] = Math.round(g / q) * q;
    d[i + 2] = Math.round(b / q) * q;
  }
  // Simple ink outline where luminance jumps.
  const copy = new Uint8ClampedArray(d);
  const lum = (i: number) => 0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2];
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = (y * size + x) * 4;
      if (copy[i + 3] < 20) continue;
      const gx = lum(i + 4) - lum(i - 4);
      const gy = lum(i + size * 4) - lum(i - size * 4);
      if (Math.hypot(gx, gy) > 38) {
        d[i] = 20;
        d[i + 1] = 12;
        d[i + 2] = 10;
      }
    }
  }
  ctx.putImageData(id, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('cartoon encode failed'))), 'image/png');
  });
}
