/**
 * Graft Greenie-style columnar necks onto chin-cut packs.
 *
 * Matches The Greenie's authored neck structure:
 *   - Wide flesh column under the jaw (~50% of mid-face width)
 *   - Holds width for most of its height, then rounds to a U tip
 *   - Side/outline darkening + Greenie's characteristic shoulder lighting
 *   - Jaw crease where it meets the chin
 *
 * Painted under each chin contour (no chin strip, no floating sticker).
 *
 *   node scripts/graft-greenie-necks.mjs --force
 */
import { createCanvas, loadImage, ImageData } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAR_ROOT = path.resolve(__dirname, '../public/faces/characters');
const W = 1024;
const H = 1024;
const ALPHA = 40;
const TEMPLATE_ID = 'the-greenie';

function parseIds() {
  const arg = process.argv.find((a) => a.startsWith('--ids='));
  if (!arg) return null;
  return arg
    .slice('--ids='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function opaqueBBox(data) {
  let x0 = W,
    y0 = H,
    x1 = 0,
    y1 = 0,
    n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] < ALPHA) continue;
      n++;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return n ? { x0, y0, x1, y1 } : null;
}

function spanAt(data, y) {
  y = Math.max(0, Math.min(H - 1, Math.floor(y)));
  let L = null,
    R = null;
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > ALPHA) {
      if (L === null) L = x;
      R = x;
    }
  }
  return L === null ? null : { L, R, mid: (L + R) / 2, w: R - L + 1 };
}

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isSkinish(r, g, b) {
  const L = lum(r, g, b);
  if (L < 20 || L > 252) return false;
  if (b > r + 40 && b > g + 30) return false;
  return r > 35 && g > 18 && b > 6;
}

function chinContourY(data, bb) {
  const raw = new Int32Array(W).fill(-1);
  const yStart = bb.y0 + Math.floor((bb.y1 - bb.y0) * 0.5);
  for (let x = bb.x0; x <= bb.x1; x++) {
    let last = -1;
    for (let y = yStart; y <= bb.y1; y++) {
      if (data[(y * W + x) * 4 + 3] > ALPHA) last = y;
    }
    raw[x] = last;
  }
  // Median-smooth contour to kill beard stair-steps (Byson)
  const ys = new Int32Array(W).fill(-1);
  const rad = 3;
  for (let x = bb.x0; x <= bb.x1; x++) {
    if (raw[x] < 0) continue;
    const vals = [];
    for (let dx = -rad; dx <= rad; dx++) {
      const xx = x + dx;
      if (xx < 0 || xx >= W || raw[xx] < 0) continue;
      vals.push(raw[xx]);
    }
    vals.sort((a, b) => a - b);
    ys[x] = vals[Math.floor(vals.length / 2)];
  }
  return ys;
}

/** Soften hard black chin outlines into a Greenie-like warm jaw crease. */
function softenChinOutline(data, contour, cx, halfTop, skin) {
  for (let x = Math.floor(cx - halfTop - 6); x <= Math.ceil(cx + halfTop + 6); x++) {
    if (x < 1 || x >= W - 1) continue;
    const chinY = contour[x];
    if (chinY < 0) continue;
    for (let dy = 0; dy <= 4; dy++) {
      const y = chinY - dy;
      if (y < 0) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA) continue;
      const L = lum(data[i], data[i + 1], data[i + 2]);
      // Rewrite near-black / hard edge strokes into warm crease
      if (L > 70) continue;
      const t = 0.45 + dy * 0.1;
      data[i] = Math.round(skin[0] * t * 0.7);
      data[i + 1] = Math.round(skin[1] * t * 0.55);
      data[i + 2] = Math.round(skin[2] * t * 0.4);
      data[i + 3] = 255;
    }
  }
}

