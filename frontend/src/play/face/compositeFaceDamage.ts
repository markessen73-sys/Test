import { FACE_CONTAIN_PAD } from './composeFaceTexture';
import { FACE_SOURCE_SIZE } from './faceTemplate';
import type { FaceDamageId } from './faceDamage';
import { FACE_DAMAGE_ASSETS } from './faceDamageAssets';

const [IMAGE_W, IMAGE_H] = FACE_SOURCE_SIZE;

/** RGB distance threshold — pixels that differ this much are treated as damage. */
const DIFF_THRESHOLD = 32;

function faceDrawRect(canvasW: number, canvasH: number) {
  const contain = Math.min(canvasW / IMAGE_W, canvasH / IMAGE_H) * FACE_CONTAIN_PAD;
  const drawW = IMAGE_W * contain;
  const drawH = IMAGE_H * contain;
  return {
    x: (canvasW - drawW) / 2,
    y: (canvasH - drawH) / 2,
    w: drawW,
    h: drawH,
  };
}

function sampleImage(image: HTMLImageElement, w: number, h: number): ImageData {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  // Fill with black so RGB-only (no alpha) white-bg images don't leave holes —
  // background filtering still rejects near-white / near-black pixels.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** True for transparent, white, light-gray, or solid black backdrop pixels. */
function isBackdrop(r: number, g: number, b: number, a: number): boolean {
  if (a < 20) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Solid / near-black studio backdrop
  if (max < 22) return true;
  // White or light-gray export backdrop (common on RGB PNGs without alpha)
  if (min > 232) return true;
  if (min > 200 && max - min < 14) return true;
  return false;
}

function flipImageDataHorizontal(src: ImageData): ImageData {
  const { width: w, height: h, data } = src;
  const out = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const di = (y * w + (w - 1 - x)) * 4;
      out.data[di] = data[si];
      out.data[di + 1] = data[si + 1];
      out.data[di + 2] = data[si + 2];
      out.data[di + 3] = data[si + 3];
    }
  }
  return out;
}

/**
 * Build a transparent layer of damage pixels (diff vs base), optionally mirrored.
 * Skips backdrop pixels so white/transparent reference backgrounds never paint.
 */
function buildDamageLayer(
  baseImage: HTMLImageElement,
  damagedImage: HTMLImageElement,
  sw: number,
  sh: number,
  mirror: boolean
): HTMLCanvasElement {
  const baseData = sampleImage(baseImage, sw, sh);
  const dmgData = sampleImage(damagedImage, sw, sh);
  const out = new ImageData(sw, sh);
  const b = baseData.data;
  const d = dmgData.data;
  const o = out.data;

  for (let i = 0; i < b.length; i += 4) {
    // Never paint outside the base face silhouette — fixes white/colored bg bleed.
    if (isBackdrop(b[i], b[i + 1], b[i + 2], b[i + 3])) {
      o[i + 3] = 0;
      continue;
    }
    if (isBackdrop(d[i], d[i + 1], d[i + 2], d[i + 3])) {
      o[i + 3] = 0;
      continue;
    }

    const dr = Math.abs(d[i] - b[i]);
    const dg = Math.abs(d[i + 1] - b[i + 1]);
    const db = Math.abs(d[i + 2] - b[i + 2]);
    if (dr + dg + db > DIFF_THRESHOLD) {
      o[i] = d[i];
      o[i + 1] = d[i + 1];
      o[i + 2] = d[i + 2];
      o[i + 3] = 255;
    } else {
      o[i + 3] = 0;
    }
  }

  const layerData = mirror ? flipImageDataHorizontal(out) : out;
  const layer = document.createElement('canvas');
  layer.width = sw;
  layer.height = sh;
  layer.getContext('2d')!.putImageData(layerData, 0, 0);
  return layer;
}

/** Composite one reference damage (with optional horizontal mirror) onto the face. */
export function compositeFaceDamageReference(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  baseImage: HTMLImageElement,
  damagedImage: HTMLImageElement,
  mirror = false
) {
  const { x, y, w, h } = faceDrawRect(canvasW, canvasH);
  const sw = Math.max(1, Math.round(w));
  const sh = Math.max(1, Math.round(h));
  const layer = buildDamageLayer(baseImage, damagedImage, sw, sh, mirror);
  ctx.drawImage(layer, x, y, w, h);
}

/** Apply all damages that have pre-rendered reference faces. */
export function compositeReferenceDamages(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  baseImage: HTMLImageElement,
  damages: readonly FaceDamageId[],
  imagesBySrc: ReadonlyMap<string, HTMLImageElement>
) {
  for (const id of damages) {
    const asset = FACE_DAMAGE_ASSETS[id];
    if (!asset) continue;
    const img = imagesBySrc.get(asset.src);
    if (!img) continue;
    const mirror = asset.nativeSide !== asset.targetSide;
    compositeFaceDamageReference(ctx, canvasW, canvasH, baseImage, img, mirror);
  }
}

/** Damages that still use procedural canvas art (no reference PNG yet). */
export function proceduralDamagesOnly(
  damages: readonly FaceDamageId[]
): FaceDamageId[] {
  return damages.filter((id) => !FACE_DAMAGE_ASSETS[id]);
}
