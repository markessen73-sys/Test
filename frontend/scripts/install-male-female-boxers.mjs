/**
 * Install original male + female boxer faces as selectable character packs.
 * Builds ooh/KO from each clean template, matches Default mid-face size,
 * bakes damage stages, mirrors into bobo-clown-stages.
 *
 *   node scripts/install-male-female-boxers.mjs
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
const FACES = path.resolve(__dirname, '../public/faces');
const CHAR_ROOT = path.join(FACES, 'characters');
const MARGIN = 24;

const PACKS = [
  {
    id: 'male-boxer',
    src: path.join(FACES, 'test-template-face-male.png'),
  },
  {
    id: 'female-boxer',
    src: path.join(FACES, 'test-template-face-female.png'),
  },
];

function writePng(file, canvas) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

function opaqueBBox(data) {
  let x0 = W,
    y0 = H,
    x1 = 0,
    y1 = 0,
    n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 40) continue;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return n ? { x0, y0, x1, y1 } : null;
}

function spanAtY(data, yFrac) {
  const y = Math.floor(yFrac * H);
  let L = null,
    R = null;
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 40) {
      if (L === null) L = x;
      R = x;
    }
  }
  return L === null ? null : (R - L + 1) / W;
}

function hardenAlpha(data) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0 && data[i + 3] < 40) data[i + 3] = 0;
    else if (data[i + 3] >= 40) data[i + 3] = 255;
  }
}

function keyNearBlack(img) {
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const max = Math.max(d[i], d[i + 1], d[i + 2]);
    const min = Math.min(d[i], d[i + 1], d[i + 2]);
    if (max < 14) d[i + 3] = 0;
    else if (max < 36 && max - min < 10) d[i + 3] = Math.round(((max - 14) / 22) * d[i + 3]);
  }
  hardenAlpha(d);
  ctx.putImageData(id, 0, 0);
  return { canvas: ctx.canvas, data: d, imageData: id };
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

function isSkinish(r, g, b) {
  return r > 90 && g > 50 && b > 35 && r >= g - 15 && r > b;
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
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < 40) continue;
      const edge = Math.max(0, 1 - d2);
      const t = Math.min(1, alpha * (0.55 + 0.45 * edge));
      data[i] = Math.round(data[i] * (1 - t) + rgb[0] * t);
      data[i + 1] = Math.round(data[i + 1] * (1 - t) + rgb[1] * t);
      data[i + 2] = Math.round(data[i + 2] * (1 - t) + rgb[2] * t);
    }
  }
}

function paintOoh(cleanCanvas) {
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.drawImage(cleanCanvas, 0, 0);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  const skin =
    sampleAround(d, LM.nose.x * W, (LM.nose.y + 0.05) * H, 30, isSkinish) || [210, 160, 130];
  const lip = [
    Math.min(255, skin[0] + 20),
    Math.max(40, skin[1] - 30),
    Math.max(40, skin[2] - 20),
  ];
  // Cover smile, open "O" mouth
  fillEllipse(d, LM.mouth.x * W, LM.mouth.y * H, 0.11 * W, 0.09 * H, skin, 0.95);
  ctx.putImageData(id, 0, 0);
  ctx.fillStyle = `rgb(${lip.join(',')})`;
  ctx.beginPath();
  ctx.ellipse(LM.mouth.x * W, LM.mouth.y * H + 4, 0.07 * W, 0.085 * H, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a0c08';
  ctx.beginPath();
  ctx.ellipse(LM.mouth.x * W, LM.mouth.y * H + 6, 0.045 * W, 0.06 * H, 0, 0, Math.PI * 2);
  ctx.fill();
  // Slight brow lift via thin highlight lines
  ctx.strokeStyle = `rgba(${Math.min(255, skin[0] + 30)},${Math.min(255, skin[1] + 20)},${Math.min(255, skin[2] + 10)},0.55)`;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const eye of [LM.rightEye, LM.leftEye]) {
    ctx.beginPath();
    ctx.moveTo(eye.x * W - 28, eye.y * H - 42);
    ctx.quadraticCurveTo(eye.x * W, eye.y * H - 58, eye.x * W + 28, eye.y * H - 42);
    ctx.stroke();
  }
  return ctx.canvas;
}

function paintKo(cleanCanvas) {
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.drawImage(cleanCanvas, 0, 0);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  const skin =
    sampleAround(d, LM.nose.x * W, (LM.nose.y + 0.05) * H, 30, isSkinish) || [210, 160, 130];
  const lid = [Math.min(255, skin[0] + 6), Math.min(255, skin[1] + 2), skin[2]];
  const line = [42, 26, 20];
  for (const eye of [LM.rightEye, LM.leftEye]) {
    fillEllipse(d, eye.x * W, eye.y * H, 0.065 * W, 0.045 * H, lid, 0.97);
    fillEllipse(d, eye.x * W, eye.y * H + 2, 0.055 * W, 0.032 * H, lid, 0.9);
  }
  fillEllipse(d, LM.mouth.x * W, LM.mouth.y * H, 0.13 * W, 0.08 * H, skin, 0.96);
  ctx.putImageData(id, 0, 0);
  ctx.strokeStyle = `rgb(${line.join(',')})`;
  ctx.lineCap = 'round';
  for (const eye of [LM.rightEye, LM.leftEye]) {
    const cx = eye.x * W;
    const cy = eye.y * H;
    const hw = 0.045 * W;
    ctx.lineWidth = Math.max(4, hw * 0.14);
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy);
    ctx.quadraticCurveTo(cx, cy + hw * 0.4, cx + hw, cy);
    ctx.stroke();
  }
  ctx.lineWidth = Math.max(5, 0.09 * W * 0.12);
  ctx.beginPath();
  ctx.moveTo(LM.mouth.x * W - 0.085 * W, LM.mouth.y * H - 4);
  ctx.quadraticCurveTo(LM.mouth.x * W, LM.mouth.y * H + 28, LM.mouth.x * W + 0.085 * W, LM.mouth.y * H - 4);
  ctx.stroke();
  return ctx.canvas;
}

function alignToDefault(srcCanvas, srcData, defSpan, defBb, label) {
  const bb = opaqueBBox(srcData);
  if (!bb) throw new Error(`${label}: empty`);
  const curSpan = spanAtY(srcData, 0.55) || (bb.x1 - bb.x0) / W;
  let scale = defSpan / Math.max(0.01, curSpan);
  const srcEyeY = bb.y0 + (bb.y1 - bb.y0) * 0.42;
  const srcMidX = (bb.x0 + bb.x1) / 2;
  const dstEyeY = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
  const dstMidX = (defBb.x0 + defBb.x1) / 2;

  const maxFit = Math.min(
    (H - 2 * MARGIN) / Math.max(1, bb.y1 - bb.y0 + 1),
    (W - 2 * MARGIN) / Math.max(1, bb.x1 - bb.x0 + 1)
  );
  if (scale > maxFit) scale = maxFit;

  function draw(s, tx, ty) {
    const ctx = createCanvas(W, H).getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.translate(tx, ty);
    ctx.scale(s, s);
    ctx.translate(-srcMidX, -srcEyeY);
    ctx.drawImage(srcCanvas, 0, 0);
    return ctx.getImageData(0, 0, W, H);
  }

  let tx = dstMidX;
  let ty = dstEyeY;
  let out = draw(scale, tx, ty);
  for (let iter = 0; iter < 16; iter++) {
    const ob = opaqueBBox(out.data);
    if (!ob) break;
    let changed = false;
    if (ob.y0 < MARGIN) {
      ty += MARGIN - ob.y0;
      changed = true;
    }
    if (ob.y1 > H - 1 - MARGIN) {
      ty -= ob.y1 - (H - 1 - MARGIN);
      changed = true;
    }
    if (ob.y1 - ob.y0 + 1 > H - 2 * MARGIN || ob.x1 - ob.x0 + 1 > W - 2 * MARGIN) {
      scale *= 0.97;
      changed = true;
    }
    if (!changed) break;
    out = draw(scale, tx, ty);
  }
  hardenAlpha(out.data);
  const mid = spanAtY(out.data, 0.55);
  console.log(label, 'scale', scale.toFixed(3), 'mid', mid?.toFixed(3), 'ratio', (mid / defSpan).toFixed(3));
  const canvas = createCanvas(W, H);
  canvas.getContext('2d').putImageData(out, 0, 0);
  return { canvas, imageData: out, mid };
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

const defImg = await loadImage(path.join(CHAR_ROOT, 'default/clean.png'));
const defCtx = createCanvas(W, H).getContext('2d');
defCtx.drawImage(defImg, 0, 0, W, H);
const defData = defCtx.getImageData(0, 0, W, H).data;
const defSpan = spanAtY(defData, 0.55);
const defBb = opaqueBBox(defData);

for (const pack of PACKS) {
  console.log('\n===', pack.id, '===');
  const dir = path.join(CHAR_ROOT, pack.id);
  fs.mkdirSync(dir, { recursive: true });

  const keyed = keyNearBlack(await loadImage(pack.src));
  const cleanAligned = alignToDefault(keyed.canvas, keyed.data, defSpan, defBb, `${pack.id}-clean`);
  writePng(path.join(dir, 'clean.png'), cleanAligned.canvas);

  const oohRaw = paintOoh(cleanAligned.canvas);
  // Prefer clean silhouette for ooh/KO on these 3D templates — LM paint
  // patches don't blend. Runtime still adds orbiting KO stars.
  writePng(path.join(dir, 'ooh.png'), cleanAligned.canvas);
  writePng(path.join(dir, 'knockout.png'), cleanAligned.canvas);

  await bakeDamage(dir, cleanAligned.canvas, cleanAligned.canvas);
  mirrorBobo(dir);
  console.log('wrote', dir);
}

console.log('\nDone — register male-boxer and female-boxer in characters.ts');
