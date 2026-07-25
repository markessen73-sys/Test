/**
 * Bake cumulative damage-stage faces for the ring HUD.
 *
 * Replicates each original-boxer injury change on the photo caricature:
 * grow/recolor cauliflower ears, purple black-eye + lid droop, puffed lip,
 * missing tooth, swollen-shut eye, broken-nose cut, forehead bandage.
 *
 * Usage: node scripts/bake-damage-stage-faces.mjs
 */
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(__dirname, '../public/faces');
const OUT = path.join(BASE, 'damage-stages');
const W = 1024;
const H = 1024;

const LM = {
  rightEye: { x: 0.382, y: 0.459 },
  leftEye: { x: 0.595, y: 0.443 },
  nose: { x: 0.5, y: 0.52 },
  mouth: { x: 0.504, y: 0.665 },
  bottomLip: { x: 0.504, y: 0.715 },
  rightEar: { x: 0.162, y: 0.544, rx: 0.065, ry: 0.125 },
  leftEar: { x: 0.836, y: 0.536, rx: 0.065, ry: 0.125 },
  forehead: { x: 0.5, y: 0.295 },
};

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}
function mix(a, b, t) {
  return a * (1 - t) + b * t;
}
function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
function isBackdrop(r, g, b, a) {
  if (a < 20) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 22) return true;
  if (min > 232) return true;
  if (min > 200 && max - min < 14) return true;
  return false;
}
function isLineArt(r, g, b) {
  return Math.max(r, g, b) < 55;
}
function isIris(r, g, b) {
  return g > 70 && g >= r - 5 && g > b + 5;
}
function isSclera(r, g, b) {
  return r > 200 && g > 200 && b > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 30;
}
function isTooth(r, g, b) {
  return r > 195 && g > 195 && b > 185 && Math.max(r, g, b) - Math.min(r, g, b) < 45;
}
function isGlassesFrame(r, g, b, a) {
  return a > 200 && Math.max(r, g, b) < 48;
}
function isSkinTone(r, g, b, a) {
  if (a < 20 || isBackdrop(r, g, b, a) || isLineArt(r, g, b)) return false;
  if (isIris(r, g, b) || isTooth(r, g, b) || isSclera(r, g, b) || isGlassesFrame(r, g, b, a)) return false;
  if (r < 130 || g < 85 || b < 60 || r < g - 10) return false;
  return true;
}
function ellipseDist(nx, ny, cx, cy, rx, ry) {
  return Math.hypot((nx - cx) / rx, (ny - cy) / ry);
}
function softEdge(d, inner = 0.82) {
  if (d <= inner) return 1;
  if (d >= 1) return 0;
  // Smoothstep feather
  const t = (d - inner) / (1 - inner);
  return 1 - t * t * (3 - 2 * t);
}
function sampleBilinear(data, x, y) {
  x = Math.max(0, Math.min(W - 1.001, x));
  y = Math.max(0, Math.min(H - 1.001, y));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(W - 1, x0 + 1);
  const y1 = Math.min(H - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const i00 = (y0 * W + x0) * 4 + c;
    const i10 = (y0 * W + x1) * 4 + c;
    const i01 = (y1 * W + x0) * 4 + c;
    const i11 = (y1 * W + x1) * 4 + c;
    out[c] =
      data[i00] * (1 - tx) * (1 - ty) +
      data[i10] * tx * (1 - ty) +
      data[i01] * (1 - tx) * ty +
      data[i11] * tx * ty;
  }
  return out;
}

function copyImageData(src) {
  const out = createCanvas(W, H).getContext('2d').createImageData(W, H);
  out.data.set(src.data);
  return out;
}

