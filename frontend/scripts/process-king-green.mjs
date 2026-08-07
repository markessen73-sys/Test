/**
 * Process King Of The North from green-screen Punch-Out art:
 * chroma-key green, force jet-black hair, fill interior holes, no collar,
 * then Default-size LM align + damage bake.
 *
 *   node scripts/process-king-green.mjs
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
const CHAR = path.resolve(__dirname, '../public/faces/characters/king-of-the-north');
const ART = {
  clean: '/opt/cursor/artifacts/assets/king11-clean.png',
  ooh: '/opt/cursor/artifacts/assets/king11-ooh.png',
  knockout: '/opt/cursor/artifacts/assets/king11-ko.png',
};

const HAIR_RGB = [10, 10, 12];
const TARGET_MIDFACE_RATIO = 1.0;
const EYE_BAND_T = 0.45;

function isGreen(r, g, b) {
  // Lime chroma key — strong G, low R/B.
  return g > 140 && g > r + 40 && g > b + 40;
}

function isSkin(r, g, b) {
  return r > 140 && g > 90 && b > 60 && r >= g && g >= b - 20 && r - b > 30;
}

function isGlassesFrame(r, g, b, a) {
  return a > 200 && Math.max(r, g, b) < 48 && Math.max(r, g, b) - Math.min(r, g, b) < 25;
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
      if (skipYellow && data[i] > 200 && data[i + 1] > 180 && data[i + 2] < 120) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      n++;
    }
  }
  return n ? { x0, y0, x1, y1, n } : null;
}

function spanAtY(data, fy) {
  const y = Math.floor(fy * H);
  let x0 = W;
  let x1 = 0;
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 40) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
    }
  }
  return x0 < x1 ? (x1 - x0) / W : null;
}

/** Green → alpha, soft edge. */
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
    // Soft fringe: greenish anti-alias near key.
    if (g > 100 && g > r + 20 && g > b + 20) {
      const t = Math.min(1, (g - Math.max(r, b) - 20) / 80);
      d[i + 3] = Math.round(d[i + 3] * (1 - t));
    }
  }
  ctx.putImageData(id, 0, 0);
  return { canvas: ctx.canvas, data: id.data, imageData: id };
}

/** Remove white/light collar leftovers in the lower neck band. */
function stripCollar(data) {
  const bb = opaqueBBox(data);
  if (!bb) return 0;
  const yCut = bb.y0 + (bb.y1 - bb.y0) * 0.82;
  let n = 0;
  for (let y = Math.floor(yCut); y <= bb.y1; y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 40) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // White / light-blue shirt & zipper metal.
      const bright = Math.min(r, g, b) > 170 || (r > 190 && g > 190 && b > 160);
      const coolWhite = r > 160 && g > 170 && b > 180 && b >= r - 10;
      if (bright || coolWhite) {
        data[i + 3] = 0;
        n++;
      }
    }
  }
  return n;
}

