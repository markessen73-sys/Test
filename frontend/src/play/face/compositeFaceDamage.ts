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
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Male baseline on black — stable for RGB differencing against white-bg damage PNGs. */
function sampleMaleOnBlack(image: HTMLImageElement, w: number, h: number): ImageData {
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
  if (d < 0.5) return 1;
  return 1 - (d - 0.5) / 0.5;
}

function isInjuryDelta(
  mr: number,
  mg: number,
  mb: number,
  dr: number,
  dg: number,
  db: number,
  region: DamageRegion,
  maleWasBackdrop: boolean
): boolean {
  const thr = region.diffThreshold ?? 24;
  const diff = Math.abs(dr - mr) + Math.abs(dg - mg) + Math.abs(db - mb);
  if (maleWasBackdrop) return Boolean(region.allowGrow) && diff > 12;
  if (diff < thr) return false;
  const dLum = luminance(dr, dg, db) - luminance(mr, mg, mb);
  const dRed = redness(dr, dg, db) - redness(mr, mg, mb);
  if (region.preferDarker) return dLum < -14;
  if (region.preferLighter) return dLum > 18 || diff > thr * 1.4;
  if (region.preferRedder) return dLum < -8 || dRed > 10 || diff > thr * 2;
  return Math.abs(dLum) > 16 || diff > thr * 1.6;
}

type PatchPixel = {
  /** Offset from male injury centroid, in normalized image units. */
  ox: number;
  oy: number;
  dR: number;
  dG: number;
  dB: number;
  /** Absolute damaged RGB for grow / bandage cloth. */
  r: number;
  g: number;
  b: number;
  w: number;
  grow: boolean;
};

/**
 * Build a compact injury patch in native asset space, then optionally mirror.
 * Only the strongest local changes are kept so we stamp a coherent wound/bruise,
 * not a semi-transparent male face slab.
 */
function extractPatch(
  male: ImageData,
  damaged: ImageData,
  region: DamageRegion,
  mirror: boolean,
  sw: number,
  sh: number,
  keepFracOverride?: number
): PatchPixel[] {
  const m = male.data;
  const d = damaged.data;
  const thr = region.diffThreshold ?? 24;
  const candidates: {
    x: number;
    y: number;
    score: number;
    pix: Omit<PatchPixel, 'ox' | 'oy'>;
  }[] = [];

  for (let py = 0; py < sh; py++) {
    for (let px = 0; px < sw; px++) {
      const nx = (px + 0.5) / sw;
      const ny = (py + 0.5) / sh;
      const weight = regionWeight(nx, ny, region);
      if (weight <= 0.08) continue;

      const i = (py * sw + px) * 4;
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
      if (!isInjuryDelta(mr, mg, mb, dr, dg, db, region, maleWasBackdrop)) continue;

      const diff = Math.abs(dr - mr) + Math.abs(dg - mg) + Math.abs(db - mb);
      const dLum = luminance(dr, dg, db) - luminance(mr, mg, mb);
      const dRed = redness(dr, dg, db) - redness(mr, mg, mb);
      let score = diff * weight;
      if (region.preferDarker) score = Math.max(0, -dLum) * 4 * weight;
      else if (region.preferLighter) score = Math.max(0, dLum) * 4 * weight + diff * 0.2 * weight;
      else if (region.preferRedder) score = (Math.max(0, -dLum) * 2 + Math.max(0, dRed) * 3 + diff * 0.35) * weight;
      else score = (Math.abs(dLum) * 2 + diff * 0.4) * weight;
      if (maleWasBackdrop) score += 40;

      if (score < thr * 0.75) continue;

      candidates.push({
        x: nx,
        y: ny,
        score,
        pix: {
          dR: dr - mr,
          dG: dg - mg,
          dB: db - mb,
          r: dr,
          g: dg,
          b: db,
          w: weight,
          grow: maleWasBackdrop && Boolean(region.allowGrow),
        },
      });
    }
  }

  if (candidates.length === 0) return [];

  candidates.sort((a, b) => b.score - a.score);
  const keepFrac =
    keepFracOverride ??
    (region.preferDarker ? 0.55 : region.preferLighter ? 0.5 : region.allowGrow ? 0.32 : 0.14);
  const keep = Math.max(
    120,
    Math.min(candidates.length, Math.round(candidates.length * keepFrac))
  );
  const raw = candidates.slice(0, keep);

  let sx = 0;
  let sy = 0;
  let swt = 0;
  for (const p of raw) {
    const wt = p.score;
    sx += p.x * wt;
    sy += p.y * wt;
    swt += wt;
  }
  const cx = sx / swt;
  const cy = sy / swt;

  // Larger falloff radius for big stamps (ears / bandage).
  const falloff = region.allowGrow || region.preferLighter ? 0.34 : 0.22;

  return raw.map((p) => {
    let ox = p.x - cx;
    const oy = p.y - cy;
    if (mirror) ox = -ox;
    const dist = Math.hypot(ox, oy);
    const core = Math.max(0.4, 1 - dist / falloff);
    return { ox, oy, ...p.pix, w: p.pix.w * core };
  });
}

