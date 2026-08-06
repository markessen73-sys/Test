/**
 * Process Punch-Out packs to Default head size using bbox layout (usual rules).
 * Scales mid-face to Default, places eye-band on LM eye midpoint.
 *
 *   node scripts/process-character-pack.mjs <id> --from-existing
 *   node scripts/process-character-pack.mjs <id> --clean P --ooh P --ko P
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
const TARGET_MIDFACE_RATIO = 1.0;
/** Eye row as fraction down the opaque head (Punch-Out proportions). */
const DEFAULT_EYE_BAND_T = 0.42;

function parseArgs(argv) {
  const out = {
    id: null,
    clean: null,
    ooh: null,
    ko: null,
    fromExisting: false,
    eyeBand: DEFAULT_EYE_BAND_T,
    midRatio: TARGET_MIDFACE_RATIO,
  };
  const rest = [...argv];
  out.id = rest.shift();
  while (rest.length) {
    const a = rest.shift();
    if (a === '--from-existing') out.fromExisting = true;
    else if (a === '--clean') out.clean = rest.shift();
    else if (a === '--ooh') out.ooh = rest.shift();
    else if (a === '--ko') out.ko = rest.shift();
    else if (a === '--eye-band') out.eyeBand = Number(rest.shift());
    else if (a === '--mid-ratio') out.midRatio = Number(rest.shift());
  }
  return out;
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
  return { canvas: ctx.canvas, data: id.data };
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
      if (skipYellow) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // KO stars / sparkles
        if (r > 200 && g > 180 && b < 120) continue;
      }
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

function canvasFromData(id) {
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.putImageData(id, 0, 0);
  return ctx.canvas;
}

/** Dark-pupil centroids in left/right halves near the LM eye row. */
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

function nudgePupilsToLm(imageData, label) {
  const pupils = detectPupils(imageData.data);
  if (!pupils) {
    console.log(label, 'pupil nudge skipped');
    return imageData;
  }
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
  // Keep size stable — only allow mild pupil-span correction.
  s = Math.max(0.97, Math.min(1.03, s));
  const dx = dstMidX - srcMidX * s - (1 - s) * srcMidX;
  // After scale about src mid: x' = s*(x-srcMid)+srcMid + (dstMid-srcMid) = s*x + (dstMid - s*srcMid)
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const canvas = canvasFromData(imageData);
  ctx.translate(dstMidX, dstMidY);
  ctx.scale(s, s);
  ctx.translate(-srcMidX, -srcMidY);
  ctx.drawImage(canvas, 0, 0);
  const out = ctx.getImageData(0, 0, W, H);
  const after = detectPupils(out.data);
  if (after) {
    const dR = Math.hypot(after.right.x - LM.rightEye.x, after.right.y - LM.rightEye.y);
    const dL = Math.hypot(after.left.x - LM.leftEye.x, after.left.y - LM.leftEye.y);
    console.log(label, 'pupil nudge', `×${s.toFixed(3)}`, `dR=${dR.toFixed(3)}`, `dL=${dL.toFixed(3)}`);
  }
  return out;
}