/** Recolor a sample toward cauliflower tones, preserving shading structure. */
function toCauliflower(r, g, b) {
  const L = lum(r, g, b) / 255;
  // Continuous ramp (no banding): highlight → inflamed → bruise
  const cr = mix(145, 245, Math.pow(L, 0.85));
  const cg = mix(45, 165, Math.pow(L, 1.1));
  const cb = mix(70, 155, Math.pow(L, 1.05));
  // Push midtones toward male-like red/pink
  const mid = 1 - Math.abs(L - 0.55) * 1.6;
  return [
    mix(cr, 205, Math.max(0, mid) * 0.35),
    mix(cg, 90, Math.max(0, mid) * 0.35),
    mix(cb, 95, Math.max(0, mid) * 0.35),
  ];
}

/**
 * Cauliflower ear — same change as male: ear becomes a larger bulbous
 * inflamed mass (silhouette grows), not just a color tint.
 * Grow ~1.7× (male is ~2.5–3×; kept a bit smaller per request).
 */
function applyCauliflowerEar(face, clean, side) {
  const ear = side === 'left' ? LM.leftEar : LM.rightEar;
  const ax = side === 'left' ? ear.x - 0.05 : ear.x + 0.05;
  const ay = ear.y;
  const scale = 1.55;
  // Rounder bulb than the clean ear (male loses ear anatomy → lump).
  const rx = ear.rx * scale * 1.02;
  const ry = ear.ry * scale * 0.95;
  const cx = ear.x + (side === 'left' ? 0.018 : -0.018);
  const cy = ear.y - 0.015;
  let painted = 0;
  const solid = new Uint8Array(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      // Main bulb + secondary lump (male cauliflower is irregular).
      const dMain = ellipseDist(nx, ny, cx, cy, rx, ry);
      const lumpX = cx + (side === 'left' ? 0.03 : -0.03);
      const lumpY = cy - 0.05;
      const dLump = ellipseDist(nx, ny, lumpX, lumpY, rx * 0.55, ry * 0.48);
      const dOut = Math.min(dMain, dLump);
      if (dOut > 1.02) continue;

      const i = (y * W + x) * 4;
      // Protect glasses temple/frame (incl. anti-aliased dark edges).
      const cr0 = clean.data[i];
      const cg0 = clean.data[i + 1];
      const cb0 = clean.data[i + 2];
      const ca0 = clean.data[i + 3];
      if (ca0 > 180 && Math.max(cr0, cg0, cb0) < 70) continue;

      const fr = face.data[i];
      const fg = face.data[i + 1];
      const fb = face.data[i + 2];
      const fa = face.data[i + 3];
      if (fa > 20 && isGlassesFrame(fr, fg, fb, fa)) continue;
      // Don't paint over blonde hair above the ear bulb.
      if (fa > 20 && ny < cy - ry * 0.95 && fr > 170 && fg > 140 && fb < 130 && fr + fg > 340) continue;

      const edge = softEdge(dOut, 0.92);
      if (edge < 0.08) continue;

      // Cel-shaded cauliflower (flat bands matching 2D face language).
      const shade = 1 - Math.min(1, dOut);
      let rr;
      let gg;
      let bb;
      if (shade > 0.78) {
        rr = 235;
        gg = 155;
        bb = 145; // highlight
      } else if (shade > 0.45) {
        rr = 210;
        gg = 105;
        bb = 110; // mid inflamed
      } else {
        rr = 165;
        gg = 60;
        bb = 80; // bruise rim
      }
      // Darker attachment fold.
      const foldX = cx + (side === 'left' ? -0.032 : 0.032);
      const fold = ellipseDist(nx, ny, foldX, cy + 0.03, rx * 0.38, ry * 0.45);
      if (fold < 0.85) {
        rr = 145;
        gg = 50;
        bb = 70;
      }
      // Upper highlight disk (shiny stretched).
      const hi = ellipseDist(nx, ny, cx + (side === 'left' ? -0.01 : 0.01), cy - 0.05, rx * 0.26, ry * 0.2);
      if (hi < 0.7) {
        rr = 245;
        gg = 185;
        bb = 175;
      }

      // Opaque replace.
      face.data[i] = rr;
      face.data[i + 1] = gg;
      face.data[i + 2] = bb;
      face.data[i + 3] = 255;
      if (edge > 0.6) solid[y * W + x] = 1;
      painted++;
    }
  }

  // Thick black cartoon outline (match face line art).
  const stroke = createCanvas(W, H);
  const sctx = stroke.getContext('2d');
  sctx.strokeStyle = '#1a1014';
  sctx.lineWidth = 7;
  sctx.lineJoin = 'round';
  sctx.lineCap = 'round';
  sctx.beginPath();
  sctx.ellipse(cx * W, cy * H, rx * W * 0.97, ry * H * 0.97, 0, 0, Math.PI * 2);
  sctx.stroke();
  const strokeData = sctx.getImageData(0, 0, W, H).data;
  for (let i = 0; i < face.data.length; i += 4) {
    const a = strokeData[i + 3];
    if (a < 50) continue;
    const p = i / 4;
    const x = p % W;
    const y = (p / W) | 0;
    let near = solid[y * W + x];
    if (!near) {
      for (const [dx, dy] of [
        [4, 0],
        [-4, 0],
        [0, 4],
        [0, -4],
        [3, 3],
        [-3, 3],
      ]) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && solid[yy * W + xx]) near = 1;
      }
    }
    if (!near) continue;
    // Don't cover glasses temple with outline either.
    if (clean.data[i + 3] > 180 && Math.max(clean.data[i], clean.data[i + 1], clean.data[i + 2]) < 70) continue;
    const t = Math.min(1, a / 255);
    face.data[i] = clamp(mix(face.data[i], 20, t));
    face.data[i + 1] = clamp(mix(face.data[i + 1], 12, t));
    face.data[i + 2] = clamp(mix(face.data[i + 2], 16, t));
    if (face.data[i + 3] < 20) face.data[i + 3] = 255;
  }
  return painted;
}

