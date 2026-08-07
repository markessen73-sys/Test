/**
 * Remake stock (premade) ooh faces from clean: same outline, only
 *   - mouth → open "O"
 *   - eyes → slight bulge
 * Photo faces are not touched.
 *
 *   node scripts/bake-stock-ooh-from-clean.mjs
 *   node scripts/bake-stock-ooh-from-clean.mjs --ids=default,bozza
 */
import { createCanvas, loadImage, ImageData } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { W, H, LM, isIris, isSclera, lum } from './lib/faceDamageBake.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAR_ROOT = path.resolve(__dirname, '../public/faces/characters');
const ALPHA = 40;
const EYE_BULGE = 1.22;

function parseIds() {
  const arg = process.argv.find((a) => a.startsWith('--ids='));
  if (!arg) return null;
  return arg
    .slice('--ids='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isSkinish(r, g, b) {
  return r > 85 && g > 45 && b > 30 && r >= g - 20 && r > b - 10 && lum(r, g, b) < 245;
}

function sampleAround(data, cx, cy, radius, pred) {
  let sr = 0,
    sg = 0,
    sb = 0,
    n = 0;
  const r0 = Math.floor(radius);
  for (let dy = -r0; dy <= r0; dy++) {
    for (let dx = -r0; dx <= r0; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const x = Math.round(cx + dx);
      const y = Math.round(cy + dy);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < 180) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (pred && !pred(r, g, b)) continue;
      sr += r;
      sg += g;
      sb += b;
      n++;
    }
  }
  if (!n) return null;
  return [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)];
}

function fillEllipse(data, cx, cy, rx, ry, rgb, alpha = 1, onlyOpaque = true) {
  const x0 = Math.max(0, Math.floor(cx - rx - 1));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx + 1));
  const y0 = Math.max(0, Math.floor(cy - ry - 1));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const i = (y * W + x) * 4;
      if (onlyOpaque && data[i + 3] < ALPHA) continue;
      const edge = Math.max(0, 1 - d2);
      const t = Math.min(1, alpha * (0.45 + 0.55 * edge));
      data[i] = Math.round(data[i] * (1 - t) + rgb[0] * t);
      data[i + 1] = Math.round(data[i + 1] * (1 - t) + rgb[1] * t);
      data[i + 2] = Math.round(data[i + 2] * (1 - t) + rgb[2] * t);
      if (data[i + 3] < 255 && data[i + 3] >= ALPHA) data[i + 3] = 255;
    }
  }
}

/** Detect eye center + radius near LM via iris/sclera (fallback: dark pupil). */
function detectEye(data, eyeLm, searchR = 0.07) {
  const irisPts = [];
  const scleraPts = [];
  const darkPts = [];
  const x0 = Math.max(0, Math.floor((eyeLm.x - searchR) * W));
  const x1 = Math.min(W - 1, Math.ceil((eyeLm.x + searchR) * W));
  const y0 = Math.max(0, Math.floor((eyeLm.y - searchR) * H));
  const y1 = Math.min(H - 1, Math.ceil((eyeLm.y + searchR) * H));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      if (Math.hypot(nx - eyeLm.x, ny - eyeLm.y) > searchR) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < 200) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (isIris(r, g, b)) irisPts.push([x, y]);
      else if (isSclera(r, g, b)) scleraPts.push([x, y]);
      else if (lum(r, g, b) < 50) darkPts.push([x, y]);
    }
  }
  const pts = irisPts.length >= 8 ? irisPts : irisPts.concat(darkPts).concat(scleraPts);
  if (pts.length < 8) {
    return { cx: eyeLm.x * W, cy: eyeLm.y * H, r: 0.032 * W };
  }
  let sx = 0,
    sy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
  }
  const cx = sx / pts.length;
  const cy = sy / pts.length;
  // Radius from iris core only when possible — avoid giant disks from sclera.
  const radPts = irisPts.length >= 8 ? irisPts : pts;
  let maxD = 0;
  for (const [x, y] of radPts) {
    maxD = Math.max(maxD, Math.hypot(x - cx, y - cy));
  }
  const r = Math.max(0.024 * W, Math.min(0.045 * W, maxD * 1.25));
  return { cx, cy, r };
}

function isEyePixel(r, g, b) {
  return isIris(r, g, b) || isSclera(r, g, b) || lum(r, g, b) < 48;
}

/**
 * Bulge one eye by radially enlarging existing eye pixels only.
 * Does not stamp skin/sclera discs onto cheeks or glasses frames.
 */
