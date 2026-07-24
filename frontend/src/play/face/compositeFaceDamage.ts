import { FACE_CONTAIN_PAD } from './composeFaceTexture';
import { FACE_SOURCE_SIZE } from './faceTemplate';
import type { FaceDamageId } from './faceDamage';
import {
  FACE_DAMAGE_ASSETS,
  FACE_DAMAGE_BASELINE_SRC,
  type DamageRegion,
  type FaceDamageAsset,
} from './faceDamageAssets';

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

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function redness(r: number, g: number, b: number): number {
  return r - (g + b) * 0.5;
}

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

type BBox = { x0: number; y0: number; x1: number; y1: number };

function contentBBox(img: ImageData, whiteBackdrop: boolean): BBox | null {
  const { width: w, height: h, data } = img;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (whiteBackdrop) {
        if (isBackdrop(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
      } else if (data[i + 3] < 20 || Math.max(data[i], data[i + 1], data[i + 2]) < 22) {
        continue;
      }
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < x0 || y1 < y0) return null;
  return { x0, y0, x1, y1 };
}

function sampleBilinear(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number
): [number, number, number, number] {
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(y)));
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const tx = x - Math.floor(x);
  const ty = y - Math.floor(y);
  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const top = data[i00 + c] + (data[i10 + c] - data[i00 + c]) * tx;
    const bot = data[i01 + c] + (data[i11 + c] - data[i01 + c]) * tx;
    out[c] = top + (bot - top) * ty;
  }
  return out;
}

/** Draw image stretched to w×h on black. */
function sampleStretched(image: HTMLImageElement, w: number, h: number): ImageData {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Align `image` content bbox onto `guide` content bbox (same canvas size).
 * Makes male↔damaged comparison isolate injuries instead of framing drift.
 */
function sampleAlignedToGuide(
  image: HTMLImageElement,
  guide: ImageData,
  w: number,
  h: number,
  treatWhiteAsBackdrop: boolean
): ImageData {
  const src = sampleStretched(image, w, h);
  const guideBox = contentBBox(guide, false);
  const srcBox = contentBBox(src, treatWhiteAsBackdrop);
  if (!guideBox || !srcBox) return src;

  const out = new ImageData(w, h);
  for (let i = 0; i < out.data.length; i += 4) out.data[i + 3] = 255;

  const gw = guideBox.x1 - guideBox.x0 + 1;
  const gh = guideBox.y1 - guideBox.y0 + 1;
  const sw = srcBox.x1 - srcBox.x0 + 1;
  const sh = srcBox.y1 - srcBox.y0 + 1;

  for (let y = guideBox.y0; y <= guideBox.y1; y++) {
    for (let x = guideBox.x0; x <= guideBox.x1; x++) {
      const u = (x - guideBox.x0 + 0.5) / gw;
      const v = (y - guideBox.y0 + 0.5) / gh;
      const sx = srcBox.x0 + u * sw - 0.5;
      const sy = srcBox.y0 + v * sh - 0.5;
      const [r, g, b, a] = sampleBilinear(src.data, w, h, sx, sy);
      if (treatWhiteAsBackdrop && isBackdrop(r, g, b, a)) continue;
      const i = (y * w + x) * 4;
      out.data[i] = clampByte(r);
      out.data[i + 1] = clampByte(g);
      out.data[i + 2] = clampByte(b);
      out.data[i + 3] = 255;
    }
  }
  return out;
}

function regionWeight(nx: number, ny: number, region: DamageRegion): number {
  const dx = (nx - region.cx) / region.rx;
  const dy = (ny - region.cy) / region.ry;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d >= 1) return 0;
  if (d < 0.55) return 1;
  return 1 - (d - 0.55) / 0.45;
}

/**
 * Build a float magnitude map, then a coarse local-median map (downscale → upscale)
 * so we can keep only local outliers = real injuries, not global texture drift.
 */
