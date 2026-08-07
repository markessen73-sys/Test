/**
 * Ensure clean / ooh / knockout (and damage + bobo mirrors) share enough
 * clear space above and below so taller ooh expressions aren't clipped.
 *
 * Finds the union opaque bbox of clean+ooh+KO, shrinks all pack PNGs by the
 * same transform about that center, then recenters so ≥MARGIN top/bottom remain.
 *
 *   node scripts/pad-face-pack-margins.mjs
 *   node scripts/pad-face-pack-margins.mjs --ids bozza,tin-mick
 */
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAR_ROOT = path.resolve(__dirname, '../public/faces/characters');

/** ~12% — large clear frame so hair / chin / ears / ooh lift never clip. */
const MARGIN = Math.floor(0.12 * 1024);
const ALPHA = 40;

function parseIds() {
  const arg = process.argv.find((a) => a.startsWith('--ids='));
  if (!arg) return null;
  return arg
    .slice('--ids='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function opaqueBBox(data, W, H) {
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

function unionBBox(boxes) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const b of boxes) {
    if (!b) continue;
    if (b.x0 < x0) x0 = b.x0;
    if (b.y0 < y0) y0 = b.y0;
    if (b.x1 > x1) x1 = b.x1;
    if (b.y1 > y1) y1 = b.y1;
  }
  if (!Number.isFinite(x0)) return null;
  return { x0, y0, x1, y1 };
}

function spanAtY(data, W, H, yFrac) {
  const y = Math.min(H - 1, Math.max(0, Math.floor(yFrac * H)));
  let L = null,
    R = null;
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > ALPHA) {
      if (L === null) L = x;
      R = x;
    }
  }
  return L === null ? null : (R - L + 1) / W;
}

async function loadRgba(file) {
  const img = await loadImage(file);
  const W = img.width;
  const H = img.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0);
  return { canvas, imageData: ctx.getImageData(0, 0, W, H), W, H };
}

function writePng(file, canvas) {
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

function listPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith('.png'))
    .map((n) => path.join(dir, n));
}

/**
 * Shared affine: scale about (cx,cy), then translate so union lands centered
 * with required margins.
 */
function applyTransform(srcCanvas, W, H, scale, cx, cy, tx, ty) {
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.translate(tx, ty);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.drawImage(srcCanvas, 0, 0);
  return ctx.canvas;
}

function marginsOk(bb, W, H) {
  if (!bb) return false;
  return (
    bb.y0 >= MARGIN &&
    bb.y1 <= H - 1 - MARGIN &&
    bb.x0 >= Math.floor(MARGIN * 0.4) &&
    bb.x1 <= W - 1 - Math.floor(MARGIN * 0.4)
  );
}