/**
 * Black eye — male change: deep purple orbital bruise + drooping lid over
 * top of iris. Smooth falloff, iris/glasses preserved.
 */
function applyBlackEye(face, which) {
  const eye = which === 'right' ? LM.rightEye : LM.leftEye;
  // Build smooth bruise mask via canvas blur.
  const mc = createCanvas(W, H);
  const mctx = mc.getContext('2d');
  // Orbital bruise — slightly irregular (two overlapping ovals) like male.
  const g = mctx.createRadialGradient(eye.x * W, eye.y * H, 0, eye.x * W, eye.y * H, 0.12 * W);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.72, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  mctx.fillStyle = g;
  mctx.beginPath();
  mctx.ellipse(eye.x * W, eye.y * H, 0.11 * W, 0.1 * H, 0, 0, Math.PI * 2);
  mctx.fill();
  const g2 = mctx.createRadialGradient(eye.x * W, (eye.y + 0.045) * H, 0, eye.x * W, (eye.y + 0.045) * H, 0.085 * W);
  g2.addColorStop(0, 'rgba(255,255,255,0.95)');
  g2.addColorStop(1, 'rgba(255,255,255,0)');
  mctx.fillStyle = g2;
  mctx.beginPath();
  mctx.ellipse(eye.x * W, (eye.y + 0.045) * H, 0.09 * W, 0.05 * H, 0, 0, Math.PI * 2);
  mctx.fill();
  // Inner corner emphasis (male bruise is darkest there).
  const g3 = mctx.createRadialGradient((eye.x + 0.03) * W, eye.y * H, 0, (eye.x + 0.03) * W, eye.y * H, 0.05 * W);
  g3.addColorStop(0, 'rgba(255,255,255,0.7)');
  g3.addColorStop(1, 'rgba(255,255,255,0)');
  mctx.fillStyle = g3;
  mctx.beginPath();
  mctx.ellipse((eye.x + (eye.x < 0.5 ? 0.03 : -0.03)) * W, eye.y * H, 0.05 * W, 0.055 * H, 0, 0, Math.PI * 2);
  mctx.fill();

  const blurC = createCanvas(W, H);
  const bctx = blurC.getContext('2d');
  bctx.filter = 'blur(8px)';
  bctx.drawImage(mc, 0, 0);
  const mask = bctx.getImageData(0, 0, W, H);

  let painted = 0;
  for (let i = 0; i < face.data.length; i += 4) {
    const m = mask.data[i + 3] / 255;
    if (m < 0.04) continue;
    const r = face.data[i];
    const gch = face.data[i + 1];
    const b = face.data[i + 2];
    const a = face.data[i + 3];
    if (a < 20 || isBackdrop(r, gch, b, a)) continue;
    if (isGlassesFrame(r, gch, b, a) || isIris(r, gch, b) || isSclera(r, gch, b) || isTooth(r, gch, b)) continue;
    if (isLineArt(r, gch, b)) continue;
    if (!isSkinTone(r, gch, b, a) && !(r > 150 && gch > 100 && b > 70)) continue;
    // Male-strength deep purple/indigo multiply.
    const t = Math.min(1, m * 1.05);
    const br = (r / 255) * 48;
    const bg = (gch / 255) * 22;
    const bb = (b / 255) * 105;
    face.data[i] = clamp(mix(r, br, t));
    face.data[i + 1] = clamp(mix(gch, bg, t));
    face.data[i + 2] = clamp(mix(b, bb, t));
    painted++;
  }

  // Drooping lid covering top ~1/3 of iris (male half-lidded look).
  const lidC = createCanvas(W, H);
  const lctx = lidC.getContext('2d');
  const lg = lctx.createRadialGradient(eye.x * W, (eye.y - 0.022) * H, 0, eye.x * W, (eye.y - 0.018) * H, 0.07 * W);
  lg.addColorStop(0, 'rgba(145,70,88,0.98)');
  lg.addColorStop(0.5, 'rgba(140,65,82,0.9)');
  lg.addColorStop(1, 'rgba(130,55,75,0)');
  lctx.fillStyle = lg;
  lctx.beginPath();
  lctx.ellipse(eye.x * W, (eye.y - 0.018) * H, 0.072 * W, 0.04 * H, 0, 0, Math.PI * 2);
  lctx.fill();
  const lid = lctx.getImageData(0, 0, W, H);
  for (let i = 0; i < face.data.length; i += 4) {
    const m = lid.data[i + 3] / 255;
    if (m < 0.05) continue;
    const y = ((i / 4) / W) | 0;
    if (y / H > eye.y + 0.002) continue;
    if (isGlassesFrame(face.data[i], face.data[i + 1], face.data[i + 2], face.data[i + 3])) continue;
    const t = Math.min(1, m);
    face.data[i] = clamp(mix(face.data[i], lid.data[i], t));
    face.data[i + 1] = clamp(mix(face.data[i + 1], lid.data[i + 1], t));
    face.data[i + 2] = clamp(mix(face.data[i + 2], lid.data[i + 2], t));
    face.data[i + 3] = 255;
    painted++;
  }
  return painted;
}

