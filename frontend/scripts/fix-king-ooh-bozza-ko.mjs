/**
 * Fix King ooh top/bottom clipping + Bozza KO tiny face.
 *
 * King: re-key ooh/ko from green art, align like clean, then uniform shrink
 * so full head keeps ≥3.5% top/bottom margin.
 *
 * Bozza KO: key black, measure mid-face skipping yellow stars, scale face to
 * match clean mid-face + eye Y, then fit stars within canvas if needed.
 *
 *   node scripts/fix-king-ooh-bozza-ko.mjs
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
const MARGIN = Math.floor(0.035 * H);
const HAIR_RGB = [10, 10, 12];

function isGreen(r, g, b) {
  return g > 140 && g > r + 40 && g > b + 40;
}

function isYellowStar(r, g, b, a) {
  return a > 80 && r > 180 && g > 140 && b < 100;
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
      if (skipYellow && isYellowStar(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
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
    if (skipYellow && isYellowStar(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
  }
  return x0 < x1 ? (x1 - x0) / W : null;
}

/** Mid-face width from skin-ish pixels (excludes yellow KO stars). */
function faceMidSpan(data, bb) {
  if (!bb) return null;
  const y0 = Math.floor(bb.y0 + (bb.y1 - bb.y0) * 0.35);
  const y1 = Math.floor(bb.y0 + (bb.y1 - bb.y0) * 0.65);
  let best = 0;
  for (let y = y0; y <= y1; y++) {
    let L = null;
    let R = null;
    for (let x = bb.x0; x <= bb.x1; x++) {
      const i = (y * W + x) * 4;
      const a = data[i + 3];
      if (a <= 40) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isYellowStar(r, g, b, a)) continue;
      // Prefer face/skin/hair (not pure black bg remnants)
      const skinish =
        (r > 90 && g > 50 && b > 35 && r > b + 5) ||
        (r > 60 && g > 40 && b > 30 && Math.max(r, g, b) - Math.min(r, g, b) < 60);
      const hairish = r > 140 && g > 120 && b < 90; // blonde hair ok for span
      if (!skinish && !hairish && !(r < 80 && g < 80 && b < 80 && a > 200)) continue;
      if (L === null) L = x;
      R = x;
    }
    if (L !== null) best = Math.max(best, (R - L + 1) / W);
  }
  return best || null;
}

function canvasFromData(id) {
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.putImageData(id, 0, 0);
  return ctx.canvas;
}

function writePng(file, canvas) {
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

function softNeckFade(data) {
  const bb = opaqueBBox(data);
  if (!bb) return;
  const chinY = bb.y0 + (bb.y1 - bb.y0) * 0.92;
  const fadeEnd = Math.min(H - 1, bb.y1 + 4);
  for (let y = Math.floor(chinY); y < H; y++) {
    const t = y >= fadeEnd ? 0 : 1 - (y - chinY) / Math.max(1, fadeEnd - chinY);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      data[i + 3] = Math.round(data[i + 3] * Math.max(0, t));
    }
  }
}

function removeSpeckles(data) {
  const visited = new Uint8Array(W * H);
  const sizes = [];
  function flood(sx, sy, id) {
    const stack = [[sx, sy]];
    let n = 0;
    visited[sy * W + sx] = id;
    while (stack.length) {
      const [x, y] = stack.pop();
      n++;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const idx = ny * W + nx;
        if (visited[idx] || data[idx * 4 + 3] <= 40) continue;
        visited[idx] = id;
        stack.push([nx, ny]);
      }
    }
    return n;
  }
  let next = 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (visited[idx] || data[idx * 4 + 3] <= 40) continue;
      if (next > 250) break;
      sizes[next] = flood(x, y, next);
      next++;
    }
  }
  let mainId = 1;
  let mainN = 0;
  for (let id = 1; id < next; id++) {
    if ((sizes[id] || 0) > mainN) {
      mainN = sizes[id];
      mainId = id;
    }
  }
  for (let i = 0; i < W * H; i++) {
    const id = visited[i];
    if (id && id !== mainId && sizes[id] < mainN * 0.02) data[i * 4 + 3] = 0;
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
  return { canvas: ctx.canvas, data: id.data, imageData: id };
}

function keyGreen(img) {
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
  ctx.putImageData(id, 0, 0);
  return { canvas: ctx.canvas, data: id.data, imageData: id };
}