function sampleJawSkin(data, bb) {
  const midY = bb.y0 + Math.round((bb.y1 - bb.y0) * 0.42);
  const botY = bb.y0 + Math.round((bb.y1 - bb.y0) * 0.72);
  const samples = [];
  for (let y = midY; y <= botY; y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 180) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (!isSkinish(r, g, b)) continue;
      const L = lum(r, g, b);
      if (L < 55 || L > 235) continue;
      if (r > g + 45 && r > b + 40 && L < 140) continue; // lips
      // Require warm chromatic skin (rejects grey stubble / pale highlight)
      if (r - b < 18) continue;
      if (r < g - 5) continue;
      samples.push([r, g, b, L]);
    }
  }
  if (!samples.length) return [200, 150, 110];
  // Prefer mid-tone warm flesh (reject deep shadow and specular)
  const midTone = samples.filter((s) => s[3] >= 90 && s[3] <= 185);
  const pool = midTone.length >= 30 ? midTone : samples;
  let sr = 0,
    sg = 0,
    sb = 0;
  for (const s of pool) {
    sr += s[0];
    sg += s[1];
    sb += s[2];
  }
  return [Math.round(sr / pool.length), Math.round(sg / pool.length), Math.round(sb / pool.length)];
}

/**
 * Build Greenie neck model: width profile (column→U) + smooth radial shade.
 * Shade from mid-neck row, lightly smoothed so paint has no vertical streaks.
 */
async function buildGreenieTemplate() {
  const img = await loadImage(path.join(CHAR_ROOT, TEMPLATE_ID, 'clean.png'));
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H).data;
  const bb = opaqueBBox(data);
  const faceH = bb.y1 - bb.y0 + 1;
  const mid = spanAt(data, bb.y0 + faceH * 0.55);

  // Column body starts at Greenie's jaw→neck hinge (~780), tip at 877
  const y0 = 780;
  const y1 = bb.y1;
  const topSpan = spanAt(data, y0);
  const profile = [];
  for (let y = y0; y <= y1; y++) {
    const s = spanAt(data, y);
    profile.push({
      ny: (y - y0) / (y1 - y0),
      halfFrac: s ? s.w / topSpan.w : 0.05,
    });
  }

  // Smooth shade LUT from y=845 (authored flesh cross-section)
  const shadeY = 845;
  const ss = spanAt(data, shadeY);
  const raw = [];
  for (let k = 0; k < 33; k++) {
    const nx = (k / 32) * 2 - 1;
    const x = Math.round(ss.mid + nx * (ss.w / 2) * 0.96);
    const i = (shadeY * W + x) * 4;
    raw.push(lum(data[i], data[i + 1], data[i + 2]));
  }
  // 3-tap smooth
  const smooth = raw.map((v, i) => {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[i];
    const c = raw[Math.min(raw.length - 1, i + 1)];
    return (a + b * 2 + c) / 4;
  });
  const centerL = smooth[16];
  const shadeLut = smooth.map((v) => v / Math.max(1, centerL));

  // QA: paint a reference neck swatch
  const swW = 220,
    swH = 160;
  const sw = createCanvas(swW, swH);
  const swx = sw.getContext('2d');
  const swData = swx.createImageData(swW, swH);
  const skinDemo = [200, 140, 95];
  for (let y = 0; y < swH; y++) {
    const ny = y / (swH - 1);
    const halfFrac = profileHalf(profile, ny);
    const half = (swW * 0.48) * halfFrac;
    const cx = swW / 2;
    for (let x = 0; x < swW; x++) {
      const nx = (x - cx) / Math.max(1, half);
      if (Math.abs(nx) > 1) continue;
      const shade = sampleLut(shadeLut, nx) * (1 - ny * 0.1);
      const crease = y < 5 ? 0.55 + y * 0.08 : 1;
      const edge = 1 - Math.abs(nx);
      const i = (y * swW + x) * 4;
      if (edge < 0.07 || ny > 0.94) {
        swData.data[i] = 30;
        swData.data[i + 1] = 18;
        swData.data[i + 2] = 10;
      } else {
        const s = Math.max(0.4, Math.min(1.15, shade * crease));
        swData.data[i] = Math.round(skinDemo[0] * s);
        swData.data[i + 1] = Math.round(skinDemo[1] * s);
        swData.data[i + 2] = Math.round(skinDemo[2] * s);
      }
      swData.data[i + 3] = 255;
    }
  }
  swx.putImageData(swData, 0, 0);
  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
  fs.writeFileSync('/opt/cursor/artifacts/qa-greenie-flesh-only.png', sw.toBuffer('image/png'));

  console.log(
    'Greenie model: topW',
    topSpan.w,
    'top/mid',
    (topSpan.w / mid.w).toFixed(3),
    'rows',
    profile.length,
    'centerL',
    centerL.toFixed(1)
  );

  return {
    profile,
    shadeLut,
    topRatio: topSpan.w / mid.w,
    centerL,
  };
}