/** Force jet-black hair in the crown / temple region (not skin, not glasses). */
function blackenHair(data) {
  const bb = opaqueBBox(data);
  if (!bb) return 0;
  const fh = bb.y1 - bb.y0;
  const hairY1 = bb.y0 + fh * 0.42;
  let n = 0;
  for (let y = bb.y0; y <= hairY1; y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      const i = (y * W + x) * 4;
      const a = data[i + 3];
      if (a < 20) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isSkin(r, g, b)) continue;
      if (isGlassesFrame(r, g, b, a)) continue;
      if (r > 160 && g > 110 && b > 80 && r > b + 25) continue;
      const max = Math.max(r, g, b);
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      // Any non-skin pixel in the hair band → solid opaque jet black.
      if (max < 180 || L < 110 || a < 250) {
        data[i] = HAIR_RGB[0];
        data[i + 1] = HAIR_RGB[1];
        data[i + 2] = HAIR_RGB[2];
        data[i + 3] = 255;
        n++;
      }
    }
  }
  for (let y = Math.floor(hairY1); y <= bb.y0 + fh * 0.55; y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      const nx = (x - bb.x0) / (bb.x1 - bb.x0);
      if (nx > 0.18 && nx < 0.82) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < 20) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isSkin(r, g, b)) continue;
      const L = 0.299 * r + 0.587 * g + 0.114 * b;
      if (L < 120) {
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

/** Fill interior transparent holes inside the opaque silhouette. */
function fillInteriorHoles(data) {
  const bb = opaqueBBox(data);
  if (!bb) return 0;
  let n = 0;
  // Multi-pass so larger gaps close.
  for (let pass = 0; pass < 4; pass++) {
    const snapshot = new Uint8ClampedArray(data);
    for (let y = bb.y0 + 1; y < bb.y1; y++) {
      for (let x = bb.x0 + 1; x < bb.x1; x++) {
        const i = (y * W + x) * 4;
        if (snapshot[i + 3] > 40) continue;
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let sw = 0;
        let opaqueN = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const j = (ny * W + nx) * 4;
            if (snapshot[j + 3] < 180) continue;
            opaqueN++;
            const w = 3 - Math.max(Math.abs(dx), Math.abs(dy));
            sr += snapshot[j] * w;
            sg += snapshot[j + 1] * w;
            sb += snapshot[j + 2] * w;
            sw += w;
          }
        }
        if (opaqueN >= 8 && sw > 0) {
          data[i] = Math.round(sr / sw);
          data[i + 1] = Math.round(sg / sw);
          data[i + 2] = Math.round(sb / sw);
          data[i + 3] = 255;
          n++;
        }
      }
    }
  }
  return n;
}

