/**
 * Bake cumulative damage-stage faces for the ring HUD onto the
 * uploaded-photo caricature (`test-template-face.png`).
 *
 * Injury appearance is taken as male-baseline deltas from the photo-ref
 * damage PNGs, then stamped onto the live caricature landmarks.
 *
 * Usage (from frontend/, with `canvas` installed):
 *   node scripts/bake-damage-stage-faces.mjs
 *
 * Writes public/faces/damage-stages/00-clean.png … 08-foreheadBandage.png
 */
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(__dirname, '../public/faces');

const live = await loadImage(`${BASE}/test-template-face.png`);
const male = await loadImage(`${BASE}/test-template-face-male.png`);

/** Male / damage-ref landmarks (image-left = subject's right). */
const MALE_LM = {
  leftEye: [0.35, 0.34],
  rightEye: [0.65, 0.34],
  nose: [0.5, 0.45],
  mouth: [0.5, 0.6],
  leftEar: [0.13, 0.42],
  rightEar: [0.87, 0.42],
  forehead: [0.5, 0.2],
  bottomLip: [0.5, 0.66],
};

/** Live photo-caricature landmarks (tuned to test-template-face.png). */
const LIVE_LM = {
  leftEye: [0.35, 0.36],
  rightEye: [0.65, 0.36],
  nose: [0.5, 0.48],
  mouth: [0.5, 0.64],
  /** Subject's right ear = image-left. */
  leftEar: [0.2, 0.52],
  /** Subject's left ear = image-right. */
  rightEar: [0.8, 0.52],
  forehead: [0.5, 0.26],
  bottomLip: [0.5, 0.72],
};

/**
 * Each step: extract injury from damage-ref vs male in `region`,
 * stamp onto live face at `anchor`.
 * `mirror`: flip ref so native-right injuries can land on subject-left.
 * Ear `patchScale` kept modest so cauliflower ears stay a bit smaller.
 */
const sequence = [
  {
    name: '01-cauliflowerLeftEar',
    // Cartoon ears: tint + slight swell on the live ear (no 3D blob stamp).
    cartoonEar: 'left',
  },
  {
    name: '02-blackRightEye',
    path: `${BASE}/damage/black-right-eye.png`,
    mirror: false,
    anchor: 'leftEye',
    patchScale: 1.1,
    keepFrac: 0.22,
    region: { cx: 0.35, cy: 0.34, rx: 0.14, ry: 0.13, preferRedder: true, diffThreshold: 22 },
  },
  {
    name: '03-swollenBottomLip',
    path: `${BASE}/damage/swollen-lip.png`,
    mirror: false,
    anchor: 'bottomLip',
    patchScale: 1.05,
    keepFrac: 0.35,
    region: {
      cx: 0.5,
      cy: 0.66,
      rx: 0.2,
      ry: 0.1,
      preferRedder: true,
      allowGrow: true,
      diffThreshold: 16,
    },
  },
  {
    name: '04-cauliflowerRightEar',
    cartoonEar: 'right',
  },
  {
    name: '05-missingTooth',
    path: `${BASE}/damage/missing-tooth.png`,
    mirror: false,
    anchor: 'mouth',
    patchScale: 1.35,
    strength: 2.2,
    keepFrac: 0.7,
    region: {
      cx: 0.55,
      cy: 0.58,
      rx: 0.09,
      ry: 0.06,
      preferDarker: true,
      diffThreshold: 14,
    },
  },
  {
    name: '06-swollenLeftEye',
    path: `${BASE}/damage/swollen-left-eye.png`,
    mirror: false,
    anchor: 'rightEye',
    patchScale: 1.15,
    keepFrac: 0.28,
    region: {
      cx: 0.65,
      cy: 0.34,
      rx: 0.15,
      ry: 0.14,
      preferRedder: true,
      diffThreshold: 20,
    },
  },
  {
    name: '07-brokenNose',
    path: `${BASE}/damage/broken-nose.png`,
    mirror: false,
    anchor: 'nose',
    patchScale: 1.05,
    keepFrac: 0.22,
    region: { cx: 0.5, cy: 0.45, rx: 0.12, ry: 0.14, preferRedder: true, diffThreshold: 28 },
  },
  {
    name: '08-foreheadBandage',
    path: `${BASE}/damage/forehead-bandage.png`,
    mirror: false,
    anchor: 'forehead',
    patchScale: 1.25,
    keepFrac: 0.7,
    absoluteBlend: 1,
    region: {
      cx: 0.5,
      cy: 0.2,
      rx: 0.44,
      ry: 0.15,
      preferLighter: true,
      allowGrow: true,
      diffThreshold: 12,
    },
  },
];

const W = 1024;
const H = 1024;

