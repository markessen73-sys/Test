import { FACE_CONTAIN_PAD } from './composeFaceTexture';
import { FACE_SOURCE_SIZE } from './faceTemplate';
import type { FaceDamageId } from './faceDamage';
import {
  FACE_DAMAGE_ASSETS,
  FACE_DAMAGE_BASELINE_SRC,
  MALE_DAMAGE_LANDMARKS,
  TARGET_DAMAGE_LANDMARKS,
  type DamageRegion,
  type FaceDamageAsset,
} from './faceDamageAssets';

const [IMAGE_W, IMAGE_H] = FACE_SOURCE_SIZE;

type Pt = { x: number; y: number };

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
      out[y * w + x] =
        v00 + (v10 - v00) * tx + (v01 - v00) * ty + (v11 - v10 - v01 + v00) * tx * ty;
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

  if (region.preferDarker) {
    return dLum < -16 && mag >= thr;
  }

  const localOk = mag >= localMed * 1.25 + thr * 0.55;
  if (!localOk && !(dLum < -22 || dRed > 18)) return false;
  if (mag < thr * 0.75) return false;

  if (region.preferRedder) {
    return dLum < -8 || dRed > 10 || mag > localMed * 1.8 + thr;
  }

  return Math.abs(dLum) > 16 || mag > localMed * 1.7 + thr;
}

/**
 * Affine map from 3 source landmarks → 3 destination landmarks.
 * Solves [x y 1] · M = [x' y'] for each point.
 */
function makeLandmarkAffine(
  src: [Pt, Pt, Pt],
  dst: [Pt, Pt, Pt]
): (x: number, y: number) => Pt {
  // Solve for columns of the 3×2 affine matrix via 3×3 linear system.
  const S = [
    [src[0].x, src[0].y, 1],
    [src[1].x, src[1].y, 1],
    [src[2].x, src[2].y, 1],
  ];
  const Dx = [dst[0].x, dst[1].x, dst[2].x];
  const Dy = [dst[0].y, dst[1].y, dst[2].y];

  const inv = invert3(S);
  if (!inv) {
    // Fallback: identity in normalized space.
    return (x, y) => ({ x, y });
  }
  const cx = matVec3(inv, Dx);
  const cy = matVec3(inv, Dy);
  return (x, y) => ({
    x: cx[0] * x + cx[1] * y + cx[2],
    y: cy[0] * x + cy[1] * y + cy[2],
  });
}

function invert3(m: number[][]): number[][] | null {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-8) return null;
  const id = 1 / det;
  return [
    [(e * i - f * h) * id, (c * h - b * i) * id, (b * f - c * e) * id],
    [(f * g - d * i) * id, (a * i - c * g) * id, (c * d - a * f) * id],
    [(d * h - e * g) * id, (b * g - a * h) * id, (a * e - b * d) * id],
  ];
}

