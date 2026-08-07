/**
 * Premade boxers: copy clean TWICE and EDIT features in-place.
 *
 *   ooh.png      — erase smile → O mouth; erase open eyes → popping eyes
 *   knockout.png — erase smile → sad mouth; erase open eyes → closed lids
 *
 * Never layers onto an existing ooh/KO. Always starts from clean.png.
 * Outline stays identical to clean. Photo faces are not touched.
 *
 *   node scripts/bake-stock-expressions-from-clean.mjs
 *   node scripts/bake-stock-expressions-from-clean.mjs --ids=default,bozza
 */
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { W, H, isIris, isSclera, lum } from './lib/faceDamageBake.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAR_ROOT = path.resolve(__dirname, '../public/faces/characters');
const ALPHA = 40;

/** Feature fractions inside the opaque face bbox. */
const FACE_LM = {
  rightEye: { x: 0.38, y: 0.38 },
  leftEye: { x: 0.62, y: 0.38 },
  mouth: { x: 0.5, y: 0.68 },
  philtrum: { x: 0.5, y: 0.56 },
};

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
  if (lum(r, g, b) < 35 || lum(r, g, b) > 248) return false;
  if (Math.max(r, g, b) < 50) return false;
  if (b > r + 40 && b > g + 25) return false;
  if (g > r + 30 && g > b + 30) return false;
  return r > 50 && g > 30 && b > 18;
}

function isToothish(r, g, b) {
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return r > 185 && g > 180 && b > 165 && chroma < 50;
}

function isMouthCavity(r, g, b) {
  // Open-mouth black only — not brown stubble / nostril shadow.
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max >= 50) return false;
  return max - min < 22;
}

function isLipish(r, g, b, skin) {
  // Very tight: saturated lip red, not a red nose tip.
  if (r > 140 && r > skin[0] + 35 && r > g + 40 && r > b + 35 && lum(r, g, b) < 150) return true;
  return false;
}

function isDarkLine(r, g, b) {
  return Math.max(r, g, b) < 115;
}

