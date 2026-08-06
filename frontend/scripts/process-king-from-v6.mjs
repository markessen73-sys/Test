/**
 * Process king-*-v6 Punch-Out art into the king-of-the-north pack.
 * Black→alpha, LM-align (iris clusters), soft neck fade, bake damage, mirror bobo.
 */
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  W,
  H,
  LM,
  isIris,
  isSclera,
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
  clean: '/opt/cursor/artifacts/assets/king-clean-v6.png',
  ooh: '/opt/cursor/artifacts/assets/king-ooh-v6.png',
  knockout: '/opt/cursor/artifacts/assets/king-ko-v6.png',
};

/** Mid-face span vs Default — leave hair/chin margin; faceScale boosts on ring. */
const TARGET_MIDFACE_RATIO = 0.52;

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
  return { canvas: ctx.canvas, data: id.data };
}

function opaqueBBox(data) {
  let x0 = W,
    y0 = H,
    x1 = 0,
    y1 = 0,
    n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 40) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
        n++;
      }
    }
  }
  return n ? { x0, y0, x1, y1, n } : null;
}

function mean(pts) {
  if (!pts.length) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
  }
  return { x: sx / pts.length, y: sy / pts.length, n: pts.length };
}

/**
 * Eye centers: darkest compact pixels in left/right halves of the mid-face band.
 * Avoids gold-cheek false positives and hair matching isIris().
 */
function detectEyesFromIris(data) {
  const bb = opaqueBBox(data);
  if (!bb) return null;
  const fw = bb.x1 - bb.x0;
  const fh = bb.y1 - bb.y0;
  // Eye band ~38–52% down the opaque head; lateral thirds for each eye.
  const y0 = bb.y0 + fh * 0.34;
  const y1 = bb.y0 + fh * 0.52;
  const regions = [
    { x0: bb.x0 + fw * 0.08, x1: bb.x0 + fw * 0.42 }, // viewer-left = char right
    { x0: bb.x0 + fw * 0.58, x1: bb.x0 + fw * 0.92 },
  ];
  const eyes = [];
  for (const reg of regions) {
    let sx = 0;
    let sy = 0;
    let w = 0;
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
      for (let x = Math.floor(reg.x0); x < Math.ceil(reg.x1); x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = (y * W + x) * 4;
        if (data[i + 3] < 200) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const L = 0.299 * r + 0.587 * g + 0.114 * b;
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        if (!(L > 15 && L < 95 && chroma < 65)) continue;
        const wt = 100 - L;
        sx += ((x + 0.5) / W) * wt;
        sy += ((y + 0.5) / H) * wt;
        w += wt;
      }
    }
    if (w < 500) {
      eyes.push(null);
      continue;
    }
    eyes.push({ x: sx / w, y: sy / w, n: w });
  }
  if (!eyes[0] || !eyes[1]) {
    const scleraEyes = detectEyesFromSclera(data, bb);
    if (scleraEyes) return scleraEyes;
    return detectEyesFromBBox(data);
  }
  let eyeL = eyes[0];
  let eyeR = eyes[1];
  if (eyeL.x > eyeR.x) [eyeL, eyeR] = [eyeR, eyeL];
  if (eyeR.x - eyeL.x < 0.14) return detectEyesFromBBox(data);
  return { right: eyeL, left: eyeR };
}

function detectEyesFromSclera(data, bb) {
  const fw = bb.x1 - bb.x0;
  const fh = bb.y1 - bb.y0;
  const y0 = bb.y0 + fh * 0.34;
  const y1 = bb.y0 + fh * 0.52;
  const pts = [];
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 200) continue;
      if (isSclera(data[i], data[i + 1], data[i + 2])) {
        pts.push([(x + 0.5) / W, (y + 0.5) / H]);
      }
    }
  }
  return splitTwoEyes(pts, 40);
}

