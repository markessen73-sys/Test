/**
 * Reprocess King Of The North from green-screen art with a clean hard chin.
 * Stricter chroma key (won't eat orange jaw shadows), collar-only strip,
 * interior hole fill, no soft neck fade.
 *
 *   node scripts/fix-king-chin.mjs
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
const CHAR = path.resolve(__dirname, '../public/faces/characters/king-of-the-north');
const DEF = path.resolve(__dirname, '../public/faces/characters/default/clean.png');
const ART = '/opt/cursor/artifacts/assets';
const MARGIN = 24;
const HAIR = [8, 6, 10];

function isGreen(r, g, b) {
  // Strict chroma — do not treat warm jaw shadows as green.
  return g > 140 && g > r + 40 && g > b + 40;
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

function canvasFromData(id) {
  const c = createCanvas(W, H);
  c.getContext('2d').putImageData(id, 0, 0);
  return c;
}

function writePng(file, canvas) {
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

function hardenAlpha(data) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0 && data[i + 3] < 40) data[i + 3] = 0;
    else if (data[i + 3] >= 40) data[i + 3] = 255;
  }
}

function keyGreen(img) {
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i],
      g = d[i + 1],
      b = d[i + 2];
    if (isGreen(r, g, b)) {
      d[i + 3] = 0;
      continue;
    }
    if (g > 110 && g > r + 25 && g > b + 25) {
      const t = Math.min(1, (g - Math.max(r, b) - 25) / 90);
      d[i + 3] = Math.round(d[i + 3] * (1 - t));
    }
  }
  hardenAlpha(d);
  ctx.putImageData(id, 0, 0);
  return { canvas: ctx.canvas, data: d, imageData: id };
}

function stripCollarOnly(data) {
  const bb = opaqueBBox(data);
  if (!bb) return;
  const yCut = bb.y0 + (bb.y1 - bb.y0) * 0.88;
  for (let y = Math.floor(yCut); y <= bb.y1; y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 40) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const L = (r + g + b) / 3;
      const isWhite = L > 185 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25;
      if (isWhite) data[i + 3] = 0;
    }
  }
}

function blackenHair(data) {
  const bb = opaqueBBox(data);
  if (!bb) return;
  const hairY1 = bb.y0 + (bb.y1 - bb.y0) * 0.42;
  for (let y = bb.y0; y <= hairY1; y++) {
    for (let x = bb.x0; x <= bb.x1; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 40) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (g > 90 && g > r + 25 && g > b + 25) {
        data[i + 3] = 0;
        continue;
      }
      if (r < 85 && g < 85 && b < 90) {
        data[i] = HAIR[0];
        data[i + 1] = HAIR[1];
        data[i + 2] = HAIR[2];
        data[i + 3] = 255;
      }
    }
  }
}

function fillInteriorHoles(data) {
  const trans = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) trans[i] = data[i * 4 + 3] < 40 ? 1 : 0;
  const bg = new Uint8Array(W * H);
  const q = [];
  const push = (x, y) => {
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
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }
  let filled = 0;
  for (let iter = 0; iter < 100; iter++) {
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
          const L = (data[j] + data[j + 1] + data[j + 2]) / 3;
          const wgt = L > 55 ? 3 : 1;
          sr += data[j] * wgt;
          sg += data[j + 1] * wgt;
          sb += data[j + 2] * wgt;
          sn += wgt;
        }
        if (sn > 0) {
          batch.push({
            i,
            r: Math.round(sr / sn),
            g: Math.round(sg / sn),
            b: Math.round(sb / sn),
          });
        }
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
      filled++;
    }
  }
  return filled;
}

function scrubGreenFringe(data) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue;
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    if (g > 90 && g > r + 18 && g > b + 18) data[i + 3] = 0;
  }
}

/** Drop thin green/yellow wisps hanging under the solid chin. */
function trimBottomWisps(data) {
  const bb = opaqueBBox(data);
  if (!bb) return;
  const midSpan = spanAtY(data, 0.55) || (bb.x1 - bb.x0) / W;
  for (let y = bb.y1; y > bb.y0 + (bb.y1 - bb.y0) * 0.72; y--) {
    let L = null,
      R = null,
      n = 0,
      sg = 0,
      sr = 0,
      sb = 0;
    for (let x = bb.x0; x <= bb.x1; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 40) continue;
      if (L === null) L = x;
      R = x;
      n++;
      sr += data[i];
      sg += data[i + 1];
      sb += data[i + 2];
    }
    if (L === null) continue;
    const span = (R - L + 1) / W;
    const meanR = sr / n,
      meanG = sg / n,
      meanB = sb / n;
    const fringe = meanG > meanR + 8 && meanG > meanB + 8;
    const thin = span < midSpan * 0.4 && n < W * 0.1;
    if (fringe || thin) {
      for (let x = 0; x < W; x++) data[(y * W + x) * 4 + 3] = 0;
    } else {
      break;
    }
  }
}