function localMedianMag(mag: Float32Array, w: number, h: number): Float32Array {
  const tw = Math.max(8, Math.round(w / 12));
  const th = Math.max(8, Math.round(h / 12));
  const tiny = new Float32Array(tw * th);
  const counts = new Float32Array(tw * th);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tx = Math.min(tw - 1, Math.floor((x / w) * tw));
      const ty = Math.min(th - 1, Math.floor((y / h) * th));
      const ti = ty * tw + tx;
      tiny[ti] += mag[y * w + x];
      counts[ti] += 1;
    }
  }
  for (let i = 0; i < tiny.length; i++) tiny[i] = counts[i] > 0 ? tiny[i] / counts[i] : 0;

  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fx = ((x + 0.5) / w) * tw - 0.5;
      const fy = ((y + 0.5) / h) * th - 0.5;
      const x0 = Math.max(0, Math.min(tw - 1, Math.floor(fx)));
      const y0 = Math.max(0, Math.min(th - 1, Math.floor(fy)));
      const x1 = Math.min(tw - 1, x0 + 1);
      const y1 = Math.min(th - 1, y0 + 1);
      const tx = fx - Math.floor(fx);
      const ty = fy - Math.floor(fy);
      const v00 = tiny[y0 * tw + x0];
      const v10 = tiny[y0 * tw + x1];
      const v01 = tiny[y1 * tw + x0];
      const v11 = tiny[y1 * tw + x1];
      out[y * w + x] = v00 + (v10 - v00) * tx + (v01 - v00) * ty + (v11 - v10 - v01 + v00) * tx * ty;
    }
  }
  return out;
}

function isInjuryDelta(
  mr: number,
  mg: number,
  mb: number,
  dr: number,
  dg: number,
  db: number,
  region: DamageRegion,
  maleWasBackdrop: boolean,
  mag: number,
  localMed: number
): boolean {
  const thr = region.diffThreshold ?? 24;
  if (maleWasBackdrop) return Boolean(region.allowGrow) && mag > 18;

  const dLum = luminance(dr, dg, db) - luminance(mr, mg, mb);
  const dRed = redness(dr, dg, db) - redness(mr, mg, mb);

  // Missing tooth / dark gap — prioritize strong darkening inside the mouth region.
  if (region.preferDarker) {
    return dLum < -16 && mag >= thr;
  }

  // Must beat local texture drift, but strong bruise/cut signals can pass on color alone.
  const localOk = mag >= localMed * 1.25 + thr * 0.55;
  if (!localOk && !(dLum < -22 || dRed > 18)) return false;
  if (mag < thr * 0.75) return false;

  if (region.preferRedder) {
    return dLum < -8 || dRed > 10 || mag > localMed * 1.8 + thr;
  }

  // Bandage / general structural change.
  return Math.abs(dLum) > 16 || mag > localMed * 1.7 + thr;
}

/**
 * Map male-canvas coords → target-canvas coords via content bounding boxes.
 * This is how an injury on the male nose lands on the female nose.
 */
function mapBoxToBox(
  x: number,
  y: number,
  from: BBox,
  to: BBox
): { x: number; y: number } {
  const fw = Math.max(1, from.x1 - from.x0);
  const fh = Math.max(1, from.y1 - from.y0);
  const tw = Math.max(1, to.x1 - to.x0);
  const th = Math.max(1, to.y1 - to.y0);
  const u = (x - from.x0) / fw;
  const v = (y - from.y0) / fh;
  return { x: to.x0 + u * tw, y: to.y0 + v * th };
}

/**
 * Apply one injury as (damaged − maleBaseline), remapped onto the live face bbox.
 */