function splitTwoEyes(pts, minCount) {
  if (pts.length < minCount) return null;
  let c0 = 0.38;
  let c1 = 0.62;
  for (let iter = 0; iter < 12; iter++) {
    const a = [];
    const b = [];
    for (const p of pts) (Math.abs(p[0] - c0) <= Math.abs(p[0] - c1) ? a : b).push(p);
    const m0 = mean(a);
    const m1 = mean(b);
    if (!m0 || !m1) return null;
    c0 = m0.x;
    c1 = m1.x;
  }
  const mid = (c0 + c1) / 2;
  const leftPts = pts.filter((p) => p[0] < mid);
  const rightPts = pts.filter((p) => p[0] >= mid);
  let eyeL = mean(leftPts);
  let eyeR = mean(rightPts);
  if (!eyeL || !eyeR) return null;
  if (eyeL.x > eyeR.x) [eyeL, eyeR] = [eyeR, eyeL];
  if (eyeR.x - eyeL.x < 0.14 || eyeR.x - eyeL.x > 0.40) return null;
  return { right: eyeL, left: eyeR };
}

/** Fallback eyes from face bbox (caricature proportions). */
function detectEyesFromBBox(data) {
  const bb = opaqueBBox(data);
  if (!bb) return null;
  const fw = bb.x1 - bb.x0;
  const fh = bb.y1 - bb.y0;
  return {
    right: { x: (bb.x0 + fw * 0.32) / W, y: (bb.y0 + fh * 0.42) / H, n: 0 },
    left: { x: (bb.x0 + fw * 0.68) / W, y: (bb.y0 + fh * 0.42) / H, n: 0 },
  };
}

function estimateSimilarity(srcR, srcL, dstR, dstL) {
  const sx0 = srcR.x * W;
  const sy0 = srcR.y * H;
  const sx1 = srcL.x * W;
  const sy1 = srcL.y * H;
  const dx0 = dstR.x * W;
  const dy0 = dstR.y * H;
  const dx1 = dstL.x * W;
  const dy1 = dstL.y * H;

  const svx = sx1 - sx0;
  const svy = sy1 - sy0;
  const dvx = dx1 - dx0;
  const dvy = dy1 - dy0;
  const sLen = Math.hypot(svx, svy) || 1;
  const dLen = Math.hypot(dvx, dvy) || 1;
  const scale = dLen / sLen;
  const rot = Math.atan2(dvy, dvx) - Math.atan2(svy, svx);
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const smx = (sx0 + sx1) / 2;
  const smy = (sy0 + sy1) / 2;
  const dmx = (dx0 + dx1) / 2;
  const dmy = (dy0 + dy1) / 2;
  const rx = scale * (cos * smx - sin * smy);
  const ry = scale * (sin * smx + cos * smy);
  return {
    a: scale * cos,
    b: scale * sin,
    c: -scale * sin,
    d: scale * cos,
    e: dmx - rx,
    f: dmy - ry,
    scale,
  };
}

function softNeckFade(data) {
  const bb = opaqueBBox(data);
  if (!bb) return;
  const chinY = bb.y0 + (bb.y1 - bb.y0) * 0.9;
  const fadeEnd = Math.min(H - 1, bb.y1 + 4);
  for (let y = Math.floor(chinY); y < H; y++) {
    const t = y >= fadeEnd ? 0 : 1 - (y - chinY) / Math.max(1, fadeEnd - chinY);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      data[i + 3] = Math.round(data[i + 3] * Math.max(0, t));
    }
  }
}

/** Drop tiny disconnected opaque blobs (stray generation artifacts). */
function removeSpeckles(data) {
  const visited = new Uint8Array(W * H);
  const sizes = [];
  const roots = [];
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
        if (visited[idx]) continue;
        if (data[idx * 4 + 3] <= 40) continue;
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
      const n = flood(x, y, next);
      sizes[next] = n;
      roots[next] = [x, y];
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
    if (id && id !== mainId && sizes[id] < mainN * 0.02) {
      data[i * 4 + 3] = 0;
    }
  }
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