function isBackdrop(r, g, b, a) {
  if (a < 20) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 22) return true;
  if (min > 232) return true;
  if (min > 200 && max - min < 14) return true;
  return false;
}

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function redness(r, g, b) {
  return r - (g + b) * 0.5;
}

function drawImg(img, mirror = false) {
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  if (mirror) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, 0, 0, W, H);
  return ctx.getImageData(0, 0, W, H);
}

function sampleMaleOnBlack(img) {
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  return ctx.getImageData(0, 0, W, H);
}

function contentBBox(data, whiteBackdrop) {
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
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
  return x1 < x0 ? null : { x0, y0, x1, y1 };
}

function sampleBilinear(data, x, y) {
  const x0 = Math.max(0, Math.min(W - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(H - 1, Math.floor(y)));
  const x1 = Math.min(W - 1, x0 + 1);
  const y1 = Math.min(H - 1, y0 + 1);
  const tx = x - Math.floor(x);
  const ty = y - Math.floor(y);
  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const i00 = (y0 * W + x0) * 4;
    const i10 = (y0 * W + x1) * 4;
    const i01 = (y1 * W + x0) * 4;
    const i11 = (y1 * W + x1) * 4;
    const top = data[i00 + c] + (data[i10 + c] - data[i00 + c]) * tx;
    const bot = data[i01 + c] + (data[i11 + c] - data[i01 + c]) * tx;
    out[c] = top + (bot - top) * ty;
  }
  return out;
}

function alignToGuide(srcData, guideData, treatWhite) {
  const gb = contentBBox(guideData, false);
  const sb = contentBBox(srcData, treatWhite);
  const out = createCanvas(W, H).getContext('2d').createImageData(W, H);
  if (!gb || !sb) return srcData;
  const gw = gb.x1 - gb.x0 + 1;
  const gh = gb.y1 - gb.y0 + 1;
  const sw = sb.x1 - sb.x0 + 1;
  const sh = sb.y1 - sb.y0 + 1;
  for (let y = gb.y0; y <= gb.y1; y++) {
    for (let x = gb.x0; x <= gb.x1; x++) {
      const u = (x - gb.x0 + 0.5) / gw;
      const v = (y - gb.y0 + 0.5) / gh;
      const [r, g, b, a] = sampleBilinear(
        srcData.data,
        sb.x0 + u * sw - 0.5,
        sb.y0 + v * sh - 0.5
      );
      if (treatWhite && isBackdrop(r, g, b, a)) continue;
      const i = (y * W + x) * 4;
      out.data[i] = clamp(r);
      out.data[i + 1] = clamp(g);
      out.data[i + 2] = clamp(b);
      out.data[i + 3] = 255;
    }
  }
  return out;
}

function regionWeight(nx, ny, region) {
  const dx = (nx - region.cx) / region.rx;
  const dy = (ny - region.cy) / region.ry;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d >= 1) return 0;
  if (d < 0.5) return 1;
  return 1 - (d - 0.5) / 0.5;
}

function isInjuryDelta(mr, mg, mb, dr, dg, db, region, maleWasBackdrop) {
  const thr = region.diffThreshold ?? 24;
  const diff = Math.abs(dr - mr) + Math.abs(dg - mg) + Math.abs(db - mb);
  if (maleWasBackdrop) return Boolean(region.allowGrow) && diff > 12;
  if (diff < thr) return false;
  const dLum = lum(dr, dg, db) - lum(mr, mg, mb);
  const dRed = redness(dr, dg, db) - redness(mr, mg, mb);
  if (region.preferDarker) return dLum < -14;
  if (region.preferLighter) return dLum > 18 || diff > thr * 1.4;
  if (region.preferRedder) return dLum < -8 || dRed > 10 || diff > thr * 2;
  return Math.abs(dLum) > 16 || diff > thr * 1.6;
}