function profileHalf(profile, ny) {
  const t = Math.max(0, Math.min(1, ny)) * (profile.length - 1);
  const i0 = Math.floor(t);
  const i1 = Math.min(profile.length - 1, i0 + 1);
  const f = t - i0;
  return profile[i0].halfFrac * (1 - f) + profile[i1].halfFrac * f;
}

function sampleLut(lut, nx) {
  const t = ((Math.max(-1, Math.min(1, nx)) + 1) / 2) * (lut.length - 1);
  const i0 = Math.floor(t);
  const i1 = Math.min(lut.length - 1, i0 + 1);
  const f = t - i0;
  return lut[i0] * (1 - f) + lut[i1] * f;
}

function shiftUp(data, dy) {
  if (dy <= 0) return;
  const copy = new Uint8ClampedArray(data);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const di = (y * W + x) * 4;
      const sy = y + dy;
      if (sy < H) {
        const si = (sy * W + x) * 4;
        data[di] = copy[si];
        data[di + 1] = copy[si + 1];
        data[di + 2] = copy[si + 2];
        data[di + 3] = copy[si + 3];
      } else {
        data[di] = data[di + 1] = data[di + 2] = data[di + 3] = 0;
      }
    }
  }
}

function scrubGreenFringe(data, bb) {
  // Replace chroma-key green / yellow fringe with neighboring skin (don't punch holes)
  for (let y = Math.max(0, bb.y1 - 18); y <= bb.y1; y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const isGreen = g > 120 && g > r + 20 && g > b + 20;
      const isYellowGreen = g > 140 && r > 110 && b < 110 && g >= r - 15;
      if (!isGreen && !isYellowGreen) continue;
      let sr = 0,
        sg = 0,
        sb = 0,
        n = 0;
      for (let dy = -3; dy <= 0; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const j = ((y + dy) * W + (x + dx)) * 4;
          if (j < 0 || y + dy < 0) continue;
          if (data[j + 3] < 180) continue;
          const rr = data[j],
            gg = data[j + 1],
            bbv = data[j + 2];
          if (gg > rr + 20 && gg > bbv + 20) continue;
          if (rr - bbv < 15) continue;
          sr += rr;
          sg += gg;
          sb += bbv;
          n++;
        }
      }
      if (n) {
        data[i] = Math.round(sr / n);
        data[i + 1] = Math.round(sg / n);
        data[i + 2] = Math.round(sb / n);
        data[i + 3] = 255;
      } else {
        data[i + 3] = 0;
      }
    }
  }
}