function blackenHair(data) {
  let n = 0;
  const bb = opaqueBBox(data);
  if (!bb) return 0;
  const hairY1 = bb.y0 + (bb.y1 - bb.y0) * 0.48;
  for (let y = bb.y0; y <= hairY1; y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 40) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // residual green
      if (g > 90 && g > r + 25 && g > b + 25) {
        data[i + 3] = 0;
        n++;
        continue;
      }
      const dark = r < 90 && g < 90 && b < 95;
      const nearBlack = r < 55 && g < 55 && b < 55;
      if (dark || nearBlack) {
        data[i] = HAIR_RGB[0];
        data[i + 1] = HAIR_RGB[1];
        data[i + 2] = HAIR_RGB[2];
        data[i + 3] = 255;
        n++;
      }
    }
  }
  return n;
}

function stripCollar(data) {
  const bb = opaqueBBox(data);
  if (!bb) return 0;
  const yCut = bb.y0 + (bb.y1 - bb.y0) * 0.82;
  let n = 0;
  for (let y = Math.floor(yCut); y <= bb.y1; y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 40) continue;
      const L = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (L > 160 || (data[i] > 180 && data[i + 1] > 180 && data[i + 2] > 170)) {
        data[i + 3] = 0;
        n++;
      }
    }
  }
  return n;
}