function writePng(file, canvas) {
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

/**
 * Align keyed face so:
 *  - mid-face width matches Default × TARGET_MIDFACE_RATIO
 *  - horizontal center matches Default
 *  - eye-band row (EYE_BAND_T down bbox) lands on LM eye midpoint Y
 */
/**
 * Align keyed face so mid-face matches Default and eye-band hits LM eye Y.
 * When `forcedScale` is set (ooh/KO), reuse clean's scale for size consistency.
 */
function alignFace(
  keyedCanvas,
  keyedData,
  label,
  defSpan,
  defBb,
  eyeBandT,
  midRatioTarget,
  forcedScale = null
) {
  const bb = opaqueBBox(keyedData, { skipYellow: label === 'knockout' });
  if (!bb) throw new Error(`${label}: empty after key`);

  const curSpan = spanAtY(keyedData, 0.55) || (bb.x1 - bb.x0) / W;
  let scale =
    forcedScale != null
      ? forcedScale
      : (midRatioTarget * defSpan) / Math.max(0.01, curSpan);

  const srcEyeY = bb.y0 + (bb.y1 - bb.y0) * eyeBandT;
  const srcMidX = (bb.x0 + bb.x1) / 2;
  const dstEyeY = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
  const dstMidX = (defBb.x0 + defBb.x1) / 2;

  function drawScaled(s, tx, ty) {
    const ctx = createCanvas(W, H).getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.translate(tx, ty);
    ctx.scale(s, s);
    ctx.translate(-srcMidX, -srcEyeY);
    ctx.drawImage(keyedCanvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return ctx.getImageData(0, 0, W, H);
  }

  let out = drawScaled(scale, dstMidX, dstEyeY);
  let outBb = opaqueBBox(out.data);

  // Prefer Default head size for HUD; only reclaim top margin if mid-face stays ≥0.94.
  const minTop = Math.floor(0.035 * H);
  if (outBb && outBb.y0 < minTop && forcedScale == null) {
    const need = minTop - outBb.y0;
    const roomBottom = H - 1 - outBb.y1;
    if (need <= roomBottom - 8) {
      const shifted = drawScaled(scale, dstMidX, dstEyeY + need);
      const midAfter = spanAtY(shifted.data, 0.55);
      if (midAfter && midAfter / defSpan >= 0.94) out = shifted;
    }
  } else if (outBb && outBb.y0 < minTop && forcedScale != null) {
    const need = minTop - outBb.y0;
    if (need <= H - 1 - outBb.y1 - 4) {
      out = drawScaled(scale, dstMidX, dstEyeY + need);
    }
  }

  // Nudge so dark pupils sit on LM (glasses characters).
  out = nudgePupilsToLm(out, label);

  softNeckFade(out.data);
  removeSpeckles(out.data);

  let mid = spanAtY(out.data, 0.55);
  outBb = opaqueBBox(out.data);
  console.log(
    label,
    'scale',
    scale.toFixed(3),
    'midRatio',
    (mid / defSpan).toFixed(3),
    'topMargin',
    outBb ? (outBb.y0 / H).toFixed(3) : '?',
    'eyeBand',
    eyeBandT.toFixed(2)
  );

  return { canvas: canvasFromData(out), midRatio: (mid || 0) / defSpan, scale, imageData: out };
}

/** Extra uniform scale about LM eye mid so ooh/KO mid-face matches clean. */
function matchMidFace(canvas, data, targetMid, defSpan, label) {
  const cur = spanAtY(data, 0.55);
  if (!cur || !targetMid) return { canvas, midRatio: (cur || 0) / defSpan };
  const factor = targetMid / cur;
  if (Math.abs(factor - 1) < 0.02) return { canvas, midRatio: cur / defSpan };
  const eyeMidX = ((LM.rightEye.x + LM.leftEye.x) / 2) * W;
  const eyeMidY = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.translate(eyeMidX, eyeMidY);
  ctx.scale(factor, factor);
  ctx.translate(-eyeMidX, -eyeMidY);
  ctx.drawImage(canvas, 0, 0);
  const out = ctx.getImageData(0, 0, W, H);
  softNeckFade(out.data);
  removeSpeckles(out.data);
  const mid = spanAtY(out.data, 0.55);
  console.log(label, 'size-match ×', factor.toFixed(3), '→ midRatio', (mid / defSpan).toFixed(3));
  return { canvas: canvasFromData(out), midRatio: (mid || 0) / defSpan };
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

async function bakeDamage(charDir, cleanCanvas, koCanvas) {
  const liveCtx = createCanvas(W, H).getContext('2d');
  liveCtx.clearRect(0, 0, W, H);
  liveCtx.drawImage(cleanCanvas, 0, 0);
  const clean = liveCtx.getImageData(0, 0, W, H);
  let face = copyImageData(clean);
  const skin = sampleFaceSkin(clean);
  console.log('skin', skin.map((v) => Math.round(v)));

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

function mirrorBobo(charDir, oohCanvas, koCanvas) {
  const dmg = path.join(charDir, 'damage-stages');
  const clown = path.join(charDir, 'bobo-clown-stages');
  fs.mkdirSync(clown, { recursive: true });
  for (const name of fs.readdirSync(dmg)) {
    fs.copyFileSync(path.join(dmg, name), path.join(clown, name));
  }
  writePng(path.join(clown, 'ooh.png'), oohCanvas);
  writePng(path.join(clown, 'knockout-clean.png'), koCanvas);
}

const args = parseArgs(process.argv.slice(2));
if (!args.id) {
  console.error('Usage: node scripts/process-character-pack.mjs <id> (--from-existing | --clean/--ooh/--ko)');
  process.exit(1);
}

const charDir = path.join(CHAR_ROOT, args.id);
const cleanPath = args.fromExisting ? path.join(charDir, 'clean.png') : args.clean;
const oohPath = args.fromExisting ? path.join(charDir, 'ooh.png') : args.ooh;
const koPath = args.fromExisting ? path.join(charDir, 'knockout.png') : args.ko;
if (!cleanPath || !oohPath || !koPath) {
  console.error('Need --from-existing or --clean/--ooh/--ko');
  process.exit(1);
}

const tmpDir = path.join('/tmp', `pack-${args.id}-${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });
const cleanTmp = path.join(tmpDir, 'clean.png');
const oohTmp = path.join(tmpDir, 'ooh.png');
const koTmp = path.join(tmpDir, 'ko.png');
fs.copyFileSync(cleanPath, cleanTmp);
fs.copyFileSync(oohPath, oohTmp);
fs.copyFileSync(koPath, koTmp);

const defImg = await loadImage(path.join(CHAR_ROOT, 'default/clean.png'));
const defCtx = createCanvas(W, H).getContext('2d');
defCtx.drawImage(defImg, 0, 0, W, H);
const defData = defCtx.getImageData(0, 0, W, H).data;
const defSpan = spanAtY(defData, 0.55);
const defBb = opaqueBBox(defData);

const cleanKeyed = keyBlack(await loadImage(cleanTmp));
const oohKeyed = keyBlack(await loadImage(oohTmp));
const koKeyed = keyBlack(await loadImage(koTmp));

const cleanRes = alignFace(
  cleanKeyed.canvas,
  cleanKeyed.data,
  'clean',
  defSpan,
  defBb,
  args.eyeBand,
  args.midRatio
);
const cleanMid = spanAtY(
  (() => {
    const c = createCanvas(W, H).getContext('2d');
    c.drawImage(cleanRes.canvas, 0, 0);
    return c.getImageData(0, 0, W, H).data;
  })(),
  0.55
);

let oohRes = alignFace(
  oohKeyed.canvas,
  oohKeyed.data,
  'ooh',
  defSpan,
  defBb,
  args.eyeBand,
  args.midRatio,
  cleanRes.scale
);
oohRes = {
  ...oohRes,
  ...matchMidFace(oohRes.canvas, oohRes.imageData.data, cleanMid, defSpan, 'ooh'),
};

let koRes = alignFace(
  koKeyed.canvas,
  koKeyed.data,
  'knockout',
  defSpan,
  defBb,
  args.eyeBand,
  args.midRatio,
  cleanRes.scale
);
koRes = {
  ...koRes,
  ...matchMidFace(koRes.canvas, koRes.imageData.data, cleanMid, defSpan, 'knockout'),
};

writePng(path.join(charDir, 'clean.png'), cleanRes.canvas);
writePng(path.join(charDir, 'ooh.png'), oohRes.canvas);
writePng(path.join(charDir, 'knockout.png'), koRes.canvas);
await bakeDamage(charDir, cleanRes.canvas, koRes.canvas);
mirrorBobo(charDir, oohRes.canvas, koRes.canvas);

console.log(args.id, 'done — midRatio', cleanRes.midRatio.toFixed(3));