function opaqueBBox(data) {
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

function facePoint(bb, frac) {
  return {
    x: bb.x0 + (bb.x1 - bb.x0) * frac.x,
    y: bb.y0 + (bb.y1 - bb.y0) * frac.y,
  };
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

function sampleSkin(data, bb, mouth) {
  const pts = [
    facePoint(bb, FACE_LM.philtrum),
    { x: mouth.x - 0.1 * W, y: mouth.y - 0.08 * H },
    { x: mouth.x + 0.1 * W, y: mouth.y - 0.08 * H },
    { x: mouth.x - 0.14 * W, y: mouth.y - 0.02 * H },
    { x: mouth.x + 0.14 * W, y: mouth.y - 0.02 * H },
    { x: mouth.x, y: mouth.y - 0.12 * H },
  ];
  let sr = 0,
    sg = 0,
    sb = 0,
    n = 0;
  for (const p of pts) {
    const s = sampleAround(data, p.x, p.y, 20, isSkinish);
    if (!s) continue;
    sr += s[0];
    sg += s[1];
    sb += s[2];
    n++;
  }
  if (n) return [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)];
  return [210, 160, 130];
}

function findEyes(data, bb) {
  const fh = bb.y1 - bb.y0;
  const fw = bb.x1 - bb.x0;
  const mid = (bb.x0 + bb.x1) / 2;
  const expectedY = bb.y0 + fh * 0.38;
  const reSeedX = bb.x0 + fw * FACE_LM.rightEye.x;
  const leSeedX = bb.x0 + fw * FACE_LM.leftEye.x;

  const leftPts = [];
  const rightPts = [];
  for (let y = Math.floor(bb.y0 + fh * 0.16); y < Math.floor(bb.y0 + fh * 0.52); y++) {
    for (let x = Math.floor(bb.x0 + fw * 0.14); x < Math.floor(bb.x0 + fw * 0.86); x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 200) continue;
      if (!isIris(data[i], data[i + 1], data[i + 2])) continue;
      (x < mid ? rightPts : leftPts).push([x, y]);
    }
  }

  function cluster(pts, seedX) {
    if (pts.length < 18) return null;
    const xs = pts.map((p) => p[0]).sort((a, b) => a - b);
    const ys = pts.map((p) => p[1]).sort((a, b) => a - b);
    const mx = xs[(xs.length / 2) | 0];
    const my = ys[(ys.length / 2) | 0];
    if (Math.abs(mx - seedX) > 0.11 * W) return null;
    if (Math.abs(my - expectedY) > 0.14 * H) return null;
    const tight = pts.filter(([x, y]) => Math.hypot(x - mx, y - my) < 0.055 * W);
    const use = tight.length >= 12 ? tight : pts.filter(([x, y]) => Math.abs(x - mx) < 0.07 * W);
    if (use.length < 12) return null;
    let sx = 0,
      sy = 0,
      ir = 0,
      ig = 0,
      ib = 0,
      maxD = 0;
    for (const [x, y] of use) {
      sx += x;
      sy += y;
      maxD = Math.max(maxD, Math.hypot(x - mx, y - my));
      const i = (y * W + x) * 4;
      ir += data[i];
      ig += data[i + 1];
      ib += data[i + 2];
    }
    const n = use.length;
    return {
      cx: sx / n,
      cy: sy / n,
      r: Math.max(0.028 * W, Math.min(0.04 * W, maxD * 0.7 || 0.032 * W)),
      irisRgb: [Math.round(ir / n), Math.round(ig / n), Math.round(ib / n)],
    };
  }

  let right = cluster(rightPts, reSeedX);
  let left = cluster(leftPts, leSeedX);
  if (right && left && Math.abs(right.cy - left.cy) > 0.07 * H) {
    if (Math.abs(right.cy - expectedY) <= Math.abs(left.cy - expectedY)) left = { ...left, cy: right.cy };
    else right = { ...right, cy: left.cy };
  }
  const fallback = (seedX, other) => ({
    cx: seedX,
    cy: other?.cy ?? expectedY,
    r: 0.034 * W,
    irisRgb: other?.irisRgb ?? [45, 95, 55],
  });
  if (!right) right = fallback(reSeedX, left);
  if (!left) left = fallback(leSeedX, right);
  return { left, right };
}

function detectMouth(data, bb) {
  const teeth = [];
  const dark = [];
  const y0 = bb.y0 + (bb.y1 - bb.y0) * 0.55;
  const y1 = bb.y0 + (bb.y1 - bb.y0) * 0.88;
  const x0 = bb.x0 + (bb.x1 - bb.x0) * 0.2;
  const x1 = bb.x0 + (bb.x1 - bb.x0) * 0.8;
  for (let y = Math.floor(y0); y < Math.floor(y1); y++) {
    for (let x = Math.floor(x0); x < Math.floor(x1); x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 200) continue;
      if (isToothish(data[i], data[i + 1], data[i + 2])) teeth.push([x, y]);
      else if (isMouthCavity(data[i], data[i + 1], data[i + 2])) dark.push([x, y]);
    }
  }
  const seed = facePoint(bb, FACE_LM.mouth);
  let pts = null;
  if (teeth.length >= 40) {
    let sy = 0;
    for (const [, y] of teeth) sy += y;
    if (sy / teeth.length >= bb.y0 + (bb.y1 - bb.y0) * 0.55) pts = teeth;
  }
  if (!pts && dark.length >= 40) pts = dark;
  if (!pts) return { x: seed.x, y: seed.y, rx: 0.2 * W, ry: 0.1 * H };

  let sx = 0,
    sy = 0,
    minX = W,
    maxX = 0,
    minY = H,
    maxY = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  let cx = sx / pts.length;
  let cy = sy / pts.length;
  cy = Math.max(bb.y0 + (bb.y1 - bb.y0) * 0.58, Math.min(bb.y0 + (bb.y1 - bb.y0) * 0.82, cy));
  if (Math.abs(cx - seed.x) > 0.1 * W) cx = seed.x;
  const rx = Math.max(0.14 * W, Math.min(0.22 * W, ((maxX - minX) / 2) * 1.45));
  const ry = Math.max(0.07 * H, Math.min(0.1 * H, ((maxY - minY) / 2) * 1.4));
  return { x: cx, y: cy, rx, ry };
}

