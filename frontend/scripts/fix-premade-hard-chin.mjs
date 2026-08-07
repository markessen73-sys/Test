/**
 * Fix premade boxers:
 *  - hard chin/neck (no bottom fade — fade is upload-only)
 *  - Bozza KO same mid-face size as clean
 *  - King Of The North reprocess without fade (weird chin)
 *
 *   node scripts/fix-premade-hard-chin.mjs
 */
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  W,
  H,
  LM,
  copyImageData,
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
const CHAR_ROOT = path.resolve(__dirname, '../public/faces/characters');
const ART = '/opt/cursor/artifacts/assets';
const HAIR_RGB = [10, 10, 12];
const MARGIN = Math.floor(0.03 * H);

function isYellow(r, g, b, a) {
  return a > 80 && r > 180 && g > 140 && b < 100;
}
function isGreen(r, g, b) {
  return g > 140 && g > r + 40 && g > b + 40;
}

function opaqueBBox(data, { skipYellow = false } = {}) {
  let x0 = W,
    y0 = H,
    x1 = 0,
    y1 = 0,
    n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] <= 40) continue;
      if (skipYellow && isYellow(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      n++;
    }
  }
  return n ? { x0, y0, x1, y1, n } : null;
}

function spanAtY(data, fy, { skipYellow = false } = {}) {
  const y = Math.floor(fy * H);
  let x0 = W;
  let x1 = 0;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (data[i + 3] <= 40) continue;
    if (skipYellow && isYellow(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
  }
  return x0 < x1 ? (x1 - x0) / W : null;
}

function canvasFromData(id) {
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.putImageData(id, 0, 0);
  return ctx.canvas;
}

function writePng(file, canvas) {
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

/**
 * Remove soft bottom fade: content with any alpha becomes fully opaque,
 * weak fringe (<40 or mostly empty neighbors) is cleared. Hard chin edge.
 */
function hardenChin(data) {
  // Pass 1: boost semi-transparent content to full opacity
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a <= 0) continue;
    if (a < 40) {
      data[i + 3] = 0;
      continue;
    }
    // Drop green fringe leftovers (King chroma)
    if (isGreen(data[i], data[i + 1], data[i + 2]) && data[i + 1] > data[i] + 20) {
      data[i + 3] = 0;
      continue;
    }
    data[i + 3] = 255;
  }

  // Pass 2: remove isolated bottom fringe rows that are thin wisps
  const bb = opaqueBBox(data);
  if (!bb) return 0;
  let removed = 0;
  // Walk up from bottom: drop rows whose opaque span is tiny vs face mid
  const midSpan = spanAtY(data, 0.55) || (bb.x1 - bb.x0) / W;
  for (let y = bb.y1; y > bb.y0 + (bb.y1 - bb.y0) * 0.75; y--) {
    let L = null;
    let R = null;
    let n = 0;
    for (let x = bb.x0; x <= bb.x1; x++) {
      if (data[(y * W + x) * 4 + 3] > 40) {
        if (L === null) L = x;
        R = x;
        n++;
      }
    }
    if (L === null) continue;
    const span = (R - L + 1) / W;
    // Thin fade wisps at very bottom
    if (span < midSpan * 0.35 && n < W * 0.08) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (data[i + 3] > 0) {
          data[i + 3] = 0;
          removed++;
        }
      }
    } else {
      break; // hit solid chin
    }
  }
  return removed;
}

/** Fill small interior transparent holes (King chin gap). */
function fillHoles(data) {
  const bb = opaqueBBox(data);
  if (!bb) return 0;
  let n = 0;
  for (let y = bb.y0 + 2; y < bb.y1 - 1; y++) {
    for (let x = bb.x0 + 2; x < bb.x1 - 2; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] > 40) continue;
      let neigh = 0;
      let sr = 0;
      let sg = 0;
      let sb = 0;
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
        if (data[j + 3] > 200) {
          neigh++;
          sr += data[j];
          sg += data[j + 1];
          sb += data[j + 2];
        }
      }
      if (neigh >= 5) {
        data[i] = Math.round(sr / neigh);
        data[i + 1] = Math.round(sg / neigh);
        data[i + 2] = Math.round(sb / neigh);
        data[i + 3] = 255;
        n++;
      }
    }
  }
  return n;
}

function loadRgba(file) {
  return loadImage(file).then((img) => {
    const ctx = createCanvas(W, H).getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    return ctx.getImageData(0, 0, W, H);
  });
}