function extractPatch(maleData, damagedData, region, mirror, keepFrac) {
  const thr = region.diffThreshold ?? 24;
  const candidates = [];
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const nx = (px + 0.5) / W;
      const ny = (py + 0.5) / H;
      const weight = regionWeight(nx, ny, region);
      if (weight <= 0.08) continue;
      const i = (py * W + px) * 4;
      const mr = maleData.data[i];
      const mg = maleData.data[i + 1];
      const mb = maleData.data[i + 2];
      const ma = maleData.data[i + 3];
      const dr = damagedData.data[i];
      const dg = damagedData.data[i + 1];
      const db = damagedData.data[i + 2];
      const da = damagedData.data[i + 3];
      if (isBackdrop(dr, dg, db, da)) continue;
      const maleWasBackdrop = isBackdrop(mr, mg, mb, ma);
      if (!isInjuryDelta(mr, mg, mb, dr, dg, db, region, maleWasBackdrop)) continue;

      const diff = Math.abs(dr - mr) + Math.abs(dg - mg) + Math.abs(db - mb);
      const dLum = lum(dr, dg, db) - lum(mr, mg, mb);
      const dRed = redness(dr, dg, db) - redness(mr, mg, mb);
      let score = diff * weight;
      if (region.preferDarker) score = Math.max(0, -dLum) * 4 * weight;
      else if (region.preferLighter) score = Math.max(0, dLum) * 4 * weight + diff * 0.2 * weight;
      else if (region.preferRedder) {
        score = (Math.max(0, -dLum) * 2 + Math.max(0, dRed) * 3 + diff * 0.35) * weight;
      }
      if (maleWasBackdrop) score += 40;
      if (score < thr * 0.75) continue;

      candidates.push({
        x: nx,
        y: ny,
        score,
        dR: dr - mr,
        dG: dg - mg,
        dB: db - mb,
        r: dr,
        g: dg,
        b: db,
        w: weight,
        grow: maleWasBackdrop && Boolean(region.allowGrow),
      });
    }
  }

  if (!candidates.length) return [];
  candidates.sort((a, b) => b.score - a.score);
  const frac =
    keepFrac ??
    (region.preferDarker ? 0.55 : region.preferLighter ? 0.5 : region.allowGrow ? 0.32 : 0.14);
  const keep = Math.max(120, Math.min(candidates.length, Math.round(candidates.length * frac)));
  const raw = candidates.slice(0, keep);

  let sx = 0;
  let sy = 0;
  let swt = 0;
  for (const p of raw) {
    sx += p.x * p.score;
    sy += p.y * p.score;
    swt += p.score;
  }
  const cx = sx / swt;
  const cy = sy / swt;
  const falloff = region.allowGrow || region.preferLighter ? 0.34 : 0.22;

  return raw.map((p) => {
    let ox = p.x - cx;
    const oy = p.y - cy;
    if (mirror) ox = -ox;
    const dist = Math.hypot(ox, oy);
    return { ...p, ox, oy, w: p.w * Math.max(0.4, 1 - dist / falloff) };
  });
}

function interocular(lm) {
  return Math.hypot(lm.rightEye[0] - lm.leftEye[0], lm.rightEye[1] - lm.leftEye[1]);
}

/**
 * Trim the live caricature's ear a little smaller, then redden it as cauliflower.
 * `side` is anatomical ('left' = image-right).
 */
function applyCartoonCauliflower(faceData, side) {
  const anchor = side === 'left' ? LIVE_LM.rightEar : LIVE_LM.leftEar;
  const [ax, ay] = anchor;
  // Ear search oval (covers the cartoon ear).
  const outerRx = 0.1;
  const outerRy = 0.13;
  /** Keep only this fraction of the ear radius → slightly smaller ear. */
  const keepRadius = 0.78;
  const f = faceData.data;
  let painted = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const od = Math.hypot((nx - ax) / outerRx, (ny - ay) / outerRy);
      if (od > 1.08) continue;

      const i = (y * W + x) * 4;
      const r = f[i];
      const g = f[i + 1];
      const b = f[i + 2];
      const a = f[i + 3];
      if (a < 20 || isBackdrop(r, g, b, a)) continue;

      // Prefer ear pixels away from the cheek (outer half of head).
      const towardOutside = side === 'left' ? nx >= ax - 0.01 : nx <= ax + 0.01;
      if (!towardOutside && od > 0.55) continue;

      // Trim outer rim → smaller ear.
      if (od > keepRadius) {
        const fade = Math.min(1, (od - keepRadius) / (1.05 - keepRadius));
        if (fade > 0.55) {
          f[i] = 0;
          f[i + 1] = 0;
          f[i + 2] = 0;
          f[i + 3] = 0;
        } else {
          f[i + 3] = clamp(a * (1 - fade));
        }
        continue;
      }

      // Red cauliflower tint on the kept ear.
      const core = od < 0.45 ? 1 : Math.max(0, (keepRadius - od) / (keepRadius - 0.45));
      const t = 0.68 * core;
      const mottle = (((x * 13 + y * 7) % 17) / 17) * 0.2 * core;
      f[i] = clamp(r * (1 - t) + 215 * t + mottle * 30);
      f[i + 1] = clamp(g * (1 - t) + 108 * t - mottle * 26);
      f[i + 2] = clamp(b * (1 - t) + 100 * t - mottle * 22);
      painted++;
    }
  }
  return painted;
}