/** Dilate a binary mask (Uint8Array length W*H). */
function dilateMask(mask, radius) {
  const out = new Uint8Array(mask.length);
  const r = Math.max(1, radius | 0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          out[ny * W + nx] = 1;
        }
      }
    }
  }
  return out;
}

/**
 * Build a smile mask from teeth / cavity / lips — not stubble or face outline.
 * Dark grin strokes are only kept when they sit next to teeth/cavity.
 */
function buildSmileMask(data, mouth, skin) {
  const mask = new Uint8Array(W * H);
  const core = new Uint8Array(W * H);
  const { x: mx, y: my, rx, ry } = mouth;
  const searchRx = Math.max(rx * 1.25, 0.2 * W);
  const searchRy = Math.max(ry * 1.35, 0.11 * H);

  for (let y = Math.floor(my - searchRy); y <= Math.ceil(my + searchRy); y++) {
    for (let x = Math.floor(mx - searchRx); x <= Math.ceil(mx + searchRx); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      // Never erase the nose — keep mask below mid-philtrum.
      if (y < my - searchRy * 0.55) continue;
      const nx = (x - mx) / searchRx;
      const ny = (y - my) / searchRy;
      if (nx * nx + ny * ny > 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (isToothish(r, g, b) || isMouthCavity(r, g, b) || isLipish(r, g, b, skin)) {
        mask[y * W + x] = 1;
        core[y * W + x] = 1;
      }
    }
  }

  // Attach dark grin strokes only when they touch the tooth/cavity core.
  const coreDilated = dilateMask(core, 8);
  for (let y = Math.floor(my - searchRy * 0.35); y <= Math.ceil(my + searchRy); y++) {
    for (let x = Math.floor(mx - searchRx); x <= Math.ceil(mx + searchRx); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (!coreDilated[y * W + x]) continue;
      const nx = (x - mx) / searchRx;
      const ny = (y - my) / searchRy;
      if (nx * nx + ny * ny > 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA) continue;
      if (isDarkLine(data[i], data[i + 1], data[i + 2])) mask[y * W + x] = 1;
    }
  }
  return dilateMask(mask, 4);
}

/**
 * Always clear a soft eye-socket ellipse (iris detection can miss glasses /
 * dark eyes). Also tag iris/sclera pixels inside it.
 */
function buildEyeMask(data, eye) {
  const mask = new Uint8Array(W * H);
  const rx = Math.max(eye.r * 2.0, 0.05 * W);
  const ry = Math.max(eye.r * 1.55, 0.036 * H);
  for (let y = Math.floor(eye.cy - ry); y <= Math.ceil(eye.cy + ry); y++) {
    for (let x = Math.floor(eye.cx - rx); x <= Math.ceil(eye.cx + rx); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const nx = (x - eye.cx) / rx;
      const ny = (y - eye.cy) / ry;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      // Skip thick black glasses frames (keep the rims).
      const maxc = Math.max(r, g, b);
      if (maxc < 40 && d2 > 0.55) continue;
      if (isIris(r, g, b) || isSclera(r, g, b) || lum(r, g, b) < 60 || d2 < 0.72) {
        mask[y * W + x] = 1;
      }
    }
  }
  return dilateMask(mask, 3);
}

/**
 * Erase smile by cloning skin from above/cheeks into masked smile pixels.
 * Preserves local texture instead of flooding a flat plate.
 */
function eraseSmile(data, mouth, skin) {
  const mask = buildSmileMask(data, mouth, skin);
  const { x: mx, y: my, ry } = mouth;
  const src = new Uint8ClampedArray(data);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA) continue;

      // Prefer philtrum / upper-lip band, pulled slightly toward face center.
      const candidates = [
        [Math.round(mx + (x - mx) * 0.25), Math.round(my - ry * 1.35 - Math.abs(y - my) * 0.15)],
        [Math.round(mx + (x - mx) * 0.45), Math.round(y - ry * 1.1)],
        [Math.round(x), Math.round(my - ry * 1.5)],
        [Math.round(mx + (x < mx ? -1 : 1) * ry * 1.2), Math.round(my - ry * 0.4)],
      ];

      let filled = false;
      for (const [sx, sy] of candidates) {
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        if (mask[sy * W + sx]) continue;
        const si = (sy * W + sx) * 4;
        if (src[si + 3] < 180) continue;
        const r = src[si],
          g = src[si + 1],
          b = src[si + 2];
        if (!isSkinish(r, g, b)) continue;
        if (isToothish(r, g, b) || isMouthCavity(r, g, b) || isDarkLine(r, g, b)) continue;
        // Reject red-nose / cheek-blush samples that paint orange plates.
        if (r > skin[0] + 28 && r > g + 20) continue;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
        filled = true;
        break;
      }
      if (!filled) {
        data[i] = skin[0];
        data[i + 1] = skin[1];
        data[i + 2] = skin[2];
        data[i + 3] = 255;
      }
    }
  }

  // Second pass: kill any remaining teeth / open-mouth cavity only (not beard stubble).
  const searchRx = Math.max(mouth.rx * 1.2, 0.18 * W);
  const searchRy = Math.max(mouth.ry * 1.25, 0.1 * H);
  for (let y = Math.floor(my - searchRy); y <= Math.ceil(my + searchRy); y++) {
    for (let x = Math.floor(mx - searchRx); x <= Math.ceil(mx + searchRx); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const nx = (x - mx) / searchRx;
      const ny = (y - my) / searchRy;
      if (nx * nx + ny * ny > 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (isToothish(r, g, b) || isMouthCavity(r, g, b)) {
        data[i] = skin[0];
        data[i + 1] = skin[1];
        data[i + 2] = skin[2];
        data[i + 3] = 255;
      }
    }
  }

  // Final teeth sweep across the lower face (catches grin corners outside the oval).
  for (let y = Math.floor(my - 0.08 * H); y <= Math.ceil(my + 0.12 * H); y++) {
    for (let x = Math.floor(mx - 0.28 * W); x <= Math.ceil(mx + 0.28 * W); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA) continue;
      if (isToothish(data[i], data[i + 1], data[i + 2])) {
        data[i] = skin[0];
        data[i + 1] = skin[1];
        data[i + 2] = skin[2];
        data[i + 3] = 255;
      }
    }
  }
}

