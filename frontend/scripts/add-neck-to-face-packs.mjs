/**
 * Add a short neck stump below the chin on every stock face pack PNG so ring
 * body blending has skin to fade into (chin no longer vanishes).
 *
 * Uses existing bottom clear margin — does not shrink the head.
 *
 *   node scripts/add-neck-to-face-packs.mjs
 *   node scripts/add-neck-to-face-packs.mjs --ids=bozza,default
 */
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAR_ROOT = path.resolve(__dirname, '../public/faces/characters');
const W = 1024;
const H = 1024;
const ALPHA = 40;
/** Neck length as fraction of face (chin→bottom) height. */
const NECK_FRAC = 0.11;
/** Top of neck width vs chin span; tapers toward bottom. */
const NECK_TOP_WIDTH = 0.72;
const NECK_BOT_WIDTH = 0.48;

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
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return n ? { x0, y0, x1, y1 } : null;
}

function spanAtY(data, y) {
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

function isSkinish(r, g, b) {
  const L = 0.299 * r + 0.587 * g + 0.114 * b;
  if (L < 40 || L > 250) return false;
  if (b > r + 35 && b > g + 25) return false;
  if (g > r + 40 && g > b + 30) return false;
  return r > 60 && g > 35 && b > 20 && r >= g - 30;
}

function sampleJawSkin(data, bb) {
  const y0 = Math.floor(bb.y0 + (bb.y1 - bb.y0) * 0.72);
  const y1 = bb.y1;
  let sr = 0,
    sg = 0,
    sb = 0,
    n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 180) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (!isSkinish(r, g, b)) continue;
      // Skip near-black outline / hair
      if (Math.max(r, g, b) < 55) continue;
      sr += r;
      sg += g;
      sb += b;
      n++;
    }
  }
  if (!n) return [210, 150, 110];
  return [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)];
}

/** True if pack already has a meaningful neck (bottom span still wide). */
function alreadyHasNeck(data, bb) {
  const faceH = bb.y1 - bb.y0 + 1;
  const mid = spanAtY(data, bb.y0 + faceH * 0.55);
  const bot = spanAtY(data, bb.y1 - 2);
  if (!mid || !bot) return false;
  // Neck-ish if bottom is still ≥35% of mid span and bot margin is small
  const botMargin = H - 1 - bb.y1;
  return bot.w / mid.w > 0.38 && botMargin < 0.08 * H;
}

function addNeckToImageData(data) {
  const bb = opaqueBBox(data);
  if (!bb) return { added: false, reason: 'empty' };
  if (alreadyHasNeck(data, bb)) return { added: false, reason: 'already' };

  const faceH = bb.y1 - bb.y0 + 1;
  const chin = spanAtY(data, bb.y1 - 3) || spanAtY(data, bb.y1 - 8);
  if (!chin || chin.w < 20) return { added: false, reason: 'no-chin' };

  const skin = sampleJawSkin(data, bb);
  const neckH = Math.min(
    Math.floor(faceH * NECK_FRAC),
    Math.max(24, H - 1 - bb.y1 - 8) // leave a few px clear at canvas bottom
  );
  if (neckH < 18) return { added: false, reason: 'no-room' };

  const cx = chin.mid;
  let painted = 0;
  for (let dy = 1; dy <= neckH; dy++) {
    const y = bb.y1 + dy;
    if (y >= H - 2) break;
    const t = dy / neckH;
    const widthFrac = NECK_TOP_WIDTH * (1 - t) + NECK_BOT_WIDTH * t;
    const half = (chin.w * widthFrac) / 2;
    // Slight shade darker toward bottom / sides
    const shade = 1 - t * 0.12;
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      if (x < 1 || x >= W - 1) continue;
      const nx = (x - cx) / half;
      if (nx * nx > 1) continue;
      const edge = Math.sqrt(Math.max(0, 1 - nx * nx));
      const i = (y * W + x) * 4;
      // Don't overwrite existing opaque pixels
      if (data[i + 3] > ALPHA) continue;
      const sideDark = 1 - Math.abs(nx) * 0.08;
      data[i] = Math.round(skin[0] * shade * sideDark);
      data[i + 1] = Math.round(skin[1] * shade * sideDark);
      data[i + 2] = Math.round(skin[2] * shade * sideDark);
      data[i + 3] = Math.round(255 * Math.min(1, 0.55 + 0.45 * edge));
      painted++;
    }
  }

  // Soften the chin→neck seam: blend 3 rows above chin into neck color slightly
  for (let dy = 0; dy < 4; dy++) {
    const y = bb.y1 - dy;
    if (y < 0) continue;
    const mix = 0.12 * (1 - dy / 4);
    const half = (chin.w * NECK_TOP_WIDTH) / 2;
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      if (x < 0 || x >= W) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA) continue;
      if (!isSkinish(data[i], data[i + 1], data[i + 2])) continue;
      data[i] = Math.round(data[i] * (1 - mix) + skin[0] * mix);
      data[i + 1] = Math.round(data[i + 1] * (1 - mix) + skin[1] * mix);
      data[i + 2] = Math.round(data[i + 2] * (1 - mix) + skin[2] * mix);
    }
  }

  return { added: true, painted, neckH, skin };
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

async function processPack(id) {
  const root = path.join(CHAR_ROOT, id);
  if (!fs.existsSync(path.join(root, 'clean.png'))) {
    console.log(id, 'skip — no clean');
    return;
  }
  // Probe clean first
  const probeImg = await loadImage(path.join(root, 'clean.png'));
  const probe = createCanvas(W, H).getContext('2d');
  probe.clearRect(0, 0, W, H);
  probe.drawImage(probeImg, 0, 0);
  const probeData = probe.getImageData(0, 0, W, H);
  const trial = addNeckToImageData(new Uint8ClampedArray(probeData.data));
  if (!trial.added) {
    console.log(id, 'skip —', trial.reason);
    return;
  }

  const files = listPngs(root);
  for (const file of files) {
    const img = await loadImage(file);
    const ctx = createCanvas(W, H).getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0);
    const idata = ctx.getImageData(0, 0, W, H);
    const r = addNeckToImageData(idata.data);
    if (!r.added) continue;
    ctx.putImageData(idata, 0, 0);
    fs.writeFileSync(file, ctx.canvas.toBuffer('image/png'));
  }
  console.log(
    id,
    'neck',
    trial.neckH + 'px',
    'skin',
    trial.skin,
    'files',
    files.length
  );
}

const only = parseIds();
const ids = (
  only ||
  fs.readdirSync(CHAR_ROOT).filter((d) => fs.statSync(path.join(CHAR_ROOT, d)).isDirectory())
).sort();

for (const id of ids) {
  await processPack(id);
}
console.log('Done');