async function padPack(id) {
  const root = path.join(CHAR_ROOT, id);
  const cleanPath = path.join(root, 'clean.png');
  const oohPath = path.join(root, 'ooh.png');
  const koPath = path.join(root, 'knockout.png');
  if (!fs.existsSync(cleanPath) || !fs.existsSync(oohPath) || !fs.existsSync(koPath)) {
    console.log(id, 'skip — missing clean/ooh/ko');
    return null;
  }

  const clean = await loadRgba(cleanPath);
  const ooh = await loadRgba(oohPath);
  const ko = await loadRgba(koPath);
  const { W, H } = clean;
  if (ooh.W !== W || ko.W !== W) {
    console.log(id, 'skip — size mismatch');
    return null;
  }

  const boxes = [
    opaqueBBox(clean.imageData.data, W, H),
    opaqueBBox(ooh.imageData.data, W, H),
    opaqueBBox(ko.imageData.data, W, H),
  ];
  const uni = unionBBox(boxes);
  if (!uni) {
    console.log(id, 'skip — empty');
    return null;
  }

  const already =
    marginsOk(boxes[0], W, H) && marginsOk(boxes[1], W, H) && marginsOk(boxes[2], W, H);
  if (already) {
    console.log(
      id,
      'ok — margins already ≥',
      (MARGIN / H).toFixed(3),
      'top/bot',
      (boxes[0].y0 / H).toFixed(3),
      (boxes[1].y0 / H).toFixed(3),
      (boxes[2].y0 / H).toFixed(3)
    );
    return { id, skipped: true };
  }

  const contentH = uni.y1 - uni.y0 + 1;
  const contentW = uni.x1 - uni.x0 + 1;
  let scale = Math.min(
    (H - 2 * MARGIN) / contentH,
    (W - 2 * Math.floor(MARGIN * 0.4)) / contentW
  );
  // Never enlarge — only shrink to make room for expressions.
  if (scale > 1) scale = 1;

  const cx = (uni.x0 + uni.x1) / 2;
  const cy = (uni.y0 + uni.y1) / 2;
  const dstCx = W / 2;
  const dstCy = H / 2;

  // Iterate: shrink + re-center until all three clear margins.
  let tx = dstCx;
  let ty = dstCy;
  let probeClean = applyTransform(clean.canvas, W, H, scale, cx, cy, tx, ty);
  for (let iter = 0; iter < 20; iter++) {
    const probes = [
      applyTransform(clean.canvas, W, H, scale, cx, cy, tx, ty),
      applyTransform(ooh.canvas, W, H, scale, cx, cy, tx, ty),
      applyTransform(ko.canvas, W, H, scale, cx, cy, tx, ty),
    ];
    const pBoxes = probes.map((c) =>
      opaqueBBox(c.getContext('2d').getImageData(0, 0, W, H).data, W, H)
    );
    const u2 = unionBBox(pBoxes);
    if (!u2) break;
    if (marginsOk(u2, W, H) && pBoxes.every((b) => marginsOk(b, W, H))) {
      probeClean = probes[0];
      break;
    }
    // Nudge union toward center
    const ucx = (u2.x0 + u2.x1) / 2;
    const ucy = (u2.y0 + u2.y1) / 2;
    tx += dstCx - ucx;
    ty += dstCy - ucy;
    // If still clipped after nudge, shrink more
    const still =
      u2.y0 < MARGIN ||
      u2.y1 > H - 1 - MARGIN ||
      u2.x0 < Math.floor(MARGIN * 0.4) ||
      u2.x1 > W - 1 - Math.floor(MARGIN * 0.4);
    if (still) {
      scale *= 0.97;
      tx = dstCx;
      ty = dstCy;
    }
    probeClean = probes[0];
  }

  const midBefore = spanAtY(clean.imageData.data, W, H, 0.55);
  const midAfter = spanAtY(
    probeClean.getContext('2d').getImageData(0, 0, W, H).data,
    W,
    H,
    0.55
  );

  const files = [
    cleanPath,
    oohPath,
    koPath,
    ...listPngs(path.join(root, 'damage-stages')),
    ...listPngs(path.join(root, 'bobo-clown-stages')),
  ];

  for (const file of files) {
    const src = await loadRgba(file);
    const out = applyTransform(src.canvas, W, H, scale, cx, cy, tx, ty);
    writePng(file, out);
  }

  const oohOut = await loadRgba(oohPath);
  const oohBb = opaqueBBox(oohOut.imageData.data, W, H);
  console.log(
    id,
    'scale',
    scale.toFixed(3),
    'mid',
    midBefore?.toFixed(3),
    '→',
    midAfter?.toFixed(3),
    'ooh top/bot',
    oohBb ? (oohBb.y0 / H).toFixed(3) : '?',
    oohBb ? ((H - 1 - oohBb.y1) / H).toFixed(3) : '?',
    'files',
    files.length
  );
  return {
    id,
    scale,
    midBefore,
    midAfter,
    skipped: false,
  };
}

const only = parseIds();
const ids = (
  only ||
  fs.readdirSync(CHAR_ROOT).filter((d) => fs.statSync(path.join(CHAR_ROOT, d)).isDirectory())
).sort();

console.log('MARGIN', MARGIN, `(${(MARGIN / 1024).toFixed(3)} of 1024)`);
const results = [];
for (const id of ids) {
  results.push(await padPack(id));
}
console.log('\nDone');