export function compositeFaceDamageReference(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  maleBaseline: HTMLImageElement,
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

  let male = sampleStretched(maleBaseline, sw, sh);
  let damaged = sampleAlignedToGuide(damagedImage, male, sw, sh, true);
  if (mirror) {
    male = flipImageDataHorizontal(male);
    damaged = flipImageDataHorizontal(damaged);
  }

  const face = ctx.getImageData(Math.round(x), Math.round(y), sw, sh);
  const maleBox = contentBBox(male, false);
  const targetBox = contentBBox(face, false);
  if (!maleBox || !targetBox) {
    ctx.putImageData(face, Math.round(x), Math.round(y));
    return;
  }

  const m = male.data;
  const d = damaged.data;
  const f = face.data;
  const region = asset.region;
  const n = sw * sh;

  // Precompute |delta| magnitude + local median for outlier gating.
  const mag = new Float32Array(n);
  for (let i = 0, p = 0; p < n; p++, i += 4) {
    mag[p] =
      Math.abs(d[i] - m[i]) + Math.abs(d[i + 1] - m[i + 1]) + Math.abs(d[i + 2] - m[i + 2]);
  }
  const med = localMedianMag(mag, sw, sh);

  // Iterate in MALE injury space, stamp onto mapped TARGET coordinates.
  for (let py = 0; py < sh; py++) {
    for (let px = 0; px < sw; px++) {
      const p = py * sw + px;
      const i = p * 4;
      const nx = (px + 0.5) / sw;
      const ny = (py + 0.5) / sh;
      const weight = regionWeight(nx, ny, region);
      if (weight <= 0.02) continue;

      const mr = m[i];
      const mg = m[i + 1];
      const mb = m[i + 2];
      const ma = m[i + 3];
      const dr = d[i];
      const dg = d[i + 1];
      const db = d[i + 2];
      const da = d[i + 3];

      if (isBackdrop(dr, dg, db, da)) continue;
      const maleWasBackdrop = isBackdrop(mr, mg, mb, ma);
      if (!isInjuryDelta(mr, mg, mb, dr, dg, db, region, maleWasBackdrop, mag[p], med[p])) {
        continue;
      }

      const mapped = mapBoxToBox(px + 0.5, py + 0.5, maleBox, targetBox);
      const tx = Math.round(mapped.x - 0.5);
      const ty = Math.round(mapped.y - 0.5);
      if (tx < 0 || ty < 0 || tx >= sw || ty >= sh) continue;
      const ti = (ty * sw + tx) * 4;

      const tr = f[ti];
      const tg = f[ti + 1];
      const tb = f[ti + 2];
      const ta = f[ti + 3];
      const targetIsBackdrop = isBackdrop(tr, tg, tb, ta);

      const dR = dr - mr;
      const dG = dg - mg;
      const dB = db - mb;

      if (targetIsBackdrop) {
        if (!region.allowGrow) continue;
        f[ti] = clampByte(tr * (1 - weight) + dr * weight);
        f[ti + 1] = clampByte(tg * (1 - weight) + dg * weight);
        f[ti + 2] = clampByte(tb * (1 - weight) + db * weight);
        f[ti + 3] = clampByte(Math.max(ta, 255 * weight));
        continue;
      }

      if (region.preferDarker) {
        f[ti] = clampByte(tr + Math.min(0, dR) * weight);
        f[ti + 1] = clampByte(tg + Math.min(0, dG) * weight);
        f[ti + 2] = clampByte(tb + Math.min(0, dB) * weight);
        continue;
      }

      // Relative + additive mix: change without stamping male skin identity.
      const eps = 10;
      const rr = Math.max(0.25, Math.min(2.0, dr / Math.max(mr, eps)));
      const rg = Math.max(0.25, Math.min(2.0, dg / Math.max(mg, eps)));
      const rb = Math.max(0.25, Math.min(2.0, db / Math.max(mb, eps)));
      const candR = tr * rr;
      const candG = tg * rg;
      const candB = tb * rb;
      const addR = tr + dR;
      const addG = tg + dG;
      const addB = tb + dB;
      const mixedR = candR * 0.65 + addR * 0.35;
      const mixedG = candG * 0.65 + addG * 0.35;
      const mixedB = candB * 0.65 + addB * 0.35;

      f[ti] = clampByte(tr * (1 - weight) + mixedR * weight);
      f[ti + 1] = clampByte(tg * (1 - weight) + mixedG * weight);
      f[ti + 2] = clampByte(tb * (1 - weight) + mixedB * weight);
    }
  }

  ctx.putImageData(face, Math.round(x), Math.round(y));
}

export function compositeReferenceDamages(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  maleBaseline: HTMLImageElement,
  damages: readonly FaceDamageId[],
  imagesBySrc: ReadonlyMap<string, HTMLImageElement>
) {
  for (const id of damages) {
    const asset = FACE_DAMAGE_ASSETS[id];
    if (!asset) continue;
    const img = imagesBySrc.get(asset.src);
    if (!img) continue;
    compositeFaceDamageReference(ctx, canvasW, canvasH, maleBaseline, img, asset);
  }
}

export function proceduralDamagesOnly(
  damages: readonly FaceDamageId[]
): FaceDamageId[] {
  return damages.filter((id) => !FACE_DAMAGE_ASSETS[id]);
}

export { FACE_DAMAGE_BASELINE_SRC };