function bulgeEye(src, dst, eye) {
  const rOut = eye.r * EYE_BULGE;
  const x0 = Math.max(0, Math.floor(eye.cx - rOut - 2));
  const x1 = Math.min(W - 1, Math.ceil(eye.cx + rOut + 2));
  const y0 = Math.max(0, Math.floor(eye.cy - rOut - 2));
  const y1 = Math.min(H - 1, Math.ceil(eye.cy + rOut + 2));

  // Snapshot original eye patch so we can leave non-eye pixels untouched.
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - eye.cx;
      const dy = y - eye.cy;
      const d = Math.hypot(dx, dy);
      if (d > rOut) continue;
      const di = (y * W + x) * 4;
      if (dst[di + 3] < ALPHA) continue;

      const srcD = d / EYE_BULGE;
      const sx = eye.cx + (d < 1e-6 ? 0 : (dx / d) * srcD);
      const sy = eye.cy + (d < 1e-6 ? 0 : (dy / d) * srcD);
      const six = Math.round(sx);
      const siy = Math.round(sy);
      if (six < 0 || siy < 0 || six >= W || siy >= H) continue;
      const si = (siy * W + six) * 4;
      if (src[si + 3] < ALPHA) continue;
      const sr = src[si],
        sg = src[si + 1],
        sb = src[si + 2];
      const dr = dst[di],
        dg = dst[di + 1],
        db = dst[di + 2];
      // Only write where source or dest already looks like eye content.
      if (!isEyePixel(sr, sg, sb) && !isEyePixel(dr, dg, db)) continue;
      // Don't paint over thick black glasses frames.
      if (Math.max(dr, dg, db) < 40 && Math.max(sr, sg, sb) < 40) continue;
      dst[di] = sr;
      dst[di + 1] = sg;
      dst[di + 2] = sb;
      dst[di + 3] = 255;
    }
  }
}

function isToothish(r, g, b) {
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return r > 185 && g > 180 && b > 165 && chroma < 50;
}

function isMouthCavity(r, g, b) {
  return lum(r, g, b) < 70;
}

function isLipish(r, g, b, skin) {
  // Warm/redder than nearby skin, or dark lip line.
  if (r > skin[0] + 15 && r > g + 20 && r > b + 15) return true;
  if (lum(r, g, b) < 90 && r > g && r > b) return true;
  return false;
}

