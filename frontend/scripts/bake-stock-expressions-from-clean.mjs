/**
 * Premade boxers: copy clean twice and paint expressions in-place.
 *
 *   ooh.png      — same face; mouth → O; eyes → popping out
 *   knockout.png — same face; mouth → sad; eyes → closed
 *
 * Outline stays identical to clean. Photo faces are not touched.
 * Stars for KO are added at runtime (do not bake stars into the PNG).
 *
 *   node scripts/bake-stock-expressions-from-clean.mjs
 *   node scripts/bake-stock-expressions-from-clean.mjs --ids=default,bozza
 */
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { W, H, isIris, lum } from './lib/faceDamageBake.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAR_ROOT = path.resolve(__dirname, '../public/faces/characters');
const ALPHA = 40;

/** Canonical feature fractions inside the opaque face bbox (not full canvas). */
const FACE_LM = {
  // Eyes sit mid-upper face; bbox often includes neck.
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
  if (lum(r, g, b) < 40 || lum(r, g, b) > 245) return false;
  if (Math.max(r, g, b) < 55) return false;
  // Accept light–deep skin and warm cheek tones; reject pure blue/green iris.
  if (b > r + 35 && b > g + 20) return false;
  if (g > r + 25 && g > b + 25) return false;
  return r > 55 && g > 35 && b > 20;
}

function isToothish(r, g, b) {
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return r > 185 && g > 180 && b > 165 && chroma < 50;
}

function isMouthCavity(r, g, b) {
  return Math.max(r, g, b) < 70;
}

function isLipish(r, g, b, skin) {
  if (r > skin[0] + 12 && r > g + 18 && r > b + 12) return true;
  if (lum(r, g, b) < 95 && r > g && r > b) return true;
  return false;
}

function isDarkLine(r, g, b) {
  return Math.max(r, g, b) < 110;
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
  const fw = bb.x1 - bb.x0;
  const fh = bb.y1 - bb.y0;
  return { x: bb.x0 + fw * frac.x, y: bb.y0 + fh * frac.y };
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
    { x: mouth.x - 0.12 * W, y: mouth.y - 0.06 * H },
    { x: mouth.x + 0.12 * W, y: mouth.y - 0.06 * H },
    { x: mouth.x - 0.16 * W, y: mouth.y },
    { x: mouth.x + 0.16 * W, y: mouth.y },
    { x: mouth.x, y: mouth.y - 0.1 * H },
  ];
  let sr = 0,
    sg = 0,
    sb = 0,
    n = 0;
  for (const p of pts) {
    const s = sampleAround(data, p.x, p.y, 22, isSkinish);
    if (!s) continue;
    sr += s[0];
    sg += s[1];
    sb += s[2];
    n++;
  }
  if (n) return [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)];
  return (
    sampleAround(data, facePoint(bb, FACE_LM.philtrum).x, facePoint(bb, FACE_LM.philtrum).y, 40, isSkinish) || [
      210, 160, 130,
    ]
  );
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
    // Reject forehead / ear / hair false positives far from the expected eye column.
    if (Math.abs(mx - seedX) > 0.11 * W) return null;
    if (Math.abs(my - expectedY) > 0.14 * H) return null;
    const tight = pts.filter(([x, y]) => Math.hypot(x - mx, y - my) < 0.055 * W);
    const use = tight.length >= 12 ? tight : pts.filter(([x, y]) => Math.abs(x - mx) < 0.07 * W);
    if (use.length < 12) return null;
    let sx = 0,
      sy = 0,
      ir = 0,
      ig = 0,
      ib = 0;
    let maxD = 0;
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
      n,
    };
  }

  let right = cluster(rightPts, reSeedX);
  let left = cluster(leftPts, leSeedX);

  // If only one side is confident, mirror its Y onto the missing side.
  if (right && left && Math.abs(right.cy - left.cy) > 0.07 * H) {
    // Prefer the cluster closer to expectedY (male-boxer right side often polluted).
    if (Math.abs(right.cy - expectedY) <= Math.abs(left.cy - expectedY)) {
      left = { ...left, cy: right.cy };
    } else {
      right = { ...right, cy: left.cy };
    }
  }

  const fallback = (seedX, other) => ({
    cx: seedX,
    cy: other?.cy ?? expectedY,
    r: 0.034 * W,
    irisRgb: other?.irisRgb ?? [45, 95, 55],
    n: 0,
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
  const x0 = bb.x0 + (bb.x1 - bb.x0) * 0.22;
  const x1 = bb.x0 + (bb.x1 - bb.x0) * 0.78;
  for (let y = Math.floor(y0); y < Math.floor(y1); y++) {
    for (let x = Math.floor(x0); x < Math.floor(x1); x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 200) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (isToothish(r, g, b)) teeth.push([x, y]);
      else if (isMouthCavity(r, g, b)) dark.push([x, y]);
    }
  }
  const seed = facePoint(bb, FACE_LM.mouth);
  // Prefer teeth only when the blob sits in the lower face near the mouth seed.
  let pts = null;
  if (teeth.length >= 40) {
    let sy = 0;
    for (const [, y] of teeth) sy += y;
    const ty = sy / teeth.length;
    if (ty >= bb.y0 + (bb.y1 - bb.y0) * 0.55) pts = teeth;
  }
  if (!pts && dark.length >= 40) pts = dark;
  if (!pts) {
    return { x: seed.x, y: seed.y, rx: 0.2 * W, ry: 0.1 * H };
  }
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
  // Lock mouth into the lower-face band so false positives can't climb onto the nose/eyes.
  const minMouthY = bb.y0 + (bb.y1 - bb.y0) * 0.58;
  const maxMouthY = bb.y0 + (bb.y1 - bb.y0) * 0.82;
  cy = Math.max(minMouthY, Math.min(maxMouthY, cy));
  if (Math.abs(cx - seed.x) > 0.1 * W) cx = seed.x;
  const rx = Math.max(0.18 * W, Math.min(0.26 * W, ((maxX - minX) / 2) * 1.7));
  const ry = Math.max(0.09 * H, Math.min(0.13 * H, ((maxY - minY) / 2) * 1.8));
  return { x: cx, y: cy, rx, ry };
}