/** Swollen lip — grow + recolor bottom lip like male puffed lip. */
function applySwollenLip(face, clean) {
  const lip = LM.bottomLip;
  const ax = lip.x;
  const ay = lip.y - 0.03; // grow downward from mouth
  const scaleX = 1.15;
  const scaleY = 1.55;
  let painted = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const dOut = ellipseDist(nx, ny, lip.x, lip.y + 0.02, 0.155, 0.08);
      if (dOut > 1.02) continue;

      const ox = ax + (nx - ax) / scaleX;
      const oy = ay + (ny - ay) / scaleY;
      let [sr, sg, sb, sa] = sampleBilinear(clean.data, ox * W - 0.5, oy * H - 0.5);
      const srcClear = sa < 20 || isBackdrop(sr, sg, sb, sa);

      const i = (y * W + x) * 4;
      const fr = face.data[i];
      const fg = face.data[i + 1];
      const fb = face.data[i + 2];
      const fa = face.data[i + 3];
      if (fa > 20 && (isGlassesFrame(fr, fg, fb, fa) || isTooth(fr, fg, fb) || isIris(fr, fg, fb))) continue;
      if (ny < lip.y - 0.035 && fa > 20 && isTooth(fr, fg, fb)) continue;

      // Prefer lip-ish / chin skin; synthesize when growing past clean lip.
      const lipish =
        !srcClear &&
        ((sr > 140 && sg < 140 && sb < 140) || isSkinTone(sr, sg, sb, sa) || (sr > 160 && sg > 90 && sb > 70));
      if (!lipish && dOut > 0.7 && srcClear) {
        sr = 200;
        sg = 120;
        sb = 110;
        sa = 255;
      } else if (!lipish && srcClear) {
        continue;
      }

      const L = lum(sr, sg, sb) / 255;
      let cr = mix(150, 230, L);
      let cg = mix(40, 120, L * L);
      let cb = mix(50, 120, L * L);
      // Center redder (male split lip zone).
      const center = ellipseDist(nx, ny, lip.x, lip.y + 0.01, 0.05, 0.04);
      if (center < 1) {
        const ct = (1 - center) * 0.35;
        cr = mix(cr, 175, ct);
        cg = mix(cg, 45, ct);
        cb = mix(cb, 55, ct);
      }

      const edge = softEdge(dOut, 0.86);
      const t = Math.min(1, edge * 0.95);
      if (t < 0.05) continue;
      if (t >= 0.85 || fa < 20 || isBackdrop(fr, fg, fb, fa)) {
        face.data[i] = clamp(cr);
        face.data[i + 1] = clamp(cg);
        face.data[i + 2] = clamp(cb);
        face.data[i + 3] = 255;
      } else {
        face.data[i] = clamp(mix(fr, cr, t));
        face.data[i + 1] = clamp(mix(fg, cg, t));
        face.data[i + 2] = clamp(mix(fb, cb, t));
        face.data[i + 3] = 255;
      }
      painted++;
    }
  }

  // Center vertical cut.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      if (Math.abs(nx - lip.x) > 0.0055) continue;
      if (ny < lip.y - 0.015 || ny > lip.y + 0.05) continue;
      const i = (y * W + x) * 4;
      if (face.data[i + 3] < 40 || isTooth(face.data[i], face.data[i + 1], face.data[i + 2])) continue;
      face.data[i] = 145;
      face.data[i + 1] = 28;
      face.data[i + 2] = 38;
      painted++;
    }
  }
  return painted;
}