/** Hard-cover smile/teeth, then paint a solid opaque O mouth. */
function paintOohMouth(ctx, data, skin) {
  // Prefer detected tooth centroid when present (wide grins sit lower than LM).
  let mx = LM.mouth.x * W;
  let my = LM.mouth.y * H;
  const teeth = [];
  for (let y = Math.floor(0.52 * H); y < Math.floor(0.82 * H); y++) {
    for (let x = Math.floor(0.28 * W); x < Math.floor(0.72 * W); x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 200) continue;
      if (isToothish(data[i], data[i + 1], data[i + 2])) teeth.push([x, y]);
    }
  }
  if (teeth.length >= 40) {
    let sx = 0,
      sy = 0;
    for (const [x, y] of teeth) {
      sx += x;
      sy += y;
    }
    mx = sx / teeth.length;
    my = sy / teeth.length;
  }

  const coverRx = 0.18 * W;
  const coverRy = 0.12 * H;
  for (let y = Math.floor(my - coverRy); y <= Math.ceil(my + coverRy); y++) {
    for (let x = Math.floor(mx - coverRx); x <= Math.ceil(mx + coverRx); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const nx = (x - mx) / coverRx;
      const ny = (y - my) / coverRy;
      if (nx * nx + ny * ny > 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (isToothish(r, g, b) || isMouthCavity(r, g, b) || isLipish(r, g, b, skin)) {
        data[i] = skin[0];
        data[i + 1] = skin[1];
        data[i + 2] = skin[2];
        data[i + 3] = 255;
      }
    }
  }
  // Opaque skin plate over the whole mouth oval (kills grin lines / beard smile).
  for (let y = Math.floor(my - coverRy); y <= Math.ceil(my + coverRy); y++) {
    for (let x = Math.floor(mx - coverRx); x <= Math.ceil(mx + coverRx); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const nx = (x - mx) / coverRx;
      const ny = (y - my) / coverRy;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA) continue;
      // Feather only the outer 15% so the plate edge isn't a hard stamp.
      const edge = d2 > 0.72 ? (1 - d2) / 0.28 : 1;
      const t = Math.max(0, Math.min(1, edge));
      data[i] = Math.round(data[i] * (1 - t) + skin[0] * t);
      data[i + 1] = Math.round(data[i + 1] * (1 - t) + skin[1] * t);
      data[i + 2] = Math.round(data[i + 2] * (1 - t) + skin[2] * t);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(new ImageData(data, W, H), 0, 0);

  const lip = [
    Math.min(255, Math.round(skin[0] * 0.85 + 40)),
    Math.max(35, Math.round(skin[1] * 0.55)),
    Math.max(35, Math.round(skin[2] * 0.5)),
  ];
  const lipDark = [
    Math.max(25, lip[0] - 50),
    Math.max(15, lip[1] - 45),
    Math.max(15, lip[2] - 40),
  ];

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgb(${lip.join(',')})`;
  ctx.beginPath();
  ctx.ellipse(mx, my + 2, 0.052 * W, 0.068 * H, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgb(${lipDark.join(',')})`;
  ctx.beginPath();
  ctx.ellipse(mx, my + 4, 0.034 * W, 0.048 * H, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0e0705';
  ctx.beginPath();
  ctx.ellipse(mx, my + 6, 0.024 * W, 0.036 * H, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgb(${Math.min(255, skin[0] + 35)},${Math.max(35, skin[1] - 55)},${Math.max(35, skin[2] - 35)})`;
  ctx.beginPath();
  ctx.ellipse(mx, my + 0.026 * H, 0.014 * W, 0.01 * H, 0, 0, Math.PI * 2);
  ctx.fill();

  // Scrub any leftover tooth pixels on the lower face (3D grins can spill).
  const after = ctx.getImageData(0, 0, W, H);
  const ad = after.data;
  for (let y = Math.floor(0.5 * H); y < Math.floor(0.85 * H); y++) {
    for (let x = Math.floor(0.22 * W); x < Math.floor(0.78 * W); x++) {
      const i = (y * W + x) * 4;
      if (ad[i + 3] < ALPHA) continue;
      const odx = (x - mx) / (0.055 * W);
      const ody = (y - (my + 2)) / (0.07 * H);
      if (odx * odx + ody * ody < 1.05) continue;
      if (isToothish(ad[i], ad[i + 1], ad[i + 2])) {
        ad[i] = skin[0];
        ad[i + 1] = skin[1];
        ad[i + 2] = skin[2];
        ad[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(after, 0, 0);
}

function writePng(file, canvas) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

async function bakeOoh(id) {
  const root = path.join(CHAR_ROOT, id);
  const cleanPath = path.join(root, 'clean.png');
  const oohPath = path.join(root, 'ooh.png');
  if (!fs.existsSync(cleanPath)) {
    console.log(id, 'skip — no clean');
    return;
  }

  const img = await loadImage(cleanPath);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const idata = ctx.getImageData(0, 0, W, H);
  const src = new Uint8ClampedArray(idata.data); // pristine clean
  const dst = idata.data;

  const skin =
    sampleAround(src, LM.mouth.x * W, LM.mouth.y * H - 0.08 * H, 40, isSkinish) ||
    sampleAround(src, LM.nose.x * W, (LM.nose.y + 0.06) * H, 36, isSkinish) || [210, 160, 130];

  const rightEye = detectEye(src, LM.rightEye);
  const leftEye = detectEye(src, LM.leftEye);
  bulgeEye(src, dst, rightEye);
  bulgeEye(src, dst, leftEye);
  ctx.putImageData(idata, 0, 0);

  paintOohMouth(ctx, dst, skin);

  // Re-read after canvas mouth strokes, then hard-mask to clean alpha.
  const final = ctx.getImageData(0, 0, W, H);
  const out = final.data;
  for (let i = 0; i < W * H; i++) {
    if (src[i * 4 + 3] < ALPHA) {
      out[i * 4] = 0;
      out[i * 4 + 1] = 0;
      out[i * 4 + 2] = 0;
      out[i * 4 + 3] = 0;
    } else if (out[i * 4 + 3] >= ALPHA) {
      out[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(final, 0, 0);
  writePng(oohPath, canvas);

  const boboOoh = path.join(root, 'bobo-clown-stages', 'ooh.png');
  if (fs.existsSync(path.dirname(boboOoh))) {
    writePng(boboOoh, canvas);
  }

  console.log(
    id,
    'eyes r',
    rightEye.r.toFixed(1),
    leftEye.r.toFixed(1),
    'skin',
    skin.join(',')
  );
}

const only = parseIds();
const ids = (
  only ||
  fs.readdirSync(CHAR_ROOT).filter((d) => fs.statSync(path.join(CHAR_ROOT, d)).isDirectory())
).sort();

console.log('Baking stock ooh from clean (mouth O + eye bulge)…');
for (const id of ids) {
  await bakeOoh(id);
}
console.log('Done');