/** Erase open eyes via small-socket inpaint (keeps brows / glasses frames). */
function eraseEyes(data, left, right, skin) {
  const mask = orMasks(buildEyeMask(data, left), buildEyeMask(data, right));
  inpaintMask(data, mask, skin);
}

function inpaintMask(data, mask, fallbackSkin) {
  const work = new Uint8Array(mask);
  for (let pass = 0; pass < 22; pass++) {
    let changed = 0;
    const next = new Uint8Array(work);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x;
        if (!work[p]) continue;
        let sr = 0,
          sg = 0,
          sb = 0,
          n = 0;
        let srSkin = 0,
          sgSkin = 0,
          sbSkin = 0,
          nSkin = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx,
              ny = y + dy;
            const np = ny * W + nx;
            if (work[np]) continue;
            const i = np * 4;
            if (data[i + 3] < 180) continue;
            const r = data[i],
              g = data[i + 1],
              b = data[i + 2];
            if (isToothish(r, g, b) || isMouthCavity(r, g, b)) continue;
            sr += r;
            sg += g;
            sb += b;
            n++;
            if (isSkinish(r, g, b)) {
              srSkin += r;
              sgSkin += g;
              sbSkin += b;
              nSkin++;
            }
          }
        }
        const i = p * 4;
        if (nSkin >= 2) {
          data[i] = Math.round(srSkin / nSkin);
          data[i + 1] = Math.round(sgSkin / nSkin);
          data[i + 2] = Math.round(sbSkin / nSkin);
          data[i + 3] = 255;
          next[p] = 0;
          changed++;
        } else if (n > 0) {
          data[i] = Math.round(sr / n);
          data[i + 1] = Math.round(sg / n);
          data[i + 2] = Math.round(sb / n);
          data[i + 3] = 255;
          next[p] = 0;
          changed++;
        } else if (pass > 12) {
          data[i] = fallbackSkin[0];
          data[i + 1] = fallbackSkin[1];
          data[i + 2] = fallbackSkin[2];
          data[i + 3] = 255;
          next[p] = 0;
          changed++;
        }
      }
    }
    work.set(next);
    if (!changed) break;
  }
  for (let p = 0; p < work.length; p++) {
    if (!work[p]) continue;
    const i = p * 4;
    data[i] = fallbackSkin[0];
    data[i + 1] = fallbackSkin[1];
    data[i + 2] = fallbackSkin[2];
    data[i + 3] = 255;
  }
}