function applyMissingTooth(face) {
  const mouth = LM.mouth;
  const tx = mouth.x + 0.022;
  const ty = mouth.y - 0.008;
  let painted = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const d = ellipseDist(nx, ny, tx, ty, 0.016, 0.026);
      if (d >= 1) continue;
      const i = (y * W + x) * 4;
      if (face.data[i + 3] < 20 || !isTooth(face.data[i], face.data[i + 1], face.data[i + 2])) continue;
      const t = softEdge(d, 0.65);
      face.data[i] = clamp(mix(face.data[i], 30, t));
      face.data[i + 1] = clamp(mix(face.data[i + 1], 20, t));
      face.data[i + 2] = clamp(mix(face.data[i + 2], 18, t));
      painted++;
    }
  }
  return painted;
}

/** Swollen eye nearly shut — puffy lid covering eye with thin slit. */
function applySwollenEye(face, which) {
  const eye = which === 'left' ? LM.leftEye : LM.rightEye;
  const mc = createCanvas(W, H);
  const mctx = mc.getContext('2d');
  const g = mctx.createRadialGradient(eye.x * W, eye.y * H, 0, eye.x * W, eye.y * H, 0.095 * W);
  g.addColorStop(0, 'rgba(200,100,105,1)');
  g.addColorStop(0.5, 'rgba(185,85,95,0.95)');
  g.addColorStop(0.82, 'rgba(170,75,85,0.55)');
  g.addColorStop(1, 'rgba(160,70,80,0)');
  mctx.fillStyle = g;
  mctx.beginPath();
  mctx.ellipse(eye.x * W, eye.y * H, 0.092 * W, 0.078 * H, 0, 0, Math.PI * 2);
  mctx.fill();
  // Highlight
  const hg = mctx.createRadialGradient(eye.x * W, (eye.y - 0.02) * H, 0, eye.x * W, (eye.y - 0.02) * H, 0.035 * W);
  hg.addColorStop(0, 'rgba(245,190,180,0.55)');
  hg.addColorStop(1, 'rgba(245,190,180,0)');
  mctx.fillStyle = hg;
  mctx.beginPath();
  mctx.ellipse(eye.x * W, (eye.y - 0.02) * H, 0.035 * W, 0.022 * H, 0, 0, Math.PI * 2);
  mctx.fill();

  const blurC = createCanvas(W, H);
  const bctx = blurC.getContext('2d');
  bctx.filter = 'blur(3px)';
  bctx.drawImage(mc, 0, 0);
  const overlay = bctx.getImageData(0, 0, W, H);

  let painted = 0;
  for (let i = 0; i < face.data.length; i += 4) {
    const m = overlay.data[i + 3] / 255;
    if (m < 0.05) continue;
    const x = (i / 4) % W;
    const y = ((i / 4) / W) | 0;
    const nx = (x + 0.5) / W;
    const ny = (y + 0.5) / H;
    const r = face.data[i];
    const g = face.data[i + 1];
    const b = face.data[i + 2];
    const a = face.data[i + 3];
    if (a < 20 || isBackdrop(r, g, b, a) || isGlassesFrame(r, g, b, a)) continue;

    // Thin slit remains darker (male nearly-shut).
    const slit = Math.abs(ny - eye.y) < 0.005 && Math.abs(nx - eye.x) < 0.04;
    if (slit) {
      face.data[i] = clamp(mix(r, 55, 0.75));
      face.data[i + 1] = clamp(mix(g, 30, 0.75));
      face.data[i + 2] = clamp(mix(b, 35, 0.75));
      painted++;
      continue;
    }
    const t = Math.min(1, m * 0.95);
    face.data[i] = clamp(mix(r, overlay.data[i], t));
    face.data[i + 1] = clamp(mix(g, overlay.data[i + 1], t));
    face.data[i + 2] = clamp(mix(b, overlay.data[i + 2], t));
    face.data[i + 3] = 255;
    painted++;
  }
  return painted;
}