/**
 * Cover the smile completely with skin (texture-cloned from above the mouth
 * when possible). Elliptical only — never a rectangular wipe.
 */
function coverMouthPlate(data, skin, mouth) {
  const { x: mx, y: my, rx, ry } = mouth;
  const coverRx = Math.max(rx, 0.26 * W);
  const coverRy = Math.max(ry, 0.12 * H);

  for (let y = Math.floor(my - coverRy); y <= Math.ceil(my + coverRy); y++) {
    for (let x = Math.floor(mx - coverRx); x <= Math.ceil(mx + coverRx); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const nx = (x - mx) / coverRx;
      const ny = (y - my) / coverRy;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA) continue;

      const srcX = Math.round(mx + (x - mx) * 0.2);
      const srcY = Math.round(my - coverRy * 1.15 - Math.abs(y - my) * 0.05);
      let fill = skin;
      if (srcX >= 0 && srcY >= 0 && srcX < W && srcY < H) {
        const si = (srcY * W + srcX) * 4;
        if (
          data[si + 3] >= 180 &&
          isSkinish(data[si], data[si + 1], data[si + 2]) &&
          !isToothish(data[si], data[si + 1], data[si + 2]) &&
          !isMouthCavity(data[si], data[si + 1], data[si + 2]) &&
          !isDarkLine(data[si], data[si + 1], data[si + 2])
        ) {
          fill = [data[si], data[si + 1], data[si + 2]];
        }
      }

      const edge = d2 > 0.85 ? (1 - d2) / 0.15 : 1;
      const t = Math.max(0, Math.min(1, edge));
      data[i] = Math.round(data[i] * (1 - t) + fill[0] * t);
      data[i + 1] = Math.round(data[i + 1] * (1 - t) + fill[1] * t);
      data[i + 2] = Math.round(data[i + 2] * (1 - t) + fill[2] * t);
      data[i + 3] = 255;
    }
  }

  // Kill leftover teeth / black grin strokes inside a slightly larger ellipse.
  for (let y = Math.floor(my - coverRy * 1.12); y <= Math.ceil(my + coverRy * 1.12); y++) {
    for (let x = Math.floor(mx - coverRx * 1.2); x <= Math.ceil(mx + coverRx * 1.2); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const nx = (x - mx) / (coverRx * 1.2);
      const ny = (y - my) / (coverRy * 1.12);
      if (nx * nx + ny * ny > 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (isToothish(r, g, b) || isMouthCavity(r, g, b) || isDarkLine(r, g, b) || isLipish(r, g, b, skin)) {
        data[i] = skin[0];
        data[i + 1] = skin[1];
        data[i + 2] = skin[2];
        data[i + 3] = 255;
      }
    }
  }
}

