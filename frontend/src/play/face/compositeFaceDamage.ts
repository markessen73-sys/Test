import { FACE_CONTAIN_PAD } from './composeFaceTexture';
import { FACE_SOURCE_SIZE } from './faceTemplate';
import type { FaceDamageId } from './faceDamage';
import { FACE_DAMAGE_ASSETS, type DamageRegion, type FaceDamageAsset } from './faceDamageAssets';

const [IMAGE_W, IMAGE_H] = FACE_SOURCE_SIZE;

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

/** Sample full image into sw×sh — same framing as drawFullFaceOnCanvas. */
function sampleImage(image: HTMLImageElement, w: number, h: number): ImageData {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
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
  if (max < 22) return true;
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

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Soft elliptical weight — stays opaque through most of the region. */
function regionWeight(nx: number, ny: number, region: DamageRegion): number {
  const dx = (nx - region.cx) / region.rx;
  const dy = (ny - region.cy) / region.ry;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d >= 1) return 0;
  if (d < 0.65) return 1;
  return 1 - (d - 0.65) / 0.35;
}

function acceptsPixelChange(
  br: number,
  bg: number,
  bb: number,
  dr: number,
  dg: number,
  db: number,
  region: DamageRegion,
  baseWasBackdrop: boolean
): boolean {
  const thr = region.diffThreshold ?? 24;
  const diff = Math.abs(dr - br) + Math.abs(dg - bg) + Math.abs(db - bb);

  // Injury grows past original silhouette (big cauliflower ear / puffy lip).
  if (baseWasBackdrop) return true;
  if (diff < thr) return false;

  if (region.preferDarker) {
    return luminance(dr, dg, db) < luminance(br, bg, bb) - 18;
  }

  if (region.preferRedder) {
    const baseWarm = br - (bg + bb) * 0.5;
    const dmgWarm = dr - (dg + db) * 0.5;
    const gotDarker = luminance(dr, dg, db) < luminance(br, bg, bb) - 6;
    return diff > thr * 1.5 || dmgWarm > baseWarm + 4 || gotDarker;
  }

  return true;
}

/**
 * Build a transparent layer of localized injury deltas from a reference face.
 * Only pixels inside `region` that change the feature are kept.
 */
function buildDamageLayer(
  baseImage: HTMLImageElement,
  damagedImage: HTMLImageElement,
  sw: number,
  sh: number,
  region: DamageRegion,
  mirror: boolean
): HTMLCanvasElement {
  const baseData = sampleImage(baseImage, sw, sh);
  const dmgData = sampleImage(damagedImage, sw, sh);
  const out = new ImageData(sw, sh);
  const b = baseData.data;
  const d = dmgData.data;
  const o = out.data;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      const nx = (x + 0.5) / sw;
      const ny = (y + 0.5) / sh;
      const weight = regionWeight(nx, ny, region);
      if (weight <= 0) {
        o[i + 3] = 0;
        continue;
      }

      if (isBackdrop(d[i], d[i + 1], d[i + 2], d[i + 3])) {
        o[i + 3] = 0;
        continue;
      }

      const baseWasBackdrop = isBackdrop(b[i], b[i + 1], b[i + 2], b[i + 3]);
      if (baseWasBackdrop && !region.allowGrow) {
        o[i + 3] = 0;
        continue;
      }

      if (
        !acceptsPixelChange(
          b[i],
          b[i + 1],
          b[i + 2],
          d[i],
          d[i + 1],
          d[i + 2],
          region,
          baseWasBackdrop
        )
      ) {
        o[i + 3] = 0;
        continue;
      }

      o[i] = d[i];
      o[i + 1] = d[i + 1];
      o[i + 2] = d[i + 2];
      o[i + 3] = Math.round(255 * Math.max(0.85, weight));
    }
  }

  const layerData = mirror ? flipImageDataHorizontal(out) : out;
  const layer = document.createElement('canvas');
  layer.width = sw;
  layer.height = sh;
  layer.getContext('2d')!.putImageData(layerData, 0, 0);
  return layer;
}

/** Composite one localized injury delta onto the accumulating face canvas. */
export function compositeFaceDamageReference(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  baseImage: HTMLImageElement,
  damagedImage: HTMLImageElement,
  asset: FaceDamageAsset
) {
  const { x, y, w, h } = faceDrawRect(canvasW, canvasH);
  const sw = Math.max(1, Math.round(w));
  const sh = Math.max(1, Math.round(h));
  const mirror =
    !!asset.nativeSide &&
    !!asset.targetSide &&
    asset.nativeSide !== asset.targetSide;
  const layer = buildDamageLayer(baseImage, damagedImage, sw, sh, asset.region, mirror);
  ctx.drawImage(layer, x, y, w, h);
}

/**
 * Cumulatively apply each injury as a localized patch on top of the base face.
 */
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
    compositeFaceDamageReference(ctx, canvasW, canvasH, baseImage, img, asset);
  }
}

/** Damages that still use procedural canvas art (no reference PNG yet). */
export function proceduralDamagesOnly(
  damages: readonly FaceDamageId[]
): FaceDamageId[] {
  return damages.filter((id) => !FACE_DAMAGE_ASSETS[id]);
}