function appendNeck(data, template, skin) {
  const bb = opaqueBBox(data);
  if (!bb) return { ok: false, reason: 'empty' };
  scrubGreenFringe(data, bb);

  const faceH = bb.y1 - bb.y0 + 1;
  const mid = spanAt(data, bb.y0 + faceH * 0.55);
  if (!mid) return { ok: false, reason: 'no-mid' };

  // Match Greenie: neck top ≈ 50% of mid-face
  const topW = Math.max(48, Math.round(mid.w * template.topRatio * 0.98));
  // Tall enough to read as a column (Greenie neck ~13% of face after jaw)
  const neckH = Math.min(H - bb.y1 - 4, Math.max(72, Math.round(faceH * 0.155)));
  if (neckH < 56) return { ok: false, reason: 'no-room' };

  const contour = chinContourY(data, bb);
  const cx = mid.mid;
  const halfTop = topW / 2;

  // Soften black chin outline so the neck doesn't look like a sticker under a cutout
  softenChinOutline(data, contour, cx, halfTop, skin);

  let painted = 0;

  for (let dy = 0; dy <= neckH; dy++) {
    const ny = dy / neckH;
    // Use Greenie width profile (column then U tip)
    const halfFrac = profileHalf(template.profile, ny);
    const half = halfTop * halfFrac;
    if (half < 2) continue;

    for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
      if (x < 1 || x >= W - 1) continue;
      const nx = (x - cx) / Math.max(1, half);
      if (Math.abs(nx) > 1.0) continue;

      const chinY = contour[x] >= 0 ? contour[x] : bb.y1;
      const y = chinY + 1 + dy;
      if (y >= H) continue;

      const i = (y * W + x) * 4;

      // Allow slight overlap into softened chin edge (kill sticker seam)
      if (dy <= 2) {
        if (data[i + 3] > 140 && lum(data[i], data[i + 1], data[i + 2]) > 70) continue;
      } else if (data[i + 3] > 28) {
        continue;
      }

      const edge = 1 - Math.abs(nx);
      let shade = sampleLut(template.shadeLut, nx);
      // Neck sits in shadow under the jaw — slightly darker than cheek sample
      shade *= 0.88;
      shade *= 1 - ny * 0.08;
      // Stronger cylindrical side falloff (Greenie volume)
      if (edge < 0.35) shade *= 0.55 + edge * 1.3;
      // Soft orange-brown jaw crease (not a black sticker line)
      if (dy < Math.max(4, Math.round(neckH * 0.07))) {
        const t = dy / Math.max(1, Math.round(neckH * 0.07));
        shade *= 0.42 + 0.58 * t;
      }

      if (edge < 0.07 || ny > 0.94) {
        // Soft outline — warm dark, not pure black
        data[i] = Math.max(18, Math.round(skin[0] * 0.28));
        data[i + 1] = Math.max(10, Math.round(skin[1] * 0.22));
        data[i + 2] = Math.max(6, Math.round(skin[2] * 0.16));
        data[i + 3] = 255;
      } else {
        const s = Math.max(0.4, Math.min(1.05, shade));
        data[i] = Math.max(0, Math.min(255, Math.round(skin[0] * s)));
        data[i + 1] = Math.max(0, Math.min(255, Math.round(skin[1] * s)));
        data[i + 2] = Math.max(0, Math.min(255, Math.round(skin[2] * s)));
        data[i + 3] = 255;
      }
      painted++;
    }
  }

  // Bridge black gaps along the chin underside (incl. beard corners)
  for (let pass = 0; pass < 3; pass++) {
    for (let x = Math.floor(cx - halfTop - 4); x <= Math.ceil(cx + halfTop + 4); x++) {
      if (x < 1 || x >= W - 1) continue;
      const chinY = contour[x];
      if (chinY < 0) continue;
      for (let dy = 1; dy <= 4; dy++) {
        const y = chinY + dy;
        if (y >= H) continue;
        const i = (y * W + x) * 4;
        if (data[i + 3] > 28) continue;
        // Fill if any neighbor is opaque neck/face
        let sr = 0,
          sg = 0,
          sb = 0,
          n = 0;
        for (const [dx, ddy] of [
          [0, 1],
          [0, -1],
          [-1, 0],
          [1, 0],
          [-1, 1],
          [1, 1],
        ]) {
          const nx_ = x + dx,
            ny_ = y + ddy;
          if (nx_ < 0 || ny_ < 0 || nx_ >= W || ny_ >= H) continue;
          const j = (ny_ * W + nx_) * 4;
          if (data[j + 3] < 180) continue;
          sr += data[j];
          sg += data[j + 1];
          sb += data[j + 2];
          n++;
        }
        if (n < 2) continue;
        const crease = dy <= 2 ? 0.72 : 0.9;
        data[i] = Math.round((sr / n) * crease);
        data[i + 1] = Math.round((sg / n) * crease);
        data[i + 2] = Math.round((sb / n) * crease);
        data[i + 3] = 255;
      }
    }
  }

  if (painted < 500) return { ok: false, reason: 'too-few', painted };
  return { ok: true, neckH, topW, painted, skin };
}

function listPngs(root) {
  const out = [];
  for (const name of ['clean.png', 'ooh.png', 'knockout.png']) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) out.push(p);
  }
  for (const dir of ['damage-stages', 'bobo-clown-stages']) {
    const d = path.join(root, dir);
    if (!fs.existsSync(d)) continue;
    for (const n of fs.readdirSync(d)) {
      if (n.endsWith('.png')) out.push(path.join(d, n));
    }
  }
  return out;
}