function fillInteriorHoles(data) {
  const bb = opaqueBBox(data);
  if (!bb) return 0;
  let n = 0;
  for (let y = bb.y0 + 2; y < bb.y1 - 2; y++) {
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
        if (data[j + 3] > 40) {
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

function prepareKing(img, label) {
  const keyed = keyGreen(img);
  for (let i = 0; i < keyed.data.length; i += 4) {
    if (keyed.data[i + 3] < 40) continue;
    const r = keyed.data[i];
    const g = keyed.data[i + 1];
    const b = keyed.data[i + 2];
    if (g > 90 && g > r + 25 && g > b + 25) keyed.data[i + 3] = 0;
  }
  stripCollar(keyed.data);
  blackenHair(keyed.data);
  fillInteriorHoles(keyed.data);
  softNeckFade(keyed.data);
  removeSpeckles(keyed.data);
  blackenHair(keyed.data);
  console.log(label, 'prepared', opaqueBBox(keyed.data));
  return { canvas: canvasFromData(keyed.imageData), data: keyed.data, imageData: keyed.imageData };
}

function eyeBandY(bb, t = 0.42) {
  return bb.y0 + (bb.y1 - bb.y0) * t;
}

/**
 * Place canvas so mid-face matches targetMid, eye band on LM Y, then shrink
 * until opaque content fits with MARGIN on all sides.
 */
function alignFit(srcCanvas, srcData, opts) {
  const {
    label,
    targetMid,
    eyeBandT = 0.42,
    skipYellow = false,
    useFaceMid = false,
    preferKeepStars = false,
  } = opts;

  const bb = opaqueBBox(srcData, { skipYellow });
  if (!bb) throw new Error(`${label}: empty`);

  let curMid = useFaceMid
    ? faceMidSpan(srcData, opaqueBBox(srcData, { skipYellow: true })) ||
      spanAtY(srcData, 0.55, { skipYellow: true })
    : spanAtY(srcData, 0.55, { skipYellow }) || (bb.x1 - bb.x0) / W;

  let scale = targetMid / Math.max(0.01, curMid);
  const srcEyeY = eyeBandY(bb, eyeBandT);
  const srcMidX = (bb.x0 + bb.x1) / 2;
  const dstEyeY = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
  const dstMidX = W / 2;

  function draw(s, tx, ty) {
    const ctx = createCanvas(W, H).getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.translate(tx, ty);
    ctx.scale(s, s);
    ctx.translate(-srcMidX, -srcEyeY);
    ctx.drawImage(srcCanvas, 0, 0);
    return ctx.getImageData(0, 0, W, H);
  }

  // Cap scale so full content can fit
  const contentH = bb.y1 - bb.y0 + 1;
  const contentW = bb.x1 - bb.x0 + 1;
  const maxScale = Math.min((H - 2 * MARGIN) / contentH, (W - 2 * MARGIN) / contentW);
  if (!preferKeepStars && scale > maxScale) {
    console.log(label, `scale ${scale.toFixed(3)} capped to ${maxScale.toFixed(3)}`);
    scale = maxScale;
  }

  let out = draw(scale, dstMidX, dstEyeY);
  let outBb = opaqueBBox(out.data);

  // Iteratively shrink + nudge until margins OK
  for (let iter = 0; iter < 16; iter++) {
    outBb = opaqueBBox(out.data);
    if (!outBb) break;
    const topGap = outBb.y0;
    const botGap = H - 1 - outBb.y1;
    const leftGap = outBb.x0;
    const rightGap = W - 1 - outBb.x1;
    const clipped =
      topGap < MARGIN || botGap < MARGIN || leftGap < MARGIN * 0.5 || rightGap < MARGIN * 0.5;
    if (!clipped) break;

    // Prefer shrink about eye mid when clipping
    scale *= 0.94;
    let ty = dstEyeY;
    let tx = dstMidX;
    out = draw(scale, tx, ty);
    outBb = opaqueBBox(out.data);
    if (!outBb) break;
    // Nudge into frame
    if (outBb.y0 < MARGIN) ty += MARGIN - outBb.y0;
    if (outBb.y1 > H - 1 - MARGIN) ty -= outBb.y1 - (H - 1 - MARGIN);
    if (outBb.x0 < MARGIN) tx += MARGIN - outBb.x0;
    if (outBb.x1 > W - 1 - MARGIN) tx -= outBb.x1 - (W - 1 - MARGIN);
    out = draw(scale, tx, ty);
  }

  softNeckFade(out.data);
  removeSpeckles(out.data);
  outBb = opaqueBBox(out.data);
  const mid =
    (useFaceMid
      ? faceMidSpan(out.data, opaqueBBox(out.data, { skipYellow: true }))
      : spanAtY(out.data, 0.55, { skipYellow })) || 0;
  console.log(
    label,
    'scale',
    scale.toFixed(3),
    'mid',
    mid.toFixed(3),
    'top',
    outBb ? (outBb.y0 / H).toFixed(3) : '?',
    'bot',
    outBb ? ((H - 1 - outBb.y1) / H).toFixed(3) : '?'
  );
  return { canvas: canvasFromData(out), imageData: out, mid, scale };
}

/**
 * For Bozza KO: scale face to match clean size aggressively; allow mild star
 * clipping rather than leaving a tiny face.
 */
function alignBozzaKo(srcCanvas, srcData, cleanMid, cleanBb) {
  const faceBb = opaqueBBox(srcData, { skipYellow: true });
  if (!faceBb) throw new Error('bozza ko: no face');
  const curMid =
    faceMidSpan(srcData, faceBb) || spanAtY(srcData, 0.55, { skipYellow: true }) || 0.3;
  let scale = cleanMid / Math.max(0.05, curMid);

  // Allow stars to clip a bit — keep face large. Cap only if face itself would clip.
  const faceH = faceBb.y1 - faceBb.y0 + 1;
  const faceW = faceBb.x1 - faceBb.x0 + 1;
  const maxFaceScale = Math.min((H - 2 * MARGIN) / faceH, (W - 2 * MARGIN) / faceW);
  if (scale > maxFaceScale) {
    console.log('bozza-ko face scale', scale.toFixed(3), '→', maxFaceScale.toFixed(3));
    scale = maxFaceScale;
  }

  const srcEyeY = eyeBandY(faceBb, 0.4);
  const srcMidX = (faceBb.x0 + faceBb.x1) / 2;
  const dstEyeY = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
  // Match clean horizontal center
  const dstMidX = (cleanBb.x0 + cleanBb.x1) / 2;

  function draw(s, tx, ty) {
    const ctx = createCanvas(W, H).getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.translate(tx, ty);
    ctx.scale(s, s);
    ctx.translate(-srcMidX, -srcEyeY);
    ctx.drawImage(srcCanvas, 0, 0);
    return ctx.getImageData(0, 0, W, H);
  }

  let out = draw(scale, dstMidX, dstEyeY);
  // Nudge so face bbox has top margin (stars may still clip top — OK)
  for (let iter = 0; iter < 10; iter++) {
    const fb = opaqueBBox(out.data, { skipYellow: true });
    if (!fb) break;
    let ty = dstEyeY;
    let tx = dstMidX;
    let moved = false;
    if (fb.y0 < MARGIN) {
      ty += MARGIN - fb.y0;
      moved = true;
    }
    if (fb.y1 > H - 1 - MARGIN) {
      ty -= fb.y1 - (H - 1 - MARGIN);
      moved = true;
    }
    if (fb.x0 < MARGIN * 0.5) {
      tx += MARGIN * 0.5 - fb.x0;
      moved = true;
    }
    if (fb.x1 > W - 1 - MARGIN * 0.5) {
      tx -= fb.x1 - (W - 1 - MARGIN * 0.5);
      moved = true;
    }
    // If face still too tall after nudge, shrink slightly
    if (fb.y1 - fb.y0 + 1 > H - 2 * MARGIN) {
      scale *= 0.96;
      moved = true;
    }
    if (!moved) break;
    out = draw(scale, tx, ty);
  }

  softNeckFade(out.data);
  removeSpeckles(out.data);
  const fb = opaqueBBox(out.data, { skipYellow: true });
  const mid = faceMidSpan(out.data, fb) || 0;
  const full = opaqueBBox(out.data);
  console.log(
    'bozza-ko',
    'scale',
    scale.toFixed(3),
    'faceMid',
    mid.toFixed(3),
    'faceTop',
    fb ? (fb.y0 / H).toFixed(3) : '?',
    'fullTop',
    full ? (full.y0 / H).toFixed(3) : '?'
  );
  return { canvas: canvasFromData(out), imageData: out, mid, scale };
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

function mirrorBobo(charDir, oohCanvas, koCanvas) {
  const dmg = path.join(charDir, 'damage-stages');
  const clown = path.join(charDir, 'bobo-clown-stages');
  fs.mkdirSync(clown, { recursive: true });
  for (const name of fs.readdirSync(dmg)) {
    fs.copyFileSync(path.join(dmg, name), path.join(clown, name));
  }
  writePng(path.join(clown, 'ooh.png'), oohCanvas);
  writePng(path.join(clown, 'knockout-clean.png'), koCanvas);
  // Also keep root ooh mirrored into clown stages if used
  if (fs.existsSync(path.join(charDir, 'ooh.png'))) {
    fs.copyFileSync(path.join(charDir, 'ooh.png'), path.join(clown, 'ooh.png'));
  }
}

function loadCanvas(file) {
  return loadImage(file).then((img) => {
    const ctx = createCanvas(W, H).getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    return { canvas: ctx.canvas, data: ctx.getImageData(0, 0, W, H).data, imageData: ctx.getImageData(0, 0, W, H) };
  });
}

// --- King ---
const kingDir = path.join(CHAR_ROOT, 'king-of-the-north');
const kingClean = await loadCanvas(path.join(kingDir, 'clean.png'));
const kingCleanMid = spanAtY(kingClean.data, 0.55);
const kingCleanBb = opaqueBBox(kingClean.data);
console.log('king clean mid', kingCleanMid?.toFixed(3), 'top', (kingCleanBb.y0 / H).toFixed(3));

const kingOohPrep = prepareKing(await loadImage(path.join(ART, 'king11-ooh.png')), 'king-ooh');
const kingKoPrep = prepareKing(await loadImage(path.join(ART, 'king11-ko.png')), 'king-ko');

const kingOoh = alignFit(kingOohPrep.canvas, kingOohPrep.data, {
  label: 'king-ooh',
  targetMid: kingCleanMid,
  eyeBandT: 0.45,
});
blackenHair(kingOoh.imageData.data);
fillInteriorHoles(kingOoh.imageData.data);
blackenHair(kingOoh.imageData.data);

const kingKo = alignFit(kingKoPrep.canvas, kingKoPrep.data, {
  label: 'king-ko',
  targetMid: kingCleanMid,
  eyeBandT: 0.45,
  skipYellow: true,
});
blackenHair(kingKo.imageData.data);
fillInteriorHoles(kingKo.imageData.data);
blackenHair(kingKo.imageData.data);

writePng(path.join(kingDir, 'ooh.png'), canvasFromData(kingOoh.imageData));
writePng(path.join(kingDir, 'knockout.png'), canvasFromData(kingKo.imageData));
writePng(path.join(ART, 'king-ooh-fixed.png'), canvasFromData(kingOoh.imageData));
writePng(path.join(ART, 'king-ko-fixed.png'), canvasFromData(kingKo.imageData));
await bakeDamage(kingDir, kingClean.canvas, canvasFromData(kingKo.imageData));
mirrorBobo(kingDir, canvasFromData(kingOoh.imageData), canvasFromData(kingKo.imageData));

// --- Bozza ---
const bozzaDir = path.join(CHAR_ROOT, 'bozza');
const bozzaClean = await loadCanvas(path.join(bozzaDir, 'clean.png'));
const bozzaCleanBb = opaqueBBox(bozzaClean.data);
const bozzaCleanMid =
  faceMidSpan(bozzaClean.data, bozzaCleanBb) || spanAtY(bozzaClean.data, 0.55);
console.log('bozza clean mid', bozzaCleanMid?.toFixed(3));

const bozzaKoSrc = keyBlack(await loadImage(path.join(ART, 'bozza-knockout-v4.png')));
removeSpeckles(bozzaKoSrc.data);
const bozzaKo = alignBozzaKo(bozzaKoSrc.canvas, bozzaKoSrc.data, bozzaCleanMid, bozzaCleanBb);
writePng(path.join(bozzaDir, 'knockout.png'), canvasFromData(bozzaKo.imageData));
writePng(path.join(ART, 'bozza-ko-fixed.png'), canvasFromData(bozzaKo.imageData));

const bozzaOoh = await loadCanvas(path.join(bozzaDir, 'ooh.png'));
await bakeDamage(bozzaDir, bozzaClean.canvas, canvasFromData(bozzaKo.imageData));
mirrorBobo(bozzaDir, bozzaOoh.canvas, canvasFromData(bozzaKo.imageData));

console.log('Done.');