function writePng(file, canvas) {
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

function canvasFromData(id) {
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.putImageData(id, 0, 0);
  return ctx.canvas;
}

async function defaultMidSpan() {
  const def = await loadImage(path.resolve(__dirname, '../public/faces/characters/default/clean.png'));
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.drawImage(def, 0, 0, W, H);
  return spanAtY(ctx.getImageData(0, 0, W, H).data, 0.55);
}

/**
 * Align keyed face so src eyes → LM, then scale about eye midpoint to target mid-face ratio.
 * Optional forcedEyes skips detection (for KO using clean-relative bbox eyes).
 */
function alignFace(keyedCanvas, keyedData, label, defSpan, forcedEyes = null) {
  const eyes = forcedEyes || detectEyesFromIris(keyedData) || detectEyesFromBBox(keyedData);
  if (!eyes) throw new Error(`${label}: no eyes`);
  console.log(
    label,
    'eyes src',
    `R(${eyes.right.x.toFixed(3)},${eyes.right.y.toFixed(3)})`,
    `L(${eyes.left.x.toFixed(3)},${eyes.left.y.toFixed(3)})`,
    forcedEyes ? '(forced)' : ''
  );

  const M = estimateSimilarity(eyes.right, eyes.left, LM.rightEye, LM.leftEye);
  const ctx1 = createCanvas(W, H).getContext('2d');
  ctx1.clearRect(0, 0, W, H);
  ctx1.setTransform(M.a, M.b, M.c, M.d, M.e, M.f);
  ctx1.drawImage(keyedCanvas, 0, 0);
  ctx1.setTransform(1, 0, 0, 1, 0, 0);
  const data1 = ctx1.getImageData(0, 0, W, H);

  const curSpan = spanAtY(data1.data, 0.55);
  const ratio = curSpan && defSpan ? curSpan / defSpan : 1;
  const extra = TARGET_MIDFACE_RATIO / Math.max(0.01, ratio);
  console.log(label, 'mid ratio', ratio.toFixed(3), 'extraScale', extra.toFixed(3));

  const eyeMidX = ((LM.rightEye.x + LM.leftEye.x) / 2) * W;
  const eyeMidY = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
  const ctx2 = createCanvas(W, H).getContext('2d');
  ctx2.clearRect(0, 0, W, H);
  ctx2.translate(eyeMidX, eyeMidY);
  ctx2.scale(extra, extra);
  ctx2.translate(-eyeMidX, -eyeMidY);
  ctx2.drawImage(ctx1.canvas, 0, 0);
  ctx2.setTransform(1, 0, 0, 1, 0, 0);

  let out = ctx2.getImageData(0, 0, W, H);

  // Second pass translation only when we auto-detected eyes (manual anchors
  // already land on LM via the similarity transform).
  let check = null;
  if (!forcedEyes) {
    check = detectEyesFromIris(out.data);
    if (check) {
      const midSrcX = ((check.right.x + check.left.x) / 2) * W;
      const midSrcY = ((check.right.y + check.left.y) / 2) * H;
      const midDstX = ((LM.rightEye.x + LM.leftEye.x) / 2) * W;
      const midDstY = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
      const dx = midDstX - midSrcX;
      const dy = midDstY - midSrcY;
      if (Math.hypot(dx, dy) > 0.5) {
        const ctx3 = createCanvas(W, H).getContext('2d');
        ctx3.clearRect(0, 0, W, H);
        ctx3.drawImage(ctx2.canvas, dx, dy);
        out = ctx3.getImageData(0, 0, W, H);
      }
    }
  }

  softNeckFade(out.data);
  removeSpeckles(out.data);

  // Re-detect after cleanup for logging
  check = detectEyesFromIris(out.data);
  if (check) {
    const dR = Math.hypot(check.right.x - LM.rightEye.x, check.right.y - LM.rightEye.y);
    const dL = Math.hypot(check.left.x - LM.leftEye.x, check.left.y - LM.leftEye.y);
    console.log(
      label,
      'eyes after',
      `R(${check.right.x.toFixed(3)},${check.right.y.toFixed(3)}) d=${dR.toFixed(3)}`,
      `L(${check.left.x.toFixed(3)},${check.left.y.toFixed(3)}) d=${dL.toFixed(3)}`
    );
  }

  return {
    canvas: canvasFromData(out),
    midRatio: (spanAtY(out.data, 0.55) || 0) / (defSpan || 1),
    srcEyes: eyes,
    keyedData,
  };
}

async function bakeDamage(cleanCanvas, koCanvas) {
  const liveCtx = createCanvas(W, H).getContext('2d');
  liveCtx.clearRect(0, 0, W, H);
  liveCtx.drawImage(cleanCanvas, 0, 0);
  const clean = liveCtx.getImageData(0, 0, W, H);
  let face = copyImageData(clean);
  const skin = sampleFaceSkin(clean);
  console.log('skin', skin.map((v) => Math.round(v)));

  /** Drop floating ear stamps that land outside a small-margin head. */
  function maskToClean(faceData, cleanData, dilate = 6) {
    const allow = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (cleanData.data[(y * W + x) * 4 + 3] > 40) {
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
      if (!allow[i] && faceData.data[i * 4 + 3] > 0) {
        faceData.data[i * 4 + 3] = 0;
        n++;
      }
    }
    return n;
  }

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
      const m = maskToClean(face, clean);
      console.log(step.name, n, 'masked', m);
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

/** Hand-tuned pupil centers on king-*-v6 art (verified against overlays). */
const MANUAL_EYES = {
  clean: {
    right: { x: 0.42, y: 0.48, n: 1 },
    left: { x: 0.62, y: 0.48, n: 1 },
  },
  ooh: {
    right: { x: 0.42, y: 0.48, n: 1 },
    left: { x: 0.62, y: 0.48, n: 1 },
  },
};

const defSpan = await defaultMidSpan();

const cleanKeyed = keyBlack(await loadImage(ART.clean));
const oohKeyed = keyBlack(await loadImage(ART.ooh));
const koKeyed = keyBlack(await loadImage(ART.knockout));

const cleanRes = alignFace(
  cleanKeyed.canvas,
  cleanKeyed.data,
  'clean',
  defSpan,
  MANUAL_EYES.clean
);
const oohRes = alignFace(oohKeyed.canvas, oohKeyed.data, 'ooh', defSpan, MANUAL_EYES.ooh);

// KO spiral eyes: same relative bbox offsets as clean's manual anchors.
const cleanBb = opaqueBBox(cleanKeyed.data);
const koBb = opaqueBBox(koKeyed.data);
const cleanEyes = MANUAL_EYES.clean;
const rel = {
  right: {
    x: (cleanEyes.right.x * W - cleanBb.x0) / (cleanBb.x1 - cleanBb.x0),
    y: (cleanEyes.right.y * H - cleanBb.y0) / (cleanBb.y1 - cleanBb.y0),
  },
  left: {
    x: (cleanEyes.left.x * W - cleanBb.x0) / (cleanBb.x1 - cleanBb.x0),
    y: (cleanEyes.left.y * H - cleanBb.y0) / (cleanBb.y1 - cleanBb.y0),
  },
};
const koForced = {
  right: {
    x: (koBb.x0 + rel.right.x * (koBb.x1 - koBb.x0)) / W,
    y: (koBb.y0 + rel.right.y * (koBb.y1 - koBb.y0)) / H,
    n: 0,
  },
  left: {
    x: (koBb.x0 + rel.left.x * (koBb.x1 - koBb.x0)) / W,
    y: (koBb.y0 + rel.left.y * (koBb.y1 - koBb.y0)) / H,
    n: 0,
  },
};
const koRes = alignFace(koKeyed.canvas, koKeyed.data, 'knockout', defSpan, koForced);

writePng(path.join(CHAR, 'clean.png'), cleanRes.canvas);
writePng(path.join(CHAR, 'ooh.png'), oohRes.canvas);
writePng(path.join(CHAR, 'knockout.png'), koRes.canvas);
await bakeDamage(cleanRes.canvas, koRes.canvas);
mirrorBobo(oohRes.canvas, koRes.canvas);

const suggested = 1 / Math.max(0.2, cleanRes.midRatio);
console.log('clean midRatio', cleanRes.midRatio.toFixed(3), 'suggested faceScale', suggested.toFixed(2));
console.log('Done');
