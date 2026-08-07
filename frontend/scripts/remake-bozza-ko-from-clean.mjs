/**
 * Remake Bozza knockout from the normal (clean) face so style + size match.
 * Closed eyes + frown painted on the clean caricature; orbiting KO stars are
 * added at runtime by paintKnockoutFace (do not bake stars into the PNG).
 *
 *   node scripts/remake-bozza-ko-from-clean.mjs
 */
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  W,
  H,
  LM,
  sampleFaceSkin,
  applyCauliflowerEar,
  applyBlackEye,
  applyChinCrossPlaster,
  applyMissingTooth,
  applySwollenEye,
  applyBrokenNose,
  applyForeheadBandage,
} from './lib/faceDamageBake.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAR = path.resolve(__dirname, '../public/faces/characters/bozza');
const ART = '/opt/cursor/artifacts/assets';

function writePng(file, canvas) {
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

function copyImageData(src) {
  const out = createCanvas(W, H).getContext('2d').createImageData(W, H);
  out.data.set(src.data);
  return out;
}

/** Average opaque RGB in a disc (prefer skin-ish pixels). */
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

function isSkinish(r, g, b) {
  return r > 90 && g > 50 && b > 35 && r >= g - 10 && r > b && g > b - 20;
}

function fillEllipse(data, cx, cy, rx, ry, rgb, alpha = 1) {
  const x0 = Math.max(0, Math.floor(cx - rx - 1));
  const x1 = Math.min(W - 1, Math.ceil(cx + rx + 1));
  const y0 = Math.max(0, Math.floor(cy - ry - 1));
  const y1 = Math.min(H - 1, Math.ceil(cy + ry + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < 40) continue;
      const edge = Math.max(0, 1 - d);
      const t = Math.min(1, alpha * (0.55 + 0.45 * edge));
      data[i] = Math.round(data[i] * (1 - t) + rgb[0] * t);
      data[i + 1] = Math.round(data[i + 1] * (1 - t) + rgb[1] * t);
      data[i + 2] = Math.round(data[i + 2] * (1 - t) + rgb[2] * t);
    }
  }
}

function strokeClosedEye(ctx, cx, cy, halfW, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(4, halfW * 0.14);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - halfW, cy);
  ctx.quadraticCurveTo(cx, cy + halfW * 0.45, cx + halfW, cy);
  ctx.stroke();
  // Upper lid crease
  ctx.lineWidth = Math.max(2.5, halfW * 0.08);
  ctx.beginPath();
  ctx.moveTo(cx - halfW * 0.92, cy - halfW * 0.12);
  ctx.quadraticCurveTo(cx, cy - halfW * 0.38, cx + halfW * 0.92, cy - halfW * 0.12);
  ctx.stroke();
}

function strokeFrown(ctx, cx, cy, halfW, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(5, halfW * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - halfW, cy - halfW * 0.15);
  ctx.quadraticCurveTo(cx, cy + halfW * 0.55, cx + halfW, cy - halfW * 0.15);
  ctx.stroke();
}

function paintKoExpression(cleanCanvas) {
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(cleanCanvas, 0, 0);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;

  const skin =
    sampleAround(d, LM.nose.x * W, (LM.nose.y + 0.04) * H, 28, isSkinish) ||
    sampleAround(d, 0.45 * W, 0.55 * H, 40, isSkinish) ||
    [210, 150, 120];

  const lid = [
    Math.min(255, skin[0] + 8),
    Math.min(255, skin[1] + 4),
    Math.min(255, skin[2]),
  ];
  const line = [48, 28, 22];

  // Cover open eyes / glasses lenses with lids (keep frames by soft centre fill).
  for (const eye of [LM.rightEye, LM.leftEye]) {
    fillEllipse(d, eye.x * W, eye.y * H, 0.07 * W, 0.048 * H, lid, 0.97);
    fillEllipse(d, eye.x * W, eye.y * H + 2, 0.062 * W, 0.036 * H, lid, 0.9);
    fillEllipse(d, eye.x * W, eye.y * H - 6, 0.06 * W, 0.03 * H, lid, 0.85);
  }

  // Cover smile / teeth with skin, then paint frown.
  fillEllipse(d, LM.mouth.x * W, LM.mouth.y * H - 4, 0.14 * W, 0.085 * H, skin, 0.97);
  fillEllipse(d, LM.mouth.x * W, LM.mouth.y * H + 10, 0.12 * W, 0.06 * H, skin, 0.9);

  ctx.putImageData(id, 0, 0);

  strokeClosedEye(ctx, LM.rightEye.x * W, LM.rightEye.y * H, 0.048 * W, `rgb(${line})`);
  strokeClosedEye(ctx, LM.leftEye.x * W, LM.leftEye.y * H, 0.048 * W, `rgb(${line})`);
  strokeFrown(ctx, LM.mouth.x * W, LM.mouth.y * H + 2, 0.09 * W, `rgb(${line})`);

  return ctx.canvas;
}