/** Softly blend a small O mouth into the (already erased) mouth area. */
function paintOohMouth(ctx, mx, my, skin) {
  const lip = [
    Math.min(255, Math.round(skin[0] * 0.75 + 50)),
    Math.max(30, Math.round(skin[1] * 0.45)),
    Math.max(30, Math.round(skin[2] * 0.4)),
  ];
  ctx.save();
  ctx.fillStyle = `rgb(${lip.join(',')})`;
  ctx.beginPath();
  ctx.ellipse(mx, my + 2, 0.048 * W, 0.062 * H, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a0504';
  ctx.beginPath();
  ctx.ellipse(mx, my + 5, 0.03 * W, 0.042 * H, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(${Math.min(255, skin[0] + 30)},${Math.max(25, skin[1] - 50)},${Math.max(25, skin[2] - 35)},0.85)`;
  ctx.beginPath();
  ctx.ellipse(mx, my + 0.028 * H, 0.012 * W, 0.009 * H, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Sad ∩ frown painted into the erased mouth area. */
function paintSadMouth(ctx, mx, my, skin) {
  const line = [
    Math.max(20, Math.round(skin[0] * 0.25)),
    Math.max(12, Math.round(skin[1] * 0.18)),
    Math.max(10, Math.round(skin[2] * 0.15)),
  ];
  const halfW = 0.09 * W;
  ctx.save();
  ctx.strokeStyle = `rgb(${line.join(',')})`;
  ctx.lineWidth = Math.max(5, halfW * 0.14);
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Corners low, middle high → sad ∩
  ctx.moveTo(mx - halfW, my + halfW * 0.28);
  ctx.quadraticCurveTo(mx, my - halfW * 0.48, mx + halfW, my + halfW * 0.28);
  ctx.stroke();
  ctx.restore();
}

function paintPopEyes(ctx, left, right, skin) {
  const skinDark = [
    Math.max(0, skin[0] - 50),
    Math.max(0, skin[1] - 55),
    Math.max(0, skin[2] - 50),
  ];
  const dist = Math.hypot(right.cx - left.cx, right.cy - left.cy);
  const fullR = Math.min(
    Math.max(left.r, right.r, 0.03 * W) * 2.15,
    Math.max(18, dist / 2 - Math.max(6, dist * 0.08))
  );
  const popR = Math.max(16, fullR);
  const sockR = Math.max(7, popR * 0.28);

  const paintOne = (eye, outward) => {
    const cx = eye.cx;
    const cy = eye.cy;
    const ex = cx;
    const ey = cy - popR * 0.18;

    // Socket recess (original eye already inpainted away)
    ctx.fillStyle = `rgb(${skin.join(',')})`;
    ctx.beginPath();
    ctx.arc(cx, cy, sockR * 1.35, 0, Math.PI * 2);
    ctx.fill();
    const socketGrad = ctx.createRadialGradient(cx, cy - sockR * 0.2, 0, cx, cy, sockR * 1.15);
    socketGrad.addColorStop(0, `rgba(${skinDark.join(',')},0.92)`);
    socketGrad.addColorStop(0.6, `rgba(${skinDark.join(',')},0.55)`);
    socketGrad.addColorStop(1, `rgba(${skin.join(',')},0)`);
    ctx.fillStyle = socketGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, sockR * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(18, 8, 10, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, sockR * 0.65, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(90, 55, 58, 0.7)';
    ctx.lineWidth = Math.max(1.4, popR * 0.045);
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * sockR * 0.2, cy);
      for (let i = 1; i <= 5; i++) {
        const t = i / 5;
        const wx = Math.sin(t * Math.PI * 5) * sockR * 0.2 * side;
        ctx.lineTo(cx + (ex - cx) * t + wx + outward * popR * 0.02 * t, cy + (ey - cy) * t);
      }
      ctx.stroke();
    }

    const sphere = ctx.createRadialGradient(
      ex - popR * 0.35,
      ey - popR * 0.4,
      popR * 0.05,
      ex,
      ey,
      popR
    );
    sphere.addColorStop(0, '#ffffff');
    sphere.addColorStop(0.4, '#f5f0e6');
    sphere.addColorStop(0.75, '#ddd4c8');
    sphere.addColorStop(1, '#a89e92');
    ctx.fillStyle = sphere;
    ctx.beginPath();
    ctx.arc(ex, ey, popR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(45, 32, 36, 0.4)';
    ctx.lineWidth = Math.max(1.1, popR * 0.03);
    ctx.beginPath();
    ctx.arc(ex, ey, popR, 0, Math.PI * 2);
    ctx.stroke();

    const irisR = popR * 0.4;
    const [ir, ig, ib] = eye.irisRgb;
    const irisGrad = ctx.createRadialGradient(ex - irisR * 0.2, ey - irisR * 0.25, 0, ex, ey, irisR);
    irisGrad.addColorStop(0, `rgb(${Math.min(255, ir + 35)},${Math.min(255, ig + 25)},${Math.min(255, ib + 18)})`);
    irisGrad.addColorStop(0.7, `rgb(${ir},${ig},${ib})`);
    irisGrad.addColorStop(1, `rgb(${Math.max(0, ir - 30)},${Math.max(0, ig - 25)},${Math.max(0, ib - 20)})`);
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(ex, ey, irisR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0608';
    ctx.beginPath();
    ctx.arc(ex, ey, irisR * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(ex - popR * 0.28, ey - popR * 0.32, popR * 0.11, 0, Math.PI * 2);
    ctx.fill();
  };

  paintOne(left, -1);
  paintOne(right, 1);
}

function paintClosedEyes(ctx, left, right, skin) {
  const line = [
    Math.max(22, Math.round(skin[0] * 0.28)),
    Math.max(14, Math.round(skin[1] * 0.2)),
    Math.max(12, Math.round(skin[2] * 0.16)),
  ];
  const hw = Math.max(0.045 * W, left.r * 1.35, right.r * 1.35);
  for (const eye of [left, right]) {
    ctx.strokeStyle = `rgb(${line.join(',')})`;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(4, hw * 0.15);
    ctx.beginPath();
    ctx.moveTo(eye.cx - hw, eye.cy);
    ctx.quadraticCurveTo(eye.cx, eye.cy + hw * 0.4, eye.cx + hw, eye.cy);
    ctx.stroke();
    ctx.lineWidth = Math.max(2.2, hw * 0.08);
    ctx.beginPath();
    ctx.moveTo(eye.cx - hw * 0.9, eye.cy - hw * 0.1);
    ctx.quadraticCurveTo(eye.cx, eye.cy - hw * 0.35, eye.cx + hw * 0.9, eye.cy - hw * 0.1);
    ctx.stroke();
  }
}

function orMasks(a, b) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] || b[i] ? 1 : 0;
  return out;
}

function maskToClean(outData, cleanData) {
  for (let i = 0; i < W * H; i++) {
    if (cleanData[i * 4 + 3] < ALPHA) {
      outData[i * 4] = 0;
      outData[i * 4 + 1] = 0;
      outData[i * 4 + 2] = 0;
      outData[i * 4 + 3] = 0;
    } else if (outData[i * 4 + 3] >= ALPHA) {
      outData[i * 4 + 3] = 255;
    }
  }
}

function writePng(file, canvas) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

async function loadClean(id) {
  const file = path.join(CHAR_ROOT, id, 'clean.png');
  const img = await loadImage(file);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const imageData = ctx.getImageData(0, 0, W, H);
  return { canvas, cleanAlpha: new Uint8ClampedArray(imageData.data) };
}

function detectFeatures(data) {
  const bb = opaqueBBox(data);
  if (!bb) throw new Error('empty face');
  const { left, right } = findEyes(data, bb);
  const mouth = detectMouth(data, bb);
  const skin = sampleSkin(data, bb, mouth);
  return { bb, left, right, mouth, skin };
}

/**
 * Copy clean → erase smile + open eyes → paint new expression.
 * Never reads existing ooh/knockout.
 */
function bakeFromClean(clean, mode) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(clean.canvas, 0, 0);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  const { left, right, mouth, skin } = detectFeatures(d);

  // 1) Edit the clean face: remove smile and open eyes (do not stamp plates).
  eraseSmile(d, mouth, skin);
  eraseEyes(d, left, right, skin);
  ctx.putImageData(id, 0, 0);

  // 2) Paint the new mouth / eyes into those edited regions.
  if (mode === 'ooh') {
    paintOohMouth(ctx, mouth.x, mouth.y, skin);
    paintPopEyes(ctx, left, right, skin);
  } else {
    paintSadMouth(ctx, mouth.x, mouth.y + 4, skin);
    paintClosedEyes(ctx, left, right, skin);
  }

  const final = ctx.getImageData(0, 0, W, H);
  maskToClean(final.data, clean.cleanAlpha);
  ctx.putImageData(final, 0, 0);
  return canvas;
}

async function processPack(id) {
  const root = path.join(CHAR_ROOT, id);
  const cleanPath = path.join(root, 'clean.png');
  if (!fs.existsSync(cleanPath)) {
    console.log(id, 'skip (no clean.png)');
    return;
  }
  // Always from clean — never from prior ooh/KO.
  const clean = await loadClean(id);
  const ooh = bakeFromClean(clean, 'ooh');
  const ko = bakeFromClean(clean, 'ko');

  writePng(path.join(root, 'ooh.png'), ooh);
  writePng(path.join(root, 'knockout.png'), ko);
  writePng(path.join(root, 'damage-stages', '10-knockout.png'), ko);

  const clown = path.join(root, 'bobo-clown-stages');
  if (fs.existsSync(clown)) {
    writePng(path.join(clown, 'ooh.png'), ooh);
    writePng(path.join(clown, 'knockout-clean.png'), ko);
    writePng(path.join(clown, '10-knockout.png'), ko);
  }
  console.log(id, 'rebaked from clean (ooh + knockout)');
}

const only = parseIds();
const ids = (
  only ||
  fs.readdirSync(CHAR_ROOT).filter((d) => fs.statSync(path.join(CHAR_ROOT, d)).isDirectory())
).sort();

console.log('Rebaking all premade expressions FROM CLEAN (edit, do not overlay)…');
for (const id of ids) await processPack(id);
console.log('Done');