function ensureRoom(data) {
  const bb = opaqueBBox(data);
  if (!bb) return null;
  const need = Math.round((bb.y1 - bb.y0) * 0.18) + 20;
  const room = H - 1 - bb.y1;
  if (room >= need) return bb;
  const dy = Math.min(need - room, Math.max(0, bb.y0 - 6));
  if (dy > 0) shiftUp(data, dy);
  return opaqueBBox(data);
}

async function processPack(id, template) {
  if (id === TEMPLATE_ID) {
    console.log(id, 'skip — authored neck kept');
    return;
  }
  if (id === 'male-boxer' || id === 'female-boxer') return;
  const root = path.join(CHAR_ROOT, id);
  if (!fs.existsSync(path.join(root, 'clean.png'))) return;

  const probeImg = await loadImage(path.join(root, 'clean.png'));
  const probeCtx = createCanvas(W, H).getContext('2d');
  probeCtx.drawImage(probeImg, 0, 0);
  const probe = probeCtx.getImageData(0, 0, W, H);
  const bb0 = ensureRoom(probe.data);
  const skin = sampleJawSkin(probe.data, bb0);
  const trial = appendNeck(new Uint8ClampedArray(probe.data), template, skin);
  if (!trial.ok) {
    console.log(id, 'skip —', trial.reason);
    return;
  }

  for (const file of listPngs(root)) {
    const img = await loadImage(file);
    const ctx = createCanvas(W, H).getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0);
    const idata = ctx.getImageData(0, 0, W, H);
    const box = ensureRoom(idata.data) || bb0;
    appendNeck(idata.data, template, sampleJawSkin(idata.data, box));
    ctx.putImageData(idata, 0, 0);
    fs.writeFileSync(file, ctx.canvas.toBuffer('image/png'));
  }
  console.log(id, 'neckH', trial.neckH, 'topW', trial.topW, 'skin', skin);
}

async function enlargeBozza() {
  const root = path.join(CHAR_ROOT, 'bozza');
  const def = await loadImage(path.join(CHAR_ROOT, 'default', 'clean.png'));
  const dctx = createCanvas(W, H).getContext('2d');
  dctx.drawImage(def, 0, 0);
  const dData = dctx.getImageData(0, 0, W, H).data;
  const dBb = opaqueBBox(dData);
  const dMid = spanAt(dData, dBb.y0 + (dBb.y1 - dBb.y0) * 0.55);

  for (const file of listPngs(root)) {
    const img = await loadImage(file);
    const ctx = createCanvas(W, H).getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, W, H).data;
    const bb = opaqueBBox(data);
    if (!bb) continue;
    const mid = spanAt(data, bb.y0 + (bb.y1 - bb.y0) * 0.55);
    if (!mid || !dMid) continue;
    const scale = Math.min(1.28, (dMid.w * 0.97) / mid.w);
    if (scale < 1.02) continue;
    const src = createCanvas(W, H);
    src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), W, H), 0, 0);
    const out = createCanvas(W, H);
    const octx = out.getContext('2d');
    octx.clearRect(0, 0, W, H);
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    const cx = mid.mid;
    const cy = bb.y0 + (bb.y1 - bb.y0) * 0.38;
    octx.translate(cx, cy - 24);
    octx.scale(scale, scale);
    octx.translate(-cx, -cy);
    octx.drawImage(src, 0, 0);
    fs.writeFileSync(file, out.toBuffer('image/png'));
  }
  console.log('bozza enlarged');
}

const skipEnlarge = process.argv.includes('--no-enlarge');
const template = await buildGreenieTemplate();
const only = parseIds();
const ids = (
  only ||
  fs.readdirSync(CHAR_ROOT).filter((d) => fs.statSync(path.join(CHAR_ROOT, d)).isDirectory())
).sort();

for (const id of ids) await processPack(id, template);
if (!skipEnlarge && (!only || only.includes('bozza'))) await enlargeBozza();
console.log('Done');