async function bakeDamage(charDir, cleanCanvas, koCanvas) {
  const liveCtx = createCanvas(W, H).getContext('2d');
  liveCtx.clearRect(0, 0, W, H);
  liveCtx.drawImage(cleanCanvas, 0, 0);
  const clean = liveCtx.getImageData(0, 0, W, H);
  let face = copyImageData(clean);
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
              const nx = x + dx;
              const ny = y + dy;
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
    fs.writeFileSync(path.join(outDir, step.name), liveCtx.canvas.toBuffer('image/png'));
  }
  liveCtx.putImageData(face, 0, 0);
  fs.writeFileSync(path.join(outDir, '09-hold.png'), liveCtx.canvas.toBuffer('image/png'));
  liveCtx.clearRect(0, 0, W, H);
  liveCtx.drawImage(koCanvas, 0, 0);
  fs.writeFileSync(path.join(outDir, '10-knockout.png'), liveCtx.canvas.toBuffer('image/png'));
}

function mirrorBobo(charDir) {
  const dmg = path.join(charDir, 'damage-stages');
  const clown = path.join(charDir, 'bobo-clown-stages');
  fs.mkdirSync(clown, { recursive: true });
  for (const name of fs.readdirSync(dmg)) {
    fs.copyFileSync(path.join(dmg, name), path.join(clown, name));
  }
  for (const name of ['ooh.png', 'knockout.png']) {
    const src = path.join(charDir, name);
    if (fs.existsSync(src)) {
      if (name === 'ooh.png') fs.copyFileSync(src, path.join(clown, 'ooh.png'));
      else fs.copyFileSync(src, path.join(clown, 'knockout-clean.png'));
    }
  }
}

function keyBlack(img) {
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const max = Math.max(d[i], d[i + 1], d[i + 2]);
    const min = Math.min(d[i], d[i + 1], d[i + 2]);
    if (max < 18) d[i + 3] = 0;
    else if (max < 42 && max - min < 12) d[i + 3] = Math.round(((max - 18) / 24) * d[i + 3]);
  }
  ctx.putImageData(id, 0, 0);
  return { canvas: ctx.canvas, data: d, imageData: id };
}

function blackenHair(data) {
  const bb = opaqueBBox(data);
  if (!bb) return;
  const hairY1 = bb.y0 + (bb.y1 - bb.y0) * 0.48;
  for (let y = bb.y0; y <= hairY1; y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 40) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (g > 90 && g > r + 25 && g > b + 25) {
        data[i + 3] = 0;
        continue;
      }
      if (r < 90 && g < 90 && b < 95) {
        data[i] = HAIR_RGB[0];
        data[i + 1] = HAIR_RGB[1];
        data[i + 2] = HAIR_RGB[2];
        data[i + 3] = 255;
      }
    }
  }
}

function prepareKing(img) {
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (isGreen(r, g, b)) {
      d[i + 3] = 0;
      continue;
    }
    if (g > 100 && g > r + 20 && g > b + 20) {
      const t = Math.min(1, (g - Math.max(r, b) - 20) / 80);
      d[i + 3] = Math.round(d[i + 3] * (1 - t));
    }
  }
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 40) continue;
    if (d[i + 1] > 90 && d[i + 1] > d[i] + 25 && d[i + 1] > d[i + 2] + 25) d[i + 3] = 0;
  }
  // strip collar
  const bb = opaqueBBox(d);
  if (bb) {
    const yCut = bb.y0 + (bb.y1 - bb.y0) * 0.82;
    for (let y = Math.floor(yCut); y <= bb.y1; y++) {
      for (let x = bb.x0; x <= bb.x1; x++) {
        const i = (y * W + x) * 4;
        if (d[i + 3] < 40) continue;
        const L = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (L > 160 || (d[i] > 180 && d[i + 1] > 180 && d[i + 2] > 170)) d[i + 3] = 0;
      }
    }
  }
  blackenHair(d);
  fillHoles(d);
  hardenChin(d);
  blackenHair(d);
  fillHoles(d);
  ctx.putImageData(id, 0, 0);
  return { canvas: ctx.canvas, data: d, imageData: id };
}