function interocular(lm: typeof MALE_DAMAGE_LANDMARKS): number {
  return Math.hypot(lm.rightEye[0] - lm.leftEye[0], lm.rightEye[1] - lm.leftEye[1]);
}

/**
 * Stamp one injury patch onto the live face, centered on the target anchor landmark.
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

  const male = sampleMaleOnBlack(maleBaseline, sw, sh);
  const damaged = sampleAlignedToGuide(damagedImage, male, sw, sh, true);
  const patch = extractPatch(male, damaged, asset.region, mirror, sw, sh, asset.keepFrac);
  if (patch.length === 0) return;

  const face = ctx.getImageData(Math.round(x), Math.round(y), sw, sh);
  const f = face.data;
  const region = asset.region;

  const targetAnchor = TARGET_DAMAGE_LANDMARKS[asset.anchor];
  const baseScale =
    interocular(TARGET_DAMAGE_LANDMARKS) / Math.max(1e-6, interocular(MALE_DAMAGE_LANDMARKS));
  const scale = baseScale * (asset.patchScale ?? 1);
  const strength = asset.strength ?? 1;
  const absoluteBlend = asset.absoluteBlend ?? 0;

  const ax = targetAnchor[0];
  const ay = targetAnchor[1];

  for (const p of patch) {
    const tx = Math.round((ax + p.ox * scale) * sw - 0.5);
    const ty = Math.round((ay + p.oy * scale) * sh - 0.5);
    if (tx < 0 || ty < 0 || tx >= sw || ty >= sh) continue;
    const ti = (ty * sw + tx) * 4;

    const tr = f[ti];
    const tg = f[ti + 1];
    const tb = f[ti + 2];
    const ta = f[ti + 3];
    const weight = Math.min(1, p.w * (region.preferDarker ? 1.15 : 1));
    const targetClear = ta < 20 || isBackdrop(tr, tg, tb, ta);

    if (targetClear) {
      if (!region.allowGrow && !p.grow) continue;
      f[ti] = clampByte(p.r);
      f[ti + 1] = clampByte(p.g);
      f[ti + 2] = clampByte(p.b);
      f[ti + 3] = clampByte(255 * Math.max(0.8, weight));
      continue;
    }

    if (region.preferDarker) {
      // Punch a clear dark gap — amplify and bias toward near-black.
      const useR = Math.min(0, p.dR) * strength;
      const useG = Math.min(0, p.dG) * strength;
      const useB = Math.min(0, p.dB) * strength;
      let outR = tr + useR * weight;
      let outG = tg + useG * weight;
      let outB = tb + useB * weight;
      // Extra darken toward the damaged gap color for readability on bright teeth.
      outR = outR * (1 - 0.45 * weight) + Math.min(outR, p.r) * (0.45 * weight);
      outG = outG * (1 - 0.45 * weight) + Math.min(outG, p.g) * (0.45 * weight);
      outB = outB * (1 - 0.45 * weight) + Math.min(outB, p.b) * (0.45 * weight);
      f[ti] = clampByte(outR);
      f[ti + 1] = clampByte(outG);
      f[ti + 2] = clampByte(outB);
      continue;
    }

    if (absoluteBlend > 0.05) {
      // Bandage / cauliflower: show the damaged look directly on the target.
      const mixedR = tr * (1 - absoluteBlend) + p.r * absoluteBlend;
      const mixedG = tg * (1 - absoluteBlend) + p.g * absoluteBlend;
      const mixedB = tb * (1 - absoluteBlend) + p.b * absoluteBlend;
      f[ti] = clampByte(tr * (1 - weight) + mixedR * weight);
      f[ti + 1] = clampByte(tg * (1 - weight) + mixedG * weight);
      f[ti + 2] = clampByte(tb * (1 - weight) + mixedB * weight);
      continue;
    }

    const eps = 12;
    const mr = Math.max(eps, p.r - p.dR);
    const mg = Math.max(eps, p.g - p.dG);
    const mb = Math.max(eps, p.b - p.dB);
    const rr = Math.max(0.3, Math.min(1.9, p.r / mr));
    const rg = Math.max(0.3, Math.min(1.9, p.g / mg));
    const rb = Math.max(0.3, Math.min(1.9, p.b / mb));
    const candR = tr * rr;
    const candG = tg * rg;
    const candB = tb * rb;
    const addR = tr + p.dR * strength;
    const addG = tg + p.dG * strength;
    const addB = tb + p.dB * strength;
    const mixedR = candR * 0.7 + addR * 0.3;
    const mixedG = candG * 0.7 + addG * 0.3;
    const mixedB = candB * 0.7 + addB * 0.3;

    f[ti] = clampByte(tr * (1 - weight) + mixedR * weight);
    f[ti + 1] = clampByte(tg * (1 - weight) + mixedG * weight);
    f[ti + 2] = clampByte(tb * (1 - weight) + mixedB * weight);
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