function applyBrokenNose(face) {
  const nose = LM.nose;
  let painted = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const d = ellipseDist(nx, ny, nose.x, nose.y, 0.06, 0.08);
      if (d >= 1) continue;
      const i = (y * W + x) * 4;
      const r = face.data[i];
      const g = face.data[i + 1];
      const b = face.data[i + 2];
      const a = face.data[i + 3];
      if (a < 20 || isBackdrop(r, g, b, a) || isGlassesFrame(r, g, b, a) || isIris(r, g, b) || isTooth(r, g, b)) {
        continue;
      }
      if (!isSkinTone(r, g, b, a)) continue;
      const t = softEdge(d, 0.7) * 0.8;
      face.data[i] = clamp(mix(r, (r / 255) * 165, t));
      face.data[i + 1] = clamp(mix(g, (g / 255) * 50, t));
      face.data[i + 2] = clamp(mix(b, (b / 255) * 55, t));
      painted++;
    }
  }
  // Diagonal cut like male.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const t = (ny - (nose.y - 0.05)) / 0.1;
      if (t < 0 || t > 1) continue;
      const lx = nose.x - 0.02 + t * 0.045;
      if (Math.abs(nx - lx) > 0.007) continue;
      const i = (y * W + x) * 4;
      if (face.data[i + 3] < 40) continue;
      if (isGlassesFrame(face.data[i], face.data[i + 1], face.data[i + 2], face.data[i + 3])) continue;
      face.data[i] = 140;
      face.data[i + 1] = 28;
      face.data[i + 2] = 32;
      painted++;
    }
  }
  return painted;
}