async function bakeDamage(charDir, cleanCanvas, koCanvas) {
  const clean = cleanCanvas.getContext('2d').getImageData(0, 0, W, H);
  const live = createCanvas(W, H);
  const liveCtx = live.getContext('2d');
  liveCtx.drawImage(cleanCanvas, 0, 0);
  const face = liveCtx.getImageData(0, 0, W, H);
  const skin = sampleFaceSkin(clean);
  const outDir = path.join(charDir, 'damage-stages');
  fs.mkdirSync(outDir, { recursive: true });
  const steps = [
    { name: '00-clean.png', run: null },
    { name: '01-cauliflowerLeftEar.png', run: () => applyCauliflowerEar(face, clean, 'left', skin) },
    { name: '02-blackRightEye.png', run: () => applyBlackEye(face, 'right') },
    { name: '03-chinCrossPlaster.png', run: () => applyChinCrossPlaster(face, clean) },
    { name: '04-cauliflowerRightEar.png', run: () => applyCauliflowerEar(face, clean, 'right', skin) },
    { name: '05-missingTooth.png', run: () => applyMissingTooth(face) },
    { name: '06-swollenLeftEye.png', run: () => applySwollenEye(face, 'left') },
    { name: '07-brokenNose.png', run: () => applyBrokenNose(face) },
    { name: '08-foreheadBandage.png', run: () => applyForeheadBandage(face, clean) },
  ];
  function maskToClean(f, c, dilate = 8) {
    const allow = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (c.data[(y * W + x) * 4 + 3] > 40) {
          for (let dy = -dilate; dy <= dilate; dy++) {
            for (let dx = -dilate; dx <= dilate; dx++) {
              if (dx * dx + dy * dy > dilate * dilate) continue;
              const nx = x + dx,
                ny = y + dy;
              if (nx >= 0 && ny >= 0 && nx < W && ny < H) allow[ny * W + nx] = 1;
            }
          }
        }
      }
    }
    for (let i = 0; i < W * H; i++) {
      if (!allow[i] && f.data[i * 4 + 3] > 0) f.data[i * 4 + 3] = 0;
    }
  }
  for (const step of steps) {
    if (step.run) {
      step.run();
      maskToClean(face, clean);
    }
    liveCtx.putImageData(face, 0, 0);
    fs.writeFileSync(path.join(outDir, step.name), live.toBuffer('image/png'));
  }
  liveCtx.putImageData(face, 0, 0);
  fs.writeFileSync(path.join(outDir, '09-hold.png'), live.toBuffer('image/png'));
  liveCtx.clearRect(0, 0, W, H);
  liveCtx.drawImage(koCanvas, 0, 0);
  fs.writeFileSync(path.join(outDir, '10-knockout.png'), live.toBuffer('image/png'));
}

function mirrorBobo(charDir) {
  const dmg = path.join(charDir, 'damage-stages');
  const clown = path.join(charDir, 'bobo-clown-stages');
  fs.mkdirSync(clown, { recursive: true });
  for (const name of fs.readdirSync(dmg)) {
    fs.copyFileSync(path.join(dmg, name), path.join(clown, name));
  }
  fs.copyFileSync(path.join(charDir, 'ooh.png'), path.join(clown, 'ooh.png'));
  fs.copyFileSync(path.join(charDir, 'knockout.png'), path.join(clown, 'knockout-clean.png'));
}

const cleanImg = await loadImage(path.join(CHAR, 'clean.png'));
const cleanCanvas = createCanvas(W, H);
cleanCanvas.getContext('2d').drawImage(cleanImg, 0, 0, W, H);

const koCanvas = paintKoExpression(cleanCanvas);
writePng(path.join(CHAR, 'knockout.png'), koCanvas);
writePng(path.join(ART, 'bozza-ko-from-clean.png'), koCanvas);
await bakeDamage(CHAR, cleanCanvas, koCanvas);
mirrorBobo(CHAR);

// Sanity: mid-face spans should match
function midSpan(file) {
  const ctx = createCanvas(W, H).getContext('2d');
  // sync read via already written file
  return null;
}
console.log('Bozza KO remade from clean (same silhouette, closed eyes + frown)');