function paintOohMouth(ctx, mx, my, skin) {
  const lip = [
    Math.min(255, Math.round(skin[0] * 0.82 + 45)),
    Math.max(35, Math.round(skin[1] * 0.5)),
    Math.max(35, Math.round(skin[2] * 0.45)),
  ];
  const lipDark = [Math.max(25, lip[0] - 55), Math.max(15, lip[1] - 50), Math.max(15, lip[2] - 45)];

  ctx.fillStyle = `rgb(${lip.join(',')})`;
  ctx.beginPath();
  ctx.ellipse(mx, my + 2, 0.055 * W, 0.07 * H, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgb(${lipDark.join(',')})`;
  ctx.beginPath();
  ctx.ellipse(mx, my + 4, 0.036 * W, 0.05 * H, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0c0604';
  ctx.beginPath();
  ctx.ellipse(mx, my + 6, 0.025 * W, 0.036 * H, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgb(${Math.min(255, skin[0] + 40)},${Math.max(30, skin[1] - 60)},${Math.max(30, skin[2] - 40)})`;
  ctx.beginPath();
  ctx.ellipse(mx, my + 0.028 * H, 0.014 * W, 0.011 * H, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintPopEyes(ctx, left, right, skin) {
  const skinDark = [
    Math.max(0, skin[0] - 55),
    Math.max(0, skin[1] - 60),
    Math.max(0, skin[2] - 55),
  ];
  const dist = Math.hypot(right.cx - left.cx, right.cy - left.cy);
  const fullR = Math.min(
    Math.max(left.r, right.r, 0.032 * W) * 2.2,
    Math.max(20, dist / 2 - Math.max(6, dist * 0.08))
  );
  const popR = Math.max(16, fullR);
  const sockR = Math.max(8, popR * 0.3);

  const paintOne = (eye, outward) => {
    const cx = eye.cx;
    const cy = eye.cy;
    const ex = cx;
    const ey = cy - popR * 0.2;

    // Cover original eye / lid / lens so it doesn't peek around the sphere
    ctx.fillStyle = `rgb(${skin.join(',')})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(sockR * 2.2, eye.r * 2.4, 0.06 * W), Math.max(sockR * 1.8, eye.r * 2.0, 0.045 * H), 0, 0, Math.PI * 2);
    ctx.fill();

    const socketGrad = ctx.createRadialGradient(cx, cy - sockR * 0.2, 0, cx, cy, sockR * 1.25);
    socketGrad.addColorStop(0, `rgba(${skinDark.join(',')},0.95)`);
    socketGrad.addColorStop(0.55, `rgba(${skinDark.join(',')},0.7)`);
    socketGrad.addColorStop(1, `rgba(${skin.join(',')},0)`);
    ctx.fillStyle = socketGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, sockR * 1.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(18, 8, 10, 0.88)';
    ctx.beginPath();
    ctx.arc(cx, cy, sockR * 0.72, 0, Math.PI * 2);
    ctx.fill();

    // Spring stalks
    ctx.strokeStyle = 'rgba(90, 55, 58, 0.75)';
    ctx.lineWidth = Math.max(1.5, popR * 0.05);
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * sockR * 0.25, cy);
      for (let i = 1; i <= 5; i++) {
        const t = i / 5;
        const wx = Math.sin(t * Math.PI * 5) * sockR * 0.22 * side;
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
    sphere.addColorStop(0.35, '#f7f3ea');
    sphere.addColorStop(0.7, '#e4dbcf');
    sphere.addColorStop(1, '#a89e92');
    ctx.fillStyle = sphere;
    ctx.beginPath();
    ctx.arc(ex, ey, popR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(45, 32, 36, 0.45)';
    ctx.lineWidth = Math.max(1.2, popR * 0.03);
    ctx.beginPath();
    ctx.arc(ex, ey, popR, 0, Math.PI * 2);
    ctx.stroke();

    const irisR = popR * 0.42;
    const [ir, ig, ib] = eye.irisRgb;
    const irisGrad = ctx.createRadialGradient(ex - irisR * 0.2, ey - irisR * 0.25, 0, ex, ey, irisR);
    irisGrad.addColorStop(
      0,
      `rgb(${Math.min(255, ir + 40)},${Math.min(255, ig + 30)},${Math.min(255, ib + 20)})`
    );
    irisGrad.addColorStop(0.65, `rgb(${ir},${ig},${ib})`);
    irisGrad.addColorStop(
      1,
      `rgb(${Math.max(0, ir - 35)},${Math.max(0, ig - 30)},${Math.max(0, ib - 25)})`
    );
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(ex, ey, irisR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0a0608';
    ctx.beginPath();
    ctx.arc(ex, ey, irisR * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(ex - popR * 0.28, ey - popR * 0.32, popR * 0.12, 0, Math.PI * 2);
    ctx.fill();
  };

  paintOne(left, -1);
  paintOne(right, 1);
}

function fillEllipseOpaque(data, cx, cy, rx, ry, rgb) {
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
      if (data[i + 3] < ALPHA) continue;
      const edge = d2 > 0.78 ? (1 - d2) / 0.22 : 1;
      const t = Math.max(0, Math.min(1, edge));
      data[i] = Math.round(data[i] * (1 - t) + rgb[0] * t);
      data[i + 1] = Math.round(data[i + 1] * (1 - t) + rgb[1] * t);
      data[i + 2] = Math.round(data[i + 2] * (1 - t) + rgb[2] * t);
      data[i + 3] = 255;
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
  ctx.lineWidth = Math.max(2.5, halfW * 0.08);
  ctx.beginPath();
  ctx.moveTo(cx - halfW * 0.92, cy - halfW * 0.12);
  ctx.quadraticCurveTo(cx, cy - halfW * 0.38, cx + halfW * 0.92, cy - halfW * 0.12);
  ctx.stroke();
}

/** Sad frown ∩: corners low, middle high (screen Y grows downward). */
function strokeSadMouth(ctx, cx, cy, halfW, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  // Filled ∩ banana — corners down, arch up.
  ctx.moveTo(cx - halfW, cy + halfW * 0.35);
  ctx.quadraticCurveTo(cx, cy - halfW * 0.55, cx + halfW, cy + halfW * 0.35);
  ctx.quadraticCurveTo(cx, cy - halfW * 0.15, cx - halfW, cy + halfW * 0.35);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(6, halfW * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - halfW, cy + halfW * 0.32);
  ctx.quadraticCurveTo(cx, cy - halfW * 0.5, cx + halfW, cy + halfW * 0.32);
  ctx.stroke();
  ctx.restore();
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
  return { canvas, ctx, imageData, cleanAlpha: new Uint8ClampedArray(imageData.data) };
}

function detectFeatures(data) {
  const bb = opaqueBBox(data);
  if (!bb) throw new Error('empty face');
  const { left, right } = findEyes(data, bb);
  const mouth = detectMouth(data, bb);
  const skin = sampleSkin(data, bb, mouth);
  return { bb, left, right, mouth, skin };
}

function bakeOoh(clean) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(clean.canvas, 0, 0);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  const { left, right, mouth, skin } = detectFeatures(d);

  coverMouthPlate(d, skin, mouth);
  ctx.putImageData(id, 0, 0);
  paintOohMouth(ctx, mouth.x, mouth.y, skin);
  paintPopEyes(ctx, left, right, skin);

  const final = ctx.getImageData(0, 0, W, H);
  maskToClean(final.data, clean.cleanAlpha);
  ctx.putImageData(final, 0, 0);
  return canvas;
}

function bakeKo(clean) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(clean.canvas, 0, 0);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  const { left, right, mouth, skin } = detectFeatures(d);
  const lid = [
    Math.min(255, skin[0] + 8),
    Math.min(255, skin[1] + 4),
    Math.min(255, skin[2]),
  ];
  const line = [48, 28, 22];

  for (const eye of [right, left]) {
    // Large opaque lids so iris/sclera (and glasses lenses) disappear.
    const rx = Math.max(0.075 * W, eye.r * 2.6);
    const ry = Math.max(0.055 * H, eye.r * 2.0);
    fillEllipseOpaque(d, eye.cx, eye.cy, rx, ry, lid);
    fillEllipseOpaque(d, eye.cx, eye.cy + 4, rx * 0.95, ry * 0.9, lid);
    fillEllipseOpaque(d, eye.cx, eye.cy - 5, rx * 0.9, ry * 0.75, lid);
    // Kill leftover bright sclera / iris pixels inside the lid.
    for (let y = Math.floor(eye.cy - ry); y <= Math.ceil(eye.cy + ry); y++) {
      for (let x = Math.floor(eye.cx - rx); x <= Math.ceil(eye.cx + rx); x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const nx = (x - eye.cx) / rx;
        const ny = (y - eye.cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const i = (y * W + x) * 4;
        if (d[i + 3] < ALPHA) continue;
        const r = d[i],
          g = d[i + 1],
          b = d[i + 2];
        if (isIris(r, g, b) || lum(r, g, b) > 200 || lum(r, g, b) < 55) {
          d[i] = lid[0];
          d[i + 1] = lid[1];
          d[i + 2] = lid[2];
          d[i + 3] = 255;
        }
      }
    }
  }

  coverMouthPlate(d, skin, mouth);
  ctx.putImageData(id, 0, 0);

  const eyeHW = Math.max(0.055 * W, right.r * 1.5, left.r * 1.5);
  strokeClosedEye(ctx, right.cx, right.cy, eyeHW, `rgb(${line.join(',')})`);
  strokeClosedEye(ctx, left.cx, left.cy, eyeHW, `rgb(${line.join(',')})`);
  // Keep frown narrower than the plate so it reads as sad, not a wide grin outline.
  strokeSadMouth(ctx, mouth.x, mouth.y + 6, 0.095 * W, `rgb(${line.join(',')})`);

  const final = ctx.getImageData(0, 0, W, H);
  maskToClean(final.data, clean.cleanAlpha);
  ctx.putImageData(final, 0, 0);
  return canvas;
}

async function processPack(id) {
  const root = path.join(CHAR_ROOT, id);
  if (!fs.existsSync(path.join(root, 'clean.png'))) {
    console.log(id, 'skip');
    return;
  }
  const clean = await loadClean(id);
  const ooh = bakeOoh(clean);
  const ko = bakeKo(clean);

  writePng(path.join(root, 'ooh.png'), ooh);
  writePng(path.join(root, 'knockout.png'), ko);
  writePng(path.join(root, 'damage-stages', '10-knockout.png'), ko);

  const clown = path.join(root, 'bobo-clown-stages');
  if (fs.existsSync(clown)) {
    writePng(path.join(clown, 'ooh.png'), ooh);
    writePng(path.join(clown, 'knockout-clean.png'), ko);
    writePng(path.join(clown, '10-knockout.png'), ko);
  }
  console.log(id, 'ooh + knockout from clean');
}

const only = parseIds();
const ids = (
  only ||
  fs.readdirSync(CHAR_ROOT).filter((d) => fs.statSync(path.join(CHAR_ROOT, d)).isDirectory())
).sort();

console.log('Baking premade expressions from clean copies…');
for (const id of ids) await processPack(id);
console.log('Done');