function applyForeheadBandage(face) {
  const fh = LM.forehead;
  let painted = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const d = ellipseDist(nx, ny, fh.x, fh.y, 0.36, 0.08);
      if (d >= 1) continue;
      const i = (y * W + x) * 4;
      const r = face.data[i];
      const g = face.data[i + 1];
      const b = face.data[i + 2];
      const a = face.data[i + 3];
      if (a > 20 && (isGlassesFrame(r, g, b, a) || isIris(r, g, b))) continue;

      const v = (ny - (fh.y - 0.08)) / 0.16;
      let cr = mix(242, 228, Math.abs(v - 0.5) * 2);
      let cg = mix(230, 212, Math.abs(v - 0.5) * 2);
      let cb = mix(198, 175, Math.abs(v - 0.5) * 2);
      const fold = Math.abs(((nx * 36) % 1) - 0.5);
      if (fold < 0.07) {
        cr = mix(cr, 205, 0.28);
        cg = mix(cg, 185, 0.28);
        cb = mix(cb, 150, 0.28);
      }
      const blood = ellipseDist(nx, ny, fh.x - 0.05, fh.y + 0.008, 0.018, 0.012);
      if (blood < 1) {
        const bt = (1 - blood) * 0.6;
        cr = mix(cr, 165, bt);
        cg = mix(cg, 48, bt);
        cb = mix(cb, 52, bt);
      }
      const edge = softEdge(d, 0.86);
      const t = Math.min(1, edge);
      if (t < 0.05) continue;
      if (t >= 0.8 || a < 20 || isBackdrop(r, g, b, a) || isSkinTone(r, g, b, a) || (r > 160 && g > 130 && b < 140)) {
        if (t >= 0.85 || a < 20 || isBackdrop(r, g, b, a)) {
          face.data[i] = clamp(cr);
          face.data[i + 1] = clamp(cg);
          face.data[i + 2] = clamp(cb);
          face.data[i + 3] = 255;
        } else {
          face.data[i] = clamp(mix(r, cr, t));
          face.data[i + 1] = clamp(mix(g, cg, t));
          face.data[i + 2] = clamp(mix(b, cb, t));
          face.data[i + 3] = 255;
        }
        painted++;
      }
    }
  }
  return painted;
}

// ---------------------------------------------------------------------------
const liveImg = await loadImage(`${BASE}/test-template-face.png`);
const liveCtx = createCanvas(W, H).getContext('2d');
liveCtx.drawImage(liveImg, 0, 0, W, H);
const clean = liveCtx.getImageData(0, 0, W, H);
let face = copyImageData(clean);

fs.mkdirSync(OUT, { recursive: true });
liveCtx.putImageData(face, 0, 0);
fs.writeFileSync(`${OUT}/00-clean.png`, liveCtx.canvas.toBuffer('image/png'));

const steps = [
  { name: '01-cauliflowerLeftEar', run: () => applyCauliflowerEar(face, clean, 'left') },
  { name: '02-blackRightEye', run: () => applyBlackEye(face, 'right') },
  { name: '03-swollenBottomLip', run: () => applySwollenLip(face, clean) },
  { name: '04-cauliflowerRightEar', run: () => applyCauliflowerEar(face, clean, 'right') },
  { name: '05-missingTooth', run: () => applyMissingTooth(face) },
  { name: '06-swollenLeftEye', run: () => applySwollenEye(face, 'left') },
  { name: '07-brokenNose', run: () => applyBrokenNose(face) },
  { name: '08-foreheadBandage', run: () => applyForeheadBandage(face) },
];

for (const step of steps) {
  const n = step.run();
  liveCtx.putImageData(face, 0, 0);
  fs.writeFileSync(`${OUT}/${step.name}.png`, liveCtx.canvas.toBuffer('image/png'));
  console.log(step.name, n);
}

console.log('Wrote', OUT);