function stampPatch(faceData, patch, asset) {
  const region = asset.region;
  const [ax, ay] = LIVE_LM[asset.anchor];
  const baseScale = interocular(LIVE_LM) / Math.max(1e-6, interocular(MALE_LM));
  const scale = baseScale * (asset.patchScale ?? 1);
  const strength = asset.strength ?? 1;
  const absoluteBlend = asset.absoluteBlend ?? 0;
  const f = faceData.data;
  let painted = 0;

  for (const p of patch) {
    const tx = Math.round((ax + p.ox * scale) * W - 0.5);
    const ty = Math.round((ay + p.oy * scale) * H - 0.5);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
    const ti = (ty * W + tx) * 4;
    const tr = f[ti];
    const tg = f[ti + 1];
    const tb = f[ti + 2];
    const ta = f[ti + 3];
    const solidBandage = Boolean(region.preferLighter) && absoluteBlend >= 0.95;
    const weight = solidBandage
      ? Math.min(1, Math.max(0.9, p.w))
      : Math.min(1, p.w * (region.preferDarker ? 1.15 : 1));
    const targetClear = ta < 20 || isBackdrop(tr, tg, tb, ta);

    if (targetClear) {
      if (!region.allowGrow && !p.grow) continue;
      f[ti] = clamp(p.r);
      f[ti + 1] = clamp(p.g);
      f[ti + 2] = clamp(p.b);
      f[ti + 3] = solidBandage ? 255 : clamp(255 * Math.max(0.8, weight));
      painted++;
      continue;
    }

    if (region.preferDarker) {
      const useR = Math.min(0, p.dR) * strength;
      const useG = Math.min(0, p.dG) * strength;
      const useB = Math.min(0, p.dB) * strength;
      let outR = tr + useR * weight;
      let outG = tg + useG * weight;
      let outB = tb + useB * weight;
      outR = outR * (1 - 0.45 * weight) + Math.min(outR, p.r) * (0.45 * weight);
      outG = outG * (1 - 0.45 * weight) + Math.min(outG, p.g) * (0.45 * weight);
      outB = outB * (1 - 0.45 * weight) + Math.min(outB, p.b) * (0.45 * weight);
      f[ti] = clamp(outR);
      f[ti + 1] = clamp(outG);
      f[ti + 2] = clamp(outB);
      painted++;
      continue;
    }

    if (absoluteBlend > 0.05) {
      const ab = Math.min(1, absoluteBlend);
      f[ti] = clamp(tr * (1 - weight * ab) + p.r * (weight * ab));
      f[ti + 1] = clamp(tg * (1 - weight * ab) + p.g * (weight * ab));
      f[ti + 2] = clamp(tb * (1 - weight * ab) + p.b * (weight * ab));
      if (solidBandage && ta < 250) f[ti + 3] = 255;
      painted++;
      continue;
    }

    const eps = 12;
    const mr = Math.max(eps, p.r - p.dR);
    const mg = Math.max(eps, p.g - p.dG);
    const mb = Math.max(eps, p.b - p.dB);
    const rr = Math.max(0.3, Math.min(1.9, p.r / mr));
    const rg = Math.max(0.3, Math.min(1.9, p.g / mg));
    const rb = Math.max(0.3, Math.min(1.9, p.b / mb));
    const mixedR = tr * rr * 0.7 + (tr + p.dR * strength) * 0.3;
    const mixedG = tg * rg * 0.7 + (tg + p.dG * strength) * 0.3;
    const mixedB = tb * rb * 0.7 + (tb + p.dB * strength) * 0.3;
    f[ti] = clamp(tr * (1 - weight) + mixedR * weight);
    f[ti + 1] = clamp(tg * (1 - weight) + mixedG * weight);
    f[ti + 2] = clamp(tb * (1 - weight) + mixedB * weight);
    painted++;
  }
  return painted;
}

const outDir = path.join(BASE, 'damage-stages');
fs.mkdirSync(outDir, { recursive: true });

const maleOnBlack = sampleMaleOnBlack(male);
const liveData = drawImg(live, false);
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.putImageData(liveData, 0, 0);
fs.writeFileSync(path.join(outDir, '00-clean.png'), canvas.toBuffer('image/png'));

for (const step of sequence) {
  const cur = ctx.getImageData(0, 0, W, H);
  let painted = 0;
  if (step.cartoonEar) {
    painted = applyCartoonCauliflower(cur, step.cartoonEar);
    console.log(step.name, 'cartoonEar', step.cartoonEar, 'painted', painted);
  } else {
    const dmgImg = await loadImage(step.path);
    const dmgRaw = drawImg(dmgImg, false);
    const aligned = alignToGuide(dmgRaw, maleOnBlack, true);
    const patch = extractPatch(
      maleOnBlack,
      aligned,
      step.region,
      Boolean(step.mirror),
      step.keepFrac
    );
    painted = stampPatch(cur, patch, step);
    console.log(step.name, 'patch', patch.length, 'painted', painted);
  }
  ctx.putImageData(cur, 0, 0);
  fs.writeFileSync(path.join(outDir, `${step.name}.png`), canvas.toBuffer('image/png'));
}

console.log('Wrote', outDir);