function matVec3(m: number[][], v: number[]): [number, number, number] {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

function normLandmark(lm: readonly [number, number]): Pt {
  return { x: lm[0], y: lm[1] };
}

/**
 * Build male→target landmark warp.
 * Eyes + chin triangle places the upper face; below the male mouth we
 * additionally lerp toward the target mouth→chin segment so open-mouth
 * female lips/teeth aren't left too high.
 */
function maleToTargetWarp(): (nx: number, ny: number) => Pt {
  const male: [Pt, Pt, Pt] = [
    normLandmark(MALE_DAMAGE_LANDMARKS.leftEye),
    normLandmark(MALE_DAMAGE_LANDMARKS.rightEye),
    normLandmark(MALE_DAMAGE_LANDMARKS.chin),
  ];
  const target: [Pt, Pt, Pt] = [
    normLandmark(TARGET_DAMAGE_LANDMARKS.leftEye),
    normLandmark(TARGET_DAMAGE_LANDMARKS.rightEye),
    normLandmark(TARGET_DAMAGE_LANDMARKS.chin),
  ];
  const base = makeLandmarkAffine(male, target);
  const maleMouthY = MALE_DAMAGE_LANDMARKS.mouth[1];
  const maleChinY = MALE_DAMAGE_LANDMARKS.chin[1];
  const tgtMouthY = TARGET_DAMAGE_LANDMARKS.mouth[1];
  const tgtChinY = TARGET_DAMAGE_LANDMARKS.chin[1];
  const tgtMouthX = TARGET_DAMAGE_LANDMARKS.mouth[0];

  return (nx, ny) => {
    const p = base(nx, ny);
    if (ny <= maleMouthY) return p;
    const t = Math.min(1, Math.max(0, (ny - maleMouthY) / Math.max(1e-6, maleChinY - maleMouthY)));
    const lowerY = tgtMouthY + t * (tgtChinY - tgtMouthY);
    // Blend affine x with slight pull toward mouth center for lip/tooth.
    const lowerX = p.x * 0.85 + tgtMouthX * 0.15;
    return { x: lowerX, y: lowerY };
  };
}

/**
 * Apply one injury:
 *  1) Diff damaged vs male in *native* asset orientation (region coords as authored)
 *  2) Horizontally flip the injury field when mirroring L↔R
 *  3) Warp male UV → live-template UV via eye/mouth landmarks
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

  const maleNative = sampleStretched(maleBaseline, sw, sh);
  const damagedNative = sampleAlignedToGuide(damagedImage, maleNative, sw, sh, true);

  // Keep native orientation while building the injury field so region.cx matches the asset.
  const m0 = maleNative.data;
  const d0 = damagedNative.data;
  const region = asset.region;
  const n = sw * sh;

  const mag = new Float32Array(n);
  for (let i = 0, p = 0; p < n; p++, i += 4) {
    mag[p] =
      Math.abs(d0[i] - m0[i]) +
      Math.abs(d0[i + 1] - m0[i + 1]) +
      Math.abs(d0[i + 2] - m0[i + 2]);
  }
  const med = localMedianMag(mag, sw, sh);

  // Injury field in native space: RGB delta (+128 bias) + weight in A.
  let field = new ImageData(sw, sh);
  const fd = field.data;
  for (let py = 0; py < sh; py++) {
    for (let px = 0; px < sw; px++) {
      const p = py * sw + px;
      const i = p * 4;
      const nx = (px + 0.5) / sw;
      const ny = (py + 0.5) / sh;
      const weight = regionWeight(nx, ny, region);
      if (weight <= 0.02) continue;

      const mr = m0[i];
      const mg = m0[i + 1];
      const mb = m0[i + 2];
      const ma = m0[i + 3];
      const dr = d0[i];
      const dg = d0[i + 1];
      const db = d0[i + 2];
      const da = d0[i + 3];

      if (isBackdrop(dr, dg, db, da)) continue;
      const maleWasBackdrop = isBackdrop(mr, mg, mb, ma);
      if (!isInjuryDelta(mr, mg, mb, dr, dg, db, region, maleWasBackdrop, mag[p], med[p])) {
        continue;
      }

      fd[i] = clampByte(128 + (dr - mr));
      fd[i + 1] = clampByte(128 + (dg - mg));
      fd[i + 2] = clampByte(128 + (db - mb));
      // Weight in alpha; grow uses damagedNative sampled at same (flipped) UV later.
      fd[i + 3] = clampByte(255 * weight);
    }
  }

  if (mirror) {
    field = flipImageDataHorizontal(field);
  }

  const face = ctx.getImageData(Math.round(x), Math.round(y), sw, sh);
  const f = face.data;
  const warp = maleToTargetWarp();
  // Damaged colors for allowGrow (same mirror as field).
  let damagedForGrow = damagedNative;
  let maleForRatio = maleNative;
  if (mirror) {
    damagedForGrow = flipImageDataHorizontal(damagedNative);
    maleForRatio = flipImageDataHorizontal(maleNative);
  }
  const dgrow = damagedForGrow.data;
  const mratio = maleForRatio.data;
  const fieldData = field.data;

  for (let py = 0; py < sh; py++) {
    for (let px = 0; px < sw; px++) {
      const i = (py * sw + px) * 4;
      const a = fieldData[i + 3];
      if (a < 8) continue;
      const weight = a / 255;

      // Field pixels are in male UV (after optional mirror). Warp to live template UV.
      const mapped = warp((px + 0.5) / sw, (py + 0.5) / sh);
      const tx = Math.round(mapped.x * sw - 0.5);
      const ty = Math.round(mapped.y * sh - 0.5);
      if (tx < 0 || ty < 0 || tx >= sw || ty >= sh) continue;
      const ti = (ty * sw + tx) * 4;

      const dR = fieldData[i] - 128;
      const dG = fieldData[i + 1] - 128;
      const dB = fieldData[i + 2] - 128;

      const tr = f[ti];
      const tg = f[ti + 1];
      const tb = f[ti + 2];
      const ta = f[ti + 3];
      const targetIsBackdrop = isBackdrop(tr, tg, tb, ta);

      if (targetIsBackdrop) {
        if (!region.allowGrow) continue;
        f[ti] = clampByte(tr * (1 - weight) + dgrow[i] * weight);
        f[ti + 1] = clampByte(tg * (1 - weight) + dgrow[i + 1] * weight);
        f[ti + 2] = clampByte(tb * (1 - weight) + dgrow[i + 2] * weight);
        f[ti + 3] = clampByte(Math.max(ta, 255 * weight));
        continue;
      }

      if (region.preferDarker) {
        f[ti] = clampByte(tr + Math.min(0, dR) * weight);
        f[ti + 1] = clampByte(tg + Math.min(0, dG) * weight);
        f[ti + 2] = clampByte(tb + Math.min(0, dB) * weight);
        continue;
      }

      const mr = mratio[i];
      const mg = mratio[i + 1];
      const mb = mratio[i + 2];
      const dr = dgrow[i];
      const dg = dgrow[i + 1];
      const db = dgrow[i + 2];
      const eps = 10;
      const rr = Math.max(0.25, Math.min(2.0, dr / Math.max(mr, eps)));
      const rg = Math.max(0.25, Math.min(2.0, dg / Math.max(mg, eps)));
      const rb = Math.max(0.25, Math.min(2.0, db / Math.max(mb, eps)));
      const candR = tr * rr;
      const candG = tg * rg;
      const candB = tb * rb;
      const mixedR = candR * 0.65 + (tr + dR) * 0.35;
      const mixedG = candG * 0.65 + (tg + dG) * 0.35;
      const mixedB = candB * 0.65 + (tb + dB) * 0.35;

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