function alignToClean(prep, cleanData, label, { skipYellow = false } = {}) {
  const cleanBb = opaqueBBox(cleanData);
  const cleanSpan = spanAtY(cleanData, 0.55) || (cleanBb.x1 - cleanBb.x0) / W;
  const bb = opaqueBBox(prep.data, { skipYellow });
  const curSpan =
    spanAtY(prep.data, 0.55, { skipYellow }) || (bb.x1 - bb.x0) / W;
  let scale = cleanSpan / Math.max(0.01, curSpan);

  const srcEyeY = bb.y0 + (bb.y1 - bb.y0) * 0.42;
  const srcMidX = (bb.x0 + bb.x1) / 2;
  const dstEyeY = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
  const dstMidX = (cleanBb.x0 + cleanBb.x1) / 2;

  // Cap so content fits
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
    ctx.drawImage(prep.canvas, 0, 0);
    return ctx.getImageData(0, 0, W, H);
  }

  let tx = dstMidX;
  let ty = dstEyeY;
  let out = draw(scale, tx, ty);
  for (let iter = 0; iter < 14; iter++) {
    const ob = opaqueBBox(out.data);
    if (!ob) break;
    const ok =
      ob.y0 >= MARGIN * 0.5 &&
      ob.y1 <= H - 1 - MARGIN * 0.5 &&
      ob.x0 >= 1 &&
      ob.x1 <= W - 2;
    if (ok) break;
    scale *= 0.96;
    tx = dstMidX;
    ty = dstEyeY;
    out = draw(scale, tx, ty);
    const ob2 = opaqueBBox(out.data);
    if (!ob2) break;
    if (ob2.y0 < MARGIN) ty += MARGIN - ob2.y0;
    if (ob2.y1 > H - 1 - MARGIN) ty -= ob2.y1 - (H - 1 - MARGIN);
    out = draw(scale, tx, ty);
  }
  hardenChin(out.data);
  fillHoles(out.data);
  const mid = spanAtY(out.data, 0.55);
  console.log(label, 'scale', scale.toFixed(3), 'mid', mid?.toFixed(3), 'ratio', (mid / cleanSpan).toFixed(3));
  return { canvas: canvasFromData(out), imageData: out, mid };
}

/** Bozza KO: match clean mid-face span (skip yellow for scale, keep stars). */
function fixBozzaKo(cleanData, cleanCanvas) {
  // Use existing clean as size target; source from v4 art
  return null; // filled in main
}