function softNeckFade(data) {
  const bb = opaqueBBox(data);
  if (!bb) return;
  // Short hard-ish fade — long fades read as see-through on the ring backdrop.
  const chinY = bb.y0 + (bb.y1 - bb.y0) * 0.96;
  const fadeEnd = Math.min(H - 1, bb.y1 + 1);
  for (let y = Math.floor(chinY); y < H; y++) {
    const t = y >= fadeEnd ? 0 : 1 - (y - chinY) / Math.max(1, fadeEnd - chinY);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      data[i + 3] = Math.round(data[i + 3] * Math.max(0, t));
    }
  }
  // Crush leftover semi-transparent fringe at the chin to fully opaque or gone.
  for (let y = bb.y0; y <= bb.y1; y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      const i = (y * W + x) * 4;
      const a = data[i + 3];
      if (a > 0 && a < 80) data[i + 3] = 0;
      else if (a >= 80 && a < 230) data[i + 3] = 255;
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

function canvasFromData(id) {
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.putImageData(id, 0, 0);
  return ctx.canvas;
}

function writePng(file, canvas) {
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

function prepareFace(img, label) {
  const keyed = keyGreen(img);
  // Kill residual green fringe pixels that survived keying.
  let fringe = 0;
  for (let i = 0; i < keyed.data.length; i += 4) {
    if (keyed.data[i + 3] < 40) continue;
    const r = keyed.data[i];
    const g = keyed.data[i + 1];
    const b = keyed.data[i + 2];
    if (g > 90 && g > r + 25 && g > b + 25) {
      keyed.data[i + 3] = 0;
      fringe++;
    }
  }
  const collar = stripCollar(keyed.data);
  const hair = blackenHair(keyed.data);
  const holes = fillInteriorHoles(keyed.data);
  softNeckFade(keyed.data);
  removeSpeckles(keyed.data);
  const hair2 = blackenHair(keyed.data);
  console.log(label, 'fringe', fringe, 'collar', collar, 'hair', hair + hair2, 'holes', holes);
  return { canvas: canvasFromData(keyed.imageData), data: keyed.data };
}

function detectPupils(data) {
  const bands = [
    { x0: 0.25, x1: 0.48 },
    { x0: 0.52, x1: 0.75 },
  ];
  const y0 = (LM.rightEye.y - 0.08) * H;
  const y1 = (LM.rightEye.y + 0.1) * H;
  const eyes = [];
  for (const band of bands) {
    let sx = 0;
    let sy = 0;
    let w = 0;
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
      for (let x = Math.floor(band.x0 * W); x < Math.ceil(band.x1 * W); x++) {
        const i = (y * W + x) * 4;
        if (data[i + 3] < 200) continue;
        const L = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const chroma =
          Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
        if (L > 15 && L < 100 && chroma < 65) {
          const wt = 110 - L;
          sx += (x + 0.5) * wt;
          sy += (y + 0.5) * wt;
          w += wt;
        }
      }
    }
    eyes.push(w > 300 ? { x: sx / w / W, y: sy / w / H } : null);
  }
  if (!eyes[0] || !eyes[1]) return null;
  let right = eyes[0];
  let left = eyes[1];
  if (right.x > left.x) [right, left] = [left, right];
  if (left.x - right.x < 0.12) return null;
  return { right, left };
}

function nudgePupilsToLm(imageData) {
  const pupils = detectPupils(imageData.data);
  if (!pupils) return imageData;
  const srcMidX = ((pupils.right.x + pupils.left.x) / 2) * W;
  const srcMidY = ((pupils.right.y + pupils.left.y) / 2) * H;
  const dstMidX = ((LM.rightEye.x + LM.leftEye.x) / 2) * W;
  const dstMidY = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
  const srcDist = Math.hypot(
    (pupils.left.x - pupils.right.x) * W,
    (pupils.left.y - pupils.right.y) * H
  );
  const dstDist = Math.hypot(
    (LM.leftEye.x - LM.rightEye.x) * W,
    (LM.leftEye.y - LM.rightEye.y) * H
  );
  let s = dstDist / Math.max(1, srcDist);
  s = Math.max(0.97, Math.min(1.03, s));
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.translate(dstMidX, dstMidY);
  ctx.scale(s, s);
  ctx.translate(-srcMidX, -srcMidY);
  ctx.drawImage(canvasFromData(imageData), 0, 0);
  return ctx.getImageData(0, 0, W, H);
}

const FIT_MARGIN = Math.floor(0.025 * H);

function alignFace(keyedCanvas, keyedData, label, defSpan, defBb, forcedScale = null) {
  const bb = opaqueBBox(keyedData, { skipYellow: label === 'knockout' });
  if (!bb) throw new Error(`${label}: empty`);
  const curSpan = spanAtY(keyedData, 0.55) || (bb.x1 - bb.x0) / W;
  let scale =
    forcedScale != null ? forcedScale : (TARGET_MIDFACE_RATIO * defSpan) / Math.max(0.01, curSpan);
  const srcEyeY = bb.y0 + (bb.y1 - bb.y0) * EYE_BAND_T;
  const srcMidX = (bb.x0 + bb.x1) / 2;
  const dstEyeY = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
  const dstMidX = (defBb.x0 + defBb.x1) / 2;

  // Tall hair / open-mouth ooh can exceed the canvas at Default mid-face —
  // never clip the head; shrink until ≥FIT_MARGIN top/bottom remain.
  const maxFit = Math.min(
    (H - 2 * FIT_MARGIN) / Math.max(1, bb.y1 - bb.y0 + 1),
    (W - 2 * FIT_MARGIN) / Math.max(1, bb.x1 - bb.x0 + 1)
  );
  if (scale > maxFit) {
    console.log(label, `scale ${scale.toFixed(3)} capped to fit ${maxFit.toFixed(3)}`);
    scale = maxFit;
  }

  function draw(s, tx, ty) {
    const ctx = createCanvas(W, H).getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.translate(tx, ty);
    ctx.scale(s, s);
    ctx.translate(-srcMidX, -srcEyeY);
    ctx.drawImage(keyedCanvas, 0, 0);
    return ctx.getImageData(0, 0, W, H);
  }

  let tx = dstMidX;
  let ty = dstEyeY;
  let out = draw(scale, tx, ty);
  for (let iter = 0; iter < 16; iter++) {
    const outBb = opaqueBBox(out.data);
    if (!outBb) break;
    const ok =
      outBb.y0 >= FIT_MARGIN &&
      outBb.y1 <= H - 1 - FIT_MARGIN &&
      outBb.x0 >= 1 &&
      outBb.x1 <= W - 2;
    if (ok) break;
    scale *= 0.97;
    tx = dstMidX;
    ty = dstEyeY;
    out = draw(scale, tx, ty);
    const bb2 = opaqueBBox(out.data);
    if (!bb2) break;
    if (bb2.y0 < FIT_MARGIN) ty += FIT_MARGIN - bb2.y0;
    if (bb2.y1 > H - 1 - FIT_MARGIN) ty -= bb2.y1 - (H - 1 - FIT_MARGIN);
    if (bb2.x0 < FIT_MARGIN) tx += FIT_MARGIN - bb2.x0;
    if (bb2.x1 > W - 1 - FIT_MARGIN) tx -= bb2.x1 - (W - 1 - FIT_MARGIN);
    out = draw(scale, tx, ty);
  }

  out = nudgePupilsToLm(out);
  // Keep hair solid after transforms (interpolation can lighten).
  blackenHair(out.data);
  fillInteriorHoles(out.data);
  softNeckFade(out.data);
  removeSpeckles(out.data);
  blackenHair(out.data);

  const mid = spanAtY(out.data, 0.55);
  const finalBb = opaqueBBox(out.data);
  console.log(
    label,
    'scale',
    scale.toFixed(3),
    'midRatio',
    (mid / defSpan).toFixed(3),
    'top',
    finalBb ? (finalBb.y0 / H).toFixed(3) : '?'
  );
  return { canvas: canvasFromData(out), midRatio: (mid || 0) / defSpan, scale, imageData: out };
}

function matchMidFace(canvas, data, targetMid, defSpan, label) {
  const cur = spanAtY(data, 0.55);
  if (!cur || !targetMid) return { canvas, midRatio: (cur || 0) / defSpan, imageData: { data } };
  let factor = targetMid / cur;
  if (Math.abs(factor - 1) < 0.02) return { canvas, midRatio: cur / defSpan, imageData: { data } };
  const eyeMidX = ((LM.rightEye.x + LM.leftEye.x) / 2) * W;
  const eyeMidY = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
  for (let iter = 0; iter < 12; iter++) {
    const ctx = createCanvas(W, H).getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.translate(eyeMidX, eyeMidY);
    ctx.scale(factor, factor);
    ctx.translate(-eyeMidX, -eyeMidY);
    ctx.drawImage(canvas, 0, 0);
    const out = ctx.getImageData(0, 0, W, H);
    blackenHair(out.data);
    fillInteriorHoles(out.data);
    softNeckFade(out.data);
    removeSpeckles(out.data);
    const bb = opaqueBBox(out.data);
    const ok =
      bb &&
      bb.y0 >= FIT_MARGIN &&
      bb.y1 <= H - 1 - FIT_MARGIN &&
      bb.x0 >= 1 &&
      bb.x1 <= W - 2;
    if (ok) {
      const mid = spanAtY(out.data, 0.55);
      console.log(label, 'size-match', factor.toFixed(3), '→', (mid / defSpan).toFixed(3));
      return { canvas: canvasFromData(out), midRatio: (mid || 0) / defSpan, imageData: out };
    }
    factor *= 0.96;
  }
  const mid = spanAtY(data, 0.55);
  console.log(label, 'size-match skipped (would clip)');
  return { canvas, midRatio: (mid || 0) / defSpan, imageData: { data } };
}

function maskToClean(face, clean, dilate = 8) {
  const allow = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (clean.data[(y * W + x) * 4 + 3] > 40) {
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
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    if (!allow[i] && face.data[i * 4 + 3] > 0) {
      face.data[i * 4 + 3] = 0;
      n++;
    }
  }
  return n;
}

async function bakeDamage(cleanCanvas, koCanvas) {
  const liveCtx = createCanvas(W, H).getContext('2d');
  liveCtx.drawImage(cleanCanvas, 0, 0);
  const clean = liveCtx.getImageData(0, 0, W, H);
  let face = copyImageData(clean);
  const skin = sampleFaceSkin(clean);
  const outDir = path.join(CHAR, 'damage-stages');
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
  for (const step of steps) {
    if (step.run) {
      const n = step.run();
      console.log(step.name, n, 'masked', maskToClean(face, clean));
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

function mirrorBobo(oohCanvas, koCanvas) {
  const dmg = path.join(CHAR, 'damage-stages');
  const clown = path.join(CHAR, 'bobo-clown-stages');
  fs.mkdirSync(clown, { recursive: true });
  for (const name of fs.readdirSync(dmg)) {
    fs.copyFileSync(path.join(dmg, name), path.join(clown, name));
  }
  writePng(path.join(clown, 'ooh.png'), oohCanvas);
  writePng(path.join(clown, 'knockout-clean.png'), koCanvas);
}

const defImg = await loadImage(path.resolve(__dirname, '../public/faces/characters/default/clean.png'));
const defCtx = createCanvas(W, H).getContext('2d');
defCtx.drawImage(defImg, 0, 0, W, H);
const defData = defCtx.getImageData(0, 0, W, H).data;
const defSpan = spanAtY(defData, 0.55);
const defBb = opaqueBBox(defData);

const cleanPrep = prepareFace(await loadImage(ART.clean), 'clean');
const oohPrep = prepareFace(await loadImage(ART.ooh), 'ooh');
const koPrep = prepareFace(await loadImage(ART.knockout), 'knockout');

const cleanRes = alignFace(cleanPrep.canvas, cleanPrep.data, 'clean', defSpan, defBb);
const cleanMid = spanAtY(
  (() => {
    const c = createCanvas(W, H).getContext('2d');
    c.drawImage(cleanRes.canvas, 0, 0);
    return c.getImageData(0, 0, W, H).data;
  })(),
  0.55
);

let oohRes = alignFace(oohPrep.canvas, oohPrep.data, 'ooh', defSpan, defBb, cleanRes.scale);
oohRes = { ...oohRes, ...matchMidFace(oohRes.canvas, oohRes.imageData.data, cleanMid, defSpan, 'ooh') };
let koRes = alignFace(koPrep.canvas, koPrep.data, 'knockout', defSpan, defBb, cleanRes.scale);
koRes = { ...koRes, ...matchMidFace(koRes.canvas, koRes.imageData.data, cleanMid, defSpan, 'knockout') };

writePng(path.join(CHAR, 'clean.png'), cleanRes.canvas);
writePng(path.join(CHAR, 'ooh.png'), oohRes.canvas);
writePng(path.join(CHAR, 'knockout.png'), koRes.canvas);
await bakeDamage(cleanRes.canvas, koRes.canvas);
mirrorBobo(oohRes.canvas, koRes.canvas);

// QA
const qa = createCanvas(W, H).getContext('2d');
qa.drawImage(cleanRes.canvas, 0, 0);
const qd = qa.getImageData(0, 0, W, H).data;
let holes = 0;
let whiteBottom = 0;
const bb = opaqueBBox(qd);
for (let y = bb.y0 + 2; y < bb.y1 - 2; y++) {
  for (let x = bb.x0 + 2; x < bb.x1 - 2; x++) {
    const i = (y * W + x) * 4;
    if (qd[i + 3] > 40) continue;
    let n = 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (qd[((y + dy) * W + (x + dx)) * 4 + 3] > 40) n++;
    }
    if (n >= 3) holes++;
  }
}
for (let y = bb.y1 - 60; y <= bb.y1; y++) {
  for (let x = bb.x0; x <= bb.x1; x++) {
    const i = (y * W + x) * 4;
    if (qd[i + 3] > 40 && qd[i] > 200 && qd[i + 1] > 200) whiteBottom++;
  }
}
console.log('QA interiorHoles', holes, 'whiteBottom', whiteBottom, 'midRatio', cleanRes.midRatio.toFixed(3));
console.log('Done →', CHAR);
