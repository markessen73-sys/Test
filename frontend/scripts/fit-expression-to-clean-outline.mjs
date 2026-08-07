/**
 * Fit stock ooh / knockout faces into the clean silhouette without growing
 * hair or chin. Aligns by eye-band, then compresses only the overflow above
 * and below the eyes into the clean outline. Photo faces are not touched.
 *
 *   node scripts/fit-expression-to-clean-outline.mjs
 *   node scripts/fit-expression-to-clean-outline.mjs --ids=bozza,default
 */
import { createCanvas, loadImage, ImageData } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAR_ROOT = path.resolve(__dirname, '../public/faces/characters');
const ALPHA = 40;
const EYE_BAND_T = 0.42;

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

function sampleBilinear(data, W, H, x, y) {
  if (x < 0 || y < 0 || x > W - 1 || y > H - 1) {
    return [0, 0, 0, 0];
  }
  if (x >= W - 1 || y >= H - 1) {
    const xi = Math.min(W - 1, Math.max(0, Math.round(x)));
    const yi = Math.min(H - 1, Math.max(0, Math.round(y)));
    const i = (yi * W + xi) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const i00 = (y0 * W + x0) * 4;
  const i10 = (y0 * W + x1) * 4;
  const i01 = (y1 * W + x0) * 4;
  const i11 = (y1 * W + x1) * 4;
  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const v0 = data[i00 + c] * (1 - fx) + data[i10 + c] * fx;
    const v1 = data[i01 + c] * (1 - fx) + data[i11 + c] * fx;
    out[c] = Math.round(v0 * (1 - fy) + v1 * fy);
  }
  return out;
}

function outsideCount(cleanData, otherData, W, H) {
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    if (otherData[i * 4 + 3] < ALPHA) continue;
    if (cleanData[i * 4 + 3] >= ALPHA) continue;
    n++;
  }
  return n;
}

/**
 * Draw expr translated so mid-X and eye-band Y match clean, then for each
 * pixel inside the clean silhouette sample with a piecewise vertical map:
 *   above eyes: expr [top→eye] → clean [top→eye]
 *   below eyes: expr [eye→bot] → clean [eye→bot]
 * Horizontal: slight scale to match clean width (keeps ears in outline).
 */
function fitToCleanOutline(cleanData, exprData, W, H) {
  const cleanBb = opaqueBBox(cleanData, W, H);
  const exprBb = opaqueBBox(exprData, W, H);
  if (!cleanBb || !exprBb) return null;

  const cleanMidX = (cleanBb.x0 + cleanBb.x1) / 2;
  const exprMidX = (exprBb.x0 + exprBb.x1) / 2;
  const cleanEyeY = cleanBb.y0 + (cleanBb.y1 - cleanBb.y0) * EYE_BAND_T;
  const exprEyeY = exprBb.y0 + (exprBb.y1 - exprBb.y0) * EYE_BAND_T;
  const cleanW = Math.max(1, cleanBb.x1 - cleanBb.x0);
  const exprW = Math.max(1, exprBb.x1 - exprBb.x0);
  const scaleX = cleanW / exprW;

  // Aligned expr vertical extents (after eye-band translate; before Y compress)
  const alignedTop = exprBb.y0 + (cleanEyeY - exprEyeY);
  const alignedBot = exprBb.y1 + (cleanEyeY - exprEyeY);

  const out = new Uint8ClampedArray(W * H * 4);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ci = (y * W + x) * 4;
      if (cleanData[ci + 3] < ALPHA) {
        out[ci + 3] = 0;
        continue;
      }

      // Inverse of: x = cleanMidX + (srcX - exprMidX) * scaleX
      const srcX = exprMidX + (x - cleanMidX) / scaleX;

      let srcY;
      if (y <= cleanEyeY) {
        const cleanTopSpan = Math.max(1, cleanEyeY - cleanBb.y0);
        const exprTopSpan = Math.max(1, cleanEyeY - alignedTop);
        const t = (cleanEyeY - y) / cleanTopSpan; // 0 at eye, 1 at clean top
        srcY = exprEyeY - t * exprTopSpan;
      } else {
        const cleanBotSpan = Math.max(1, cleanBb.y1 - cleanEyeY);
        const exprBotSpan = Math.max(1, alignedBot - cleanEyeY);
        const t = (y - cleanEyeY) / cleanBotSpan; // 0 at eye, 1 at clean bot
        srcY = exprEyeY + t * exprBotSpan;
      }

      const [r, g, b, a] = sampleBilinear(exprData, W, H, srcX, srcY);
      if (a < ALPHA) {
        out[ci] = cleanData[ci];
        out[ci + 1] = cleanData[ci + 1];
        out[ci + 2] = cleanData[ci + 2];
        out[ci + 3] = 255;
      } else {
        out[ci] = r;
        out[ci + 1] = g;
        out[ci + 2] = b;
        out[ci + 3] = 255;
      }
    }
  }

  return out;
}