async function main() {
  const ids = fs.readdirSync(CHAR_ROOT).filter((d) =>
    fs.statSync(path.join(CHAR_ROOT, d)).isDirectory()
  );

  // --- 1) King: reprocess from green sources, no fade ---
  console.log('\n=== King Of The North ===');
  const kingDir = path.join(CHAR_ROOT, 'king-of-the-north');
  const defImg = await loadImage(path.join(CHAR_ROOT, 'default/clean.png'));
  const defCtx = createCanvas(W, H).getContext('2d');
  defCtx.drawImage(defImg, 0, 0, W, H);
  const defData = defCtx.getImageData(0, 0, W, H).data;
  const defSpan = spanAtY(defData, 0.55);
  const defBb = opaqueBBox(defData);

  const kingPreps = {
    clean: prepareKing(await loadImage(path.join(ART, 'king11-clean.png'))),
    ooh: prepareKing(await loadImage(path.join(ART, 'king11-ooh.png'))),
    ko: prepareKing(await loadImage(path.join(ART, 'king11-ko.png'))),
  };

  // Shared scale: Default mid, then shrink until ALL fit with margin
  function kingScale(prep) {
    const bb = opaqueBBox(prep.data);
    const cur = spanAtY(prep.data, 0.55) || (bb.x1 - bb.x0) / W;
    return defSpan / Math.max(0.01, cur);
  }
  let shared = kingScale(kingPreps.clean);
  for (let iter = 0; iter < 40; iter++) {
    let clip = false;
    for (const prep of Object.values(kingPreps)) {
      const bb = opaqueBBox(prep.data);
      const h = (bb.y1 - bb.y0 + 1) * shared;
      const w = (bb.x1 - bb.x0 + 1) * shared;
      if (h > H - 2 * MARGIN || w > W - 2 * MARGIN) {
        clip = true;
        break;
      }
    }
    if (!clip) break;
    shared *= 0.97;
  }
  console.log('king shared scale', shared.toFixed(3));

  const kingOut = {};
  for (const [k, prep] of Object.entries(kingPreps)) {
    const bb = opaqueBBox(prep.data);
    const srcEyeY = bb.y0 + (bb.y1 - bb.y0) * 0.45;
    const srcMidX = (bb.x0 + bb.x1) / 2;
    let tx = (defBb.x0 + defBb.x1) / 2;
    let ty = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
    function draw(s, ox, oy) {
      const ctx = createCanvas(W, H).getContext('2d');
      ctx.clearRect(0, 0, W, H);
      ctx.translate(ox, oy);
      ctx.scale(s, s);
      ctx.translate(-srcMidX, -srcEyeY);
      ctx.drawImage(prep.canvas, 0, 0);
      return ctx.getImageData(0, 0, W, H);
    }
    let out = draw(shared, tx, ty);
    for (let i = 0; i < 10; i++) {
      const ob = opaqueBBox(out.data);
      if (!ob) break;
      if (ob.y0 >= MARGIN && ob.y1 <= H - 1 - MARGIN) break;
      if (ob.y0 < MARGIN) ty += MARGIN - ob.y0;
      if (ob.y1 > H - 1 - MARGIN) ty -= ob.y1 - (H - 1 - MARGIN);
      out = draw(shared, tx, ty);
    }
    blackenHair(out.data);
    fillHoles(out.data);
    hardenChin(out.data);
    blackenHair(out.data);
    fillHoles(out.data);
    hardenChin(out.data);
    const mid = spanAtY(out.data, 0.55);
    const ob = opaqueBBox(out.data);
    console.log(k, 'mid', mid?.toFixed(3), 'top', (ob.y0 / H).toFixed(3), 'bot', ((H - 1 - ob.y1) / H).toFixed(3));
    kingOut[k] = { canvas: canvasFromData(out), imageData: out };
  }
  // Match ooh/ko mid to clean
  const kingCleanMid = spanAtY(kingOut.clean.imageData.data, 0.55);
  for (const k of ['ooh', 'ko']) {
    const cur = spanAtY(kingOut[k].imageData.data, 0.55);
    let factor = kingCleanMid / cur;
    if (Math.abs(factor - 1) < 0.02) continue;
    const eyeX = ((LM.rightEye.x + LM.leftEye.x) / 2) * W;
    const eyeY = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
    for (let i = 0; i < 10; i++) {
      const ctx = createCanvas(W, H).getContext('2d');
      ctx.clearRect(0, 0, W, H);
      ctx.translate(eyeX, eyeY);
      ctx.scale(factor, factor);
      ctx.translate(-eyeX, -eyeY);
      ctx.drawImage(kingOut[k].canvas, 0, 0);
      const out = ctx.getImageData(0, 0, W, H);
      blackenHair(out.data);
      fillHoles(out.data);
      hardenChin(out.data);
      const ob = opaqueBBox(out.data);
      if (ob && ob.y0 >= MARGIN * 0.5 && ob.y1 <= H - 1 - MARGIN * 0.5) {
        kingOut[k] = { canvas: canvasFromData(out), imageData: out };
        console.log(k, 'size-match', factor.toFixed(3));
        break;
      }
      factor *= 0.97;
    }
  }
  writePng(path.join(kingDir, 'clean.png'), kingOut.clean.canvas);
  writePng(path.join(kingDir, 'ooh.png'), kingOut.ooh.canvas);
  writePng(path.join(kingDir, 'knockout.png'), kingOut.ko.canvas);
  writePng(path.join(ART, 'king-hardchin-clean.png'), kingOut.clean.canvas);
  writePng(path.join(ART, 'king-hardchin-ooh.png'), kingOut.ooh.canvas);
  await bakeDamage(kingDir, kingOut.clean.canvas, kingOut.ko.canvas);
  mirrorBobo(kingDir);

  // --- 2) Bozza KO: match clean size ---
  console.log('\n=== Bozza KO ===');
  const bozzaDir = path.join(CHAR_ROOT, 'bozza');
  const bozzaClean = await loadRgba(path.join(bozzaDir, 'clean.png'));
  hardenChin(bozzaClean.data);
  fillHoles(bozzaClean.data);
  const bozzaCleanCanvas = canvasFromData(bozzaClean);
  writePng(path.join(bozzaDir, 'clean.png'), bozzaCleanCanvas);

  // Also harden bozza ooh
  const bozzaOoh = await loadRgba(path.join(bozzaDir, 'ooh.png'));
  hardenChin(bozzaOoh.data);
  writePng(path.join(bozzaDir, 'ooh.png'), canvasFromData(bozzaOoh));

  const koSrc = keyBlack(await loadImage(path.join(ART, 'bozza-knockout-v4.png')));
  hardenChin(koSrc.data);
  const cleanSpan = spanAtY(bozzaClean.data, 0.55);
  const cleanBb = opaqueBBox(bozzaClean.data);
  // Measure KO face without yellow for scale target matching clean span
  const faceBb = opaqueBBox(koSrc.data, { skipYellow: true });
  const koFaceSpan =
    spanAtY(koSrc.data, 0.55, { skipYellow: true }) || (faceBb.x1 - faceBb.x0) / W;
  let scale = cleanSpan / Math.max(0.05, koFaceSpan);
  const maxFace = Math.min(
    (H - 2 * MARGIN) / (faceBb.y1 - faceBb.y0 + 1),
    (W - 2 * MARGIN) / (faceBb.x1 - faceBb.x0 + 1)
  );
  // Prefer matching clean size; allow mild star clip
  if (scale > maxFace * 1.05) {
    console.log('bozza ko scale', scale.toFixed(3), 'capped near', maxFace.toFixed(3));
    scale = maxFace * 1.02;
  }
  const srcEyeY = faceBb.y0 + (faceBb.y1 - faceBb.y0) * 0.38;
  const srcMidX = (faceBb.x0 + faceBb.x1) / 2;
  let tx = (cleanBb.x0 + cleanBb.x1) / 2;
  let ty = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;

  function drawKo(s, ox, oy) {
    const ctx = createCanvas(W, H).getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    ctx.translate(-srcMidX, -srcEyeY);
    ctx.drawImage(koSrc.canvas, 0, 0);
    return ctx.getImageData(0, 0, W, H);
  }

  let koOut = drawKo(scale, tx, ty);
  for (let iter = 0; iter < 16; iter++) {
    const fb = opaqueBBox(koOut.data, { skipYellow: true });
    if (!fb) break;
    let changed = false;
    if (fb.y0 < MARGIN) {
      ty += MARGIN - fb.y0;
      changed = true;
    }
    if (fb.y1 > H - 1 - MARGIN) {
      ty -= fb.y1 - (H - 1 - MARGIN);
      changed = true;
    }
    // Match mid span to clean — nudge scale if still small
    const span = spanAtY(koOut.data, 0.55, { skipYellow: true });
    const ratio = span / cleanSpan;
    if (ratio < 0.95 && scale < maxFace * 1.08) {
      scale *= 1.04;
      changed = true;
    }
    if (fb.y1 - fb.y0 + 1 > H - 2 * MARGIN) {
      scale *= 0.97;
      changed = true;
    }
    if (!changed) break;
    koOut = drawKo(scale, tx, ty);
  }
  hardenChin(koOut.data);
  fillHoles(koOut.data);
  const koSpan = spanAtY(koOut.data, 0.55, { skipYellow: true });
  const koFull = spanAtY(koOut.data, 0.55);
  console.log(
    'bozza ko scale',
    scale.toFixed(3),
    'faceSpan',
    koSpan?.toFixed(3),
    'fullSpan',
    koFull?.toFixed(3),
    'vs clean',
    cleanSpan?.toFixed(3),
    'ratio',
    (koSpan / cleanSpan).toFixed(3)
  );
  const koCanvas = canvasFromData(koOut);
  writePng(path.join(bozzaDir, 'knockout.png'), koCanvas);
  writePng(path.join(ART, 'bozza-ko-matched.png'), koCanvas);
  await bakeDamage(bozzaDir, bozzaCleanCanvas, koCanvas);
  mirrorBobo(bozzaDir);

  // --- 3) Harden chin on all other premade packs ---
  console.log('\n=== Harden all premade ===');
  const STANDARD_BOBO = new Set(['king-of-the-north', 'bozza', 'the-nige', 'the-greenie']);
  for (const id of ids) {
    if (id === 'king-of-the-north') continue; // already done
    const dir = path.join(CHAR_ROOT, id);
    let changed = false;
    const faces = {};
    for (const name of ['clean.png', 'ooh.png', 'knockout.png']) {
      const fp = path.join(dir, name);
      if (!fs.existsSync(fp)) continue;
      const idata = await loadRgba(fp);
      const before = opaqueBBox(idata.data);
      hardenChin(idata.data);
      fillHoles(idata.data);
      hardenChin(idata.data);
      const after = opaqueBBox(idata.data);
      writePng(fp, canvasFromData(idata));
      faces[name] = canvasFromData(idata);
      changed = true;
      console.log(
        id,
        name,
        'bot',
        before ? ((H - 1 - before.y1) / H).toFixed(3) : '?',
        '→',
        after ? ((H - 1 - after.y1) / H).toFixed(3) : '?'
      );
    }
    if (changed && faces['clean.png'] && faces['knockout.png']) {
      await bakeDamage(dir, faces['clean.png'], faces['knockout.png']);
      // Only Parliament / standard-bobo packs mirror faces into bobo-clown-stages.
      if (STANDARD_BOBO.has(id)) mirrorBobo(dir);
    }
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