function prepare(img) {
  const keyed = keyGreen(img);
  stripCollarOnly(keyed.data);
  blackenHair(keyed.data);
  console.log('  holes filled', fillInteriorHoles(keyed.data));
  scrubGreenFringe(keyed.data);
  fillInteriorHoles(keyed.data);
  trimBottomWisps(keyed.data);
  hardenAlpha(keyed.data);
  keyed.canvas.getContext('2d').putImageData(keyed.imageData, 0, 0);
  return keyed;
}

function alignShared(preps, defSpan) {
  function scaleOf(prep) {
    const bb = opaqueBBox(prep.data);
    const cur = spanAtY(prep.data, 0.55) || (bb.x1 - bb.x0) / W;
    return defSpan / Math.max(0.01, cur);
  }
  let shared = scaleOf(preps.clean);
  for (let iter = 0; iter < 40; iter++) {
    let clip = false;
    for (const prep of Object.values(preps)) {
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
  console.log('shared scale', shared.toFixed(3));

  const results = {};
  for (const [k, prep] of Object.entries(preps)) {
    const bb = opaqueBBox(prep.data);
    const srcEyeY = bb.y0 + (bb.y1 - bb.y0) * 0.42;
    const srcMidX = (bb.x0 + bb.x1) / 2;
    const dstEyeY = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
    const dstMidX = W / 2;
    const ctx = createCanvas(W, H).getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.translate(dstMidX, dstEyeY);
    ctx.scale(shared, shared);
    ctx.translate(-srcMidX, -srcEyeY);
    ctx.drawImage(prep.canvas, 0, 0);
    const out = ctx.getImageData(0, 0, W, H);
    scrubGreenFringe(out.data);
    fillInteriorHoles(out.data);
    trimBottomWisps(out.data);
    hardenAlpha(out.data);
    results[k] = { canvas: canvasFromData(out), imageData: out };
    console.log(k, 'mid', spanAtY(out.data, 0.55)?.toFixed(3));
  }
  return results;
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

const defImg = await loadImage(DEF);
const defCtx = createCanvas(W, H).getContext('2d');
defCtx.drawImage(defImg, 0, 0, W, H);
const defSpan = spanAtY(defCtx.getImageData(0, 0, W, H).data, 0.55);

console.log('Preparing King from king11 sources…');
const preps = {
  clean: prepare(await loadImage(path.join(ART, 'king11-clean.png'))),
  ooh: prepare(await loadImage(path.join(ART, 'king11-ooh.png'))),
  ko: prepare(await loadImage(path.join(ART, 'king11-ko.png'))),
};
const out = alignShared(preps, defSpan);
writePng(path.join(CHAR, 'clean.png'), out.clean.canvas);
writePng(path.join(CHAR, 'ooh.png'), out.ooh.canvas);
writePng(path.join(CHAR, 'knockout.png'), out.ko.canvas);
writePng(path.join(ART, 'king-chin-fixed-clean.png'), out.clean.canvas);
await bakeDamage(CHAR, out.clean.canvas, out.ko.canvas);
mirrorBobo(CHAR);
console.log('King chin fix complete');