function fillInteriorHoles(data, W, H) {
  const n = W * H;
  const trans = new Uint8Array(n);
  for (let i = 0; i < n; i++) trans[i] = data[i * 4 + 3] < ALPHA ? 1 : 0;
  const bg = new Uint8Array(n);
  const q = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (!trans[i] || bg[i]) return;
    bg[i] = 1;
    q.push(i);
  };
  for (let x = 0; x < W; x++) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    push(0, y);
    push(W - 1, y);
  }
  while (q.length) {
    const i = q.pop();
    const x = i % W;
    const y = (i / W) | 0;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  for (let iter = 0; iter < 80; iter++) {
    const batch = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (!trans[i] || bg[i]) continue;
        let sr = 0,
          sg = 0,
          sb = 0,
          sn = 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, -1],
          [1, -1],
          [-1, 1],
        ]) {
          const j = ((y + dy) * W + (x + dx)) * 4;
          if (data[j + 3] < 200) continue;
          sr += data[j];
          sg += data[j + 1];
          sb += data[j + 2];
          sn++;
        }
        if (sn) batch.push({ i, r: Math.round(sr / sn), g: Math.round(sg / sn), b: Math.round(sb / sn) });
      }
    }
    if (!batch.length) break;
    for (const p of batch) {
      const i4 = p.i * 4;
      data[i4] = p.r;
      data[i4 + 1] = p.g;
      data[i4 + 2] = p.b;
      data[i4 + 3] = 255;
      trans[p.i] = 0;
    }
  }
}

function almostSameSilhouette(cleanData, exprData, W, H) {
  const out = outsideCount(cleanData, exprData, W, H);
  const cb = opaqueBBox(cleanData, W, H);
  const eb = opaqueBBox(exprData, W, H);
  if (!cb || !eb) return true;
  return out === 0 && Math.abs(eb.y0 - cb.y0) <= 1 && Math.abs(eb.y1 - cb.y1) <= 1;
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

function writeData(file, data, W, H, cleanData = null) {
  fillInteriorHoles(data, W, H);
  // Hole-fill can paint concave exterior pockets (ear notches) — force clean mask.
  if (cleanData) {
    for (let i = 0; i < W * H; i++) {
      if (cleanData[i * 4 + 3] < ALPHA) {
        data[i * 4] = 0;
        data[i * 4 + 1] = 0;
        data[i * 4 + 2] = 0;
        data[i * 4 + 3] = 0;
      } else if (data[i * 4 + 3] >= ALPHA) {
        data[i * 4 + 3] = 255;
      }
    }
  }
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.putImageData(new ImageData(data, W, H), 0, 0);
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

async function processPack(id) {
  const root = path.join(CHAR_ROOT, id);
  const cleanPath = path.join(root, 'clean.png');
  const oohPath = path.join(root, 'ooh.png');
  const koPath = path.join(root, 'knockout.png');
  if (![cleanPath, oohPath, koPath].every((p) => fs.existsSync(p))) {
    console.log(id, 'skip — missing files');
    return;
  }

  const clean = await loadRgba(cleanPath);
  const { W, H } = clean;
  const ooh = await loadRgba(oohPath);
  const ko = await loadRgba(koPath);

  const oohSame = almostSameSilhouette(clean.imageData.data, ooh.imageData.data, W, H);
  const koSame = almostSameSilhouette(clean.imageData.data, ko.imageData.data, W, H);
  if (oohSame && koSame) {
    console.log(id, 'already matched clean outline — skip');
    return;
  }

  let oohOut = new Uint8ClampedArray(ooh.imageData.data);
  let koOut = new Uint8ClampedArray(ko.imageData.data);
  if (!oohSame) {
    oohOut = fitToCleanOutline(clean.imageData.data, ooh.imageData.data, W, H);
    writeData(oohPath, oohOut, W, H, clean.imageData.data);
  }
  if (!koSame) {
    koOut = fitToCleanOutline(clean.imageData.data, ko.imageData.data, W, H);
    writeData(koPath, koOut, W, H, clean.imageData.data);
  }

  const syncPairs = [
    [path.join(root, 'damage-stages/10-knockout.png'), koOut],
    [path.join(root, 'bobo-clown-stages/ooh.png'), oohOut],
    [path.join(root, 'bobo-clown-stages/knockout-clean.png'), koOut],
    [path.join(root, 'bobo-clown-stages/10-knockout.png'), koOut],
  ];
  for (const [file, data] of syncPairs) {
    if (!fs.existsSync(file) || !data) continue;
    writeData(file, data, W, H, clean.imageData.data);
  }

  const cleanBb = opaqueBBox(clean.imageData.data, W, H);
  const oohBb = opaqueBBox(oohOut, W, H);
  console.log(
    id,
    'oohOutside',
    outsideCount(clean.imageData.data, oohOut, W, H),
    'koOutside',
    outsideCount(clean.imageData.data, koOut, W, H),
    'H',
    cleanBb ? cleanBb.y1 - cleanBb.y0 + 1 : '?',
    oohBb ? oohBb.y1 - oohBb.y0 + 1 : '?',
    oohSame ? '(ooh skipped)' : '(ooh fitted)',
    koSame ? '(ko skipped)' : '(ko fitted)'
  );
}

const only = parseIds();
const ids = (
  only ||
  fs.readdirSync(CHAR_ROOT).filter((d) => fs.statSync(path.join(CHAR_ROOT, d)).isDirectory())
).sort();

console.log('Fitting stock ooh/KO into clean outlines (eye-anchored)…');
for (const id of ids) {
  await processPack(id);
}
console.log('Done');
