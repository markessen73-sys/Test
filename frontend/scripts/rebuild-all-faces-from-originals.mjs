/**
 * Extreme reset: reinstall every stock pack from original caricature trios
 * (authored clean + ooh + knockout), then bake damage HUD stages and pad a
 * large clear frame so hair / chin / ears are never clipped.
 *
 * Male / female never had authored ooh/KO — those are rebuilt from clean by
 * erasing the grin/eyes first, then redrawing features (no sticker overlays).
 *
 *   node scripts/rebuild-all-faces-from-originals.mjs
 */
import { createCanvas, loadImage } from 'canvas';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { W, H, LM } from './lib/faceDamageBake.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CHAR_ROOT = path.join(ROOT, 'public/faces/characters');
const FACES = path.join(ROOT, 'public/faces');
const ART = '/opt/cursor/artifacts/assets';
const ART_ROOT = '/opt/cursor/artifacts';
const ORIG = '/tmp/orig-faces2';
const STAGE = '/tmp/rebuild-face-sources';
const ALPHA = 40;

/** ~12% clear frame — big enough that ooh brow lift / open mouth never clips. */
const MARGIN_FRAC = 0.12;

const PACKS = [
  {
    id: 'default',
    clean: `${ORIG}/default/clean.png`,
    ooh: `${ORIG}/default/ooh.png`,
    ko: `${ORIG}/default/knockout.png`,
  },
  {
    id: 'byson',
    clean: `${ORIG}/byson/clean.png`,
    ooh: `${ORIG}/byson/ooh.png`,
    ko: `${ORIG}/byson/knockout.png`,
  },
  {
    id: 'tin-mick',
    clean: `${ORIG}/tin-mick/clean.png`,
    ooh: `${ORIG}/tin-mick/ooh.png`,
    ko: `${ORIG}/tin-mick/knockout.png`,
  },
  {
    id: 'the-don',
    clean: `${ORIG}/the-don/clean.png`,
    ooh: `${ORIG}/the-don/ooh.png`,
    ko: `${ORIG}/the-don/knockout.png`,
  },
  {
    id: 'bozza',
    // v2 trio has the largest clear frame; v4 ooh clips chin/hair.
    clean: `${ART}/bozza-clean-v2.png`,
    ooh: `${ART}/bozza-ooh-v2.png`,
    ko: `${ART}/bozza-knockout-v2.png`,
  },
  {
    id: 'the-nige',
    clean: `${ART}/nige2-clean.png`,
    ooh: `${ART}/nige2-ooh.png`,
    ko: `${ART}/nige2-ko.png`,
  },
  {
    id: 'the-greenie',
    clean: `${ART}/greenie-clean.png`,
    ooh: `${ART}/greenie-ooh.png`,
    ko: `${ART}/greenie-ko.png`,
  },
  {
    id: 'king-of-the-north',
    // Matched authored trio (same head/glasses), generous margins.
    clean: `${ART}/king-clean-v6.png`,
    ooh: `${ART}/king-ooh-v6.png`,
    ko: `${ART}/king-ko-v6.png`,
  },
  {
    id: 'male-boxer',
    clean: path.join(FACES, 'test-template-face-male.png'),
    ooh: 'GENERATE',
    ko: 'GENERATE',
  },
  {
    id: 'female-boxer',
    clean: path.join(FACES, 'test-template-face-female.png'),
    ooh: 'GENERATE',
    ko: 'GENERATE',
  },
];

function ensure(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing source: ${p}`);
}

function writePng(file, canvas) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isSkinish(r, g, b) {
  if (lum(r, g, b) < 40 || lum(r, g, b) > 250) return false;
  if (b > r + 35 && b > g + 25) return false;
  if (g > r + 35 && g > b + 25) return false;
  return r > 70 && g > 40 && b > 25 && r >= g - 25;
}

function isTooth(r, g, b) {
  const c = Math.max(r, g, b) - Math.min(r, g, b);
  return r > 175 && g > 165 && b > 145 && c < 55 && lum(r, g, b) > 175;
}

function isDarkFeature(r, g, b) {
  return Math.max(r, g, b) < 95;
}

function isIrisBlue(r, g, b) {
  return b > 90 && b > r + 15 && b >= g - 10 && lum(r, g, b) < 200;
}

function isIrisBrown(r, g, b) {
  // Tight: saturated brown iris, not cheek stubble / hair.
  const L = lum(r, g, b);
  if (L < 35 || L > 130) return false;
  if (!(r > 55 && g > 25 && b < 70 && r > b + 25 && r >= g)) return false;
  if (r - g > 55) return false; // too red = lip/nose
  return true;
}

function isSclera(r, g, b) {
  const c = Math.max(r, g, b) - Math.min(r, g, b);
  return r > 190 && g > 190 && b > 185 && c < 40;
}

function sampleSkin(data, cx, cy, radius) {
  let sr = 0,
    sg = 0,
    sb = 0,
    n = 0;
  const R = Math.floor(radius);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const x = Math.round(cx + dx);
      const y = Math.round(cy + dy);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < 180) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      if (!isSkinish(r, g, b)) continue;
      if (isTooth(r, g, b) || isSclera(r, g, b)) continue;
      sr += r;
      sg += g;
      sb += b;
      n++;
    }
  }
  if (!n) return [210, 150, 110];
  return [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)];
}

/** Flood-erase mouth grin (teeth + lips + dark cavity) then inpaint with skin. */
/** Detect iris + teeth from the clean pixels (LM is for Default layout only). */
function detectFacePoints(data, preferBlueIris) {
  function irisCentroid(x0, x1) {
    let sx = 0,
      sy = 0,
      n = 0;
    for (let y = Math.floor(0.15 * H); y < Math.floor(0.55 * H); y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * 4;
        if (data[i + 3] < 200) continue;
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        const ok = preferBlueIris ? isIrisBlue(r, g, b) : isIrisBrown(r, g, b) || isIrisBlue(r, g, b);
        if (!ok) continue;
        sx += x;
        sy += y;
        n++;
      }
    }
    return n > 80 ? { x: sx / n / W, y: sy / n / H, n } : null;
  }
  const right = irisCentroid(Math.floor(0.1 * W), Math.floor(0.5 * W));
  const left = irisCentroid(Math.floor(0.5 * W), Math.floor(0.9 * W));
  let sx = 0,
    sy = 0,
    n = 0;
  for (let y = Math.floor(0.45 * H); y < Math.floor(0.85 * H); y++) {
    for (let x = Math.floor(0.3 * W); x < Math.floor(0.7 * W); x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 200) continue;
      if (!isTooth(data[i], data[i + 1], data[i + 2])) continue;
      sx += x;
      sy += y;
      n++;
    }
  }
  const mouth =
    n > 200
      ? { x: sx / n / W, y: sy / n / H }
      : { x: LM.mouth.x, y: LM.mouth.y };
  return {
    rightEye: right || LM.rightEye,
    leftEye: left || LM.leftEye,
    mouth,
  };
}

function eraseMouthRegion(data, skin, mouth = LM.mouth) {
  const mx = mouth.x * W;
  const my = mouth.y * H;
  const rx = 0.2 * W;
  const ry = 0.14 * H;
  const mask = new Uint8Array(W * H);

  for (let y = Math.floor(my - ry); y <= Math.ceil(my + ry); y++) {
    for (let x = Math.floor(mx - rx); x <= Math.ceil(mx + rx); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const nx = (x - mx) / rx;
      const ny = (y - my) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA) continue;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      // Erase teeth, dark mouth cavity, lip reds, smile lines in the mouth ellipse.
      const lipish = r > 120 && r > g + 25 && r > b + 25 && lum(r, g, b) < 170;
      if (isTooth(r, g, b) || isDarkFeature(r, g, b) || lipish || isSclera(r, g, b)) {
        mask[y * W + x] = 1;
      }
    }
  }

  // Dilate mask so we don't leave grin edges
  const dilate = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!mask[y * W + x]) continue;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const nx = (xx - mx) / (rx * 1.05);
          const ny = (yy - my) / (ry * 1.15);
          if (nx * nx + ny * ny > 1) continue;
          dilate[yy * W + xx] = 1;
        }
      }
    }
  }

  for (let i = 0; i < W * H; i++) {
    if (!dilate[i]) continue;
    const i4 = i * 4;
    if (data[i4 + 3] < ALPHA) continue;
    data[i4] = skin[0];
    data[i4 + 1] = skin[1];
    data[i4 + 2] = skin[2];
    data[i4 + 3] = 255;
  }

  // Smooth with neighbor skin average
  for (let pass = 0; pass < 8; pass++) {
    const updates = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (!dilate[i]) continue;
        let sr = 0,
          sg = 0,
          sb = 0,
          n = 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [2, 0],
          [-2, 0],
          [0, 2],
          [0, -2],
        ]) {
          const j = ((y + dy) * W + (x + dx)) * 4;
          if (data[j + 3] < 180) continue;
          const r = data[j],
            g = data[j + 1],
            b = data[j + 2];
          if (!isSkinish(r, g, b)) continue;
          sr += r;
          sg += g;
          sb += b;
          n++;
        }
        if (n) updates.push({ i, r: Math.round(sr / n), g: Math.round(sg / n), b: Math.round(sb / n) });
      }
    }
    for (const u of updates) {
      const i4 = u.i * 4;
      data[i4] = u.r;
      data[i4 + 1] = u.g;
      data[i4 + 2] = u.b;
    }
  }
}

function eraseEye(data, eye, skin, rx = 0.09 * W, ry = 0.07 * H) {
  const cx = eye.x * W;
  const cy = eye.y * H;
  // Hard cover the whole eye socket with skin — no leftover irises.
  for (let y = Math.floor(cy - ry * 1.35); y <= Math.ceil(cy + ry * 1.35); y++) {
    for (let x = Math.floor(cx - rx * 1.35); x <= Math.ceil(cx + rx * 1.35); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < ALPHA) continue;
      // Keep eyebrows (dark horizontal band above eye) roughly intact:
      // only overwrite when inside socket OR looking like eye white/iris.
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const inCore = nx * nx + ny * ny < 0.72;
      const eyeish =
        isSclera(r, g, b) ||
        isIrisBlue(r, g, b) ||
        isIrisBrown(r, g, b) ||
        isDarkFeature(r, g, b) ||
        (r > 180 && g > 160 && b > 140);
      if (!inCore && !eyeish) continue;
      data[i] = skin[0];
      data[i + 1] = skin[1];
      data[i + 2] = skin[2];
      data[i + 3] = 255;
    }
  }
}

function drawOohEyes(ctx, irisRgb, eyes) {
  for (const eye of eyes) {
    const cx = eye.x * W;
    const cy = eye.y * H;
    const rx = 0.058 * W;
    const ry = 0.052 * H;
    // Soft white sclera (integrated, not a floating sticker)
    const grd = ctx.createRadialGradient(cx, cy, rx * 0.15, cx, cy, rx);
    grd.addColorStop(0, '#fffef8');
    grd.addColorStop(0.75, '#f2eee6');
    grd.addColorStop(1, 'rgba(230,220,200,0.35)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // Iris
    ctx.fillStyle = `rgb(${irisRgb.join(',')})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1, rx * 0.55, ry * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pupil
    ctx.fillStyle = '#1a100c';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1, rx * 0.22, ry * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.18, cy - ry * 0.2, rx * 0.12, ry * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    // Soft outline
    ctx.strokeStyle = 'rgba(40,25,18,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawOohMouth(ctx, skin, mouth) {
  const cx = mouth.x * W;
  const cy = mouth.y * H + 2;
  const lip = [
    Math.min(255, skin[0] + 25),
    Math.max(35, skin[1] - 35),
    Math.max(30, skin[2] - 25),
  ];
  // Outer lip ring
  ctx.fillStyle = `rgb(${lip.join(',')})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 0.072 * W, 0.09 * H, 0, 0, Math.PI * 2);
  ctx.fill();
  // Inner cavity
  ctx.fillStyle = '#1c0d08';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 0.048 * W, 0.065 * H, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tiny tongue hint at bottom
  ctx.fillStyle = `rgb(${Math.min(255, lip[0] + 20)},${Math.max(40, lip[1] - 10)},${Math.max(40, lip[2] - 5)})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 0.045 * H, 0.028 * W, 0.016 * H, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawKoEyes(ctx, skin, eyes) {
  const lid = [Math.min(255, skin[0] + 8), Math.min(255, skin[1] + 4), skin[2]];
  for (const eye of eyes) {
    const cx = eye.x * W;
    const cy = eye.y * H;
    ctx.fillStyle = `rgb(${lid.join(',')})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 0.058 * W, 0.042 * H, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgb(45,28,20)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 0.042 * W, cy + 2);
    ctx.quadraticCurveTo(cx, cy + 0.028 * H, cx + 0.042 * W, cy + 2);
    ctx.stroke();
  }
}

function drawKoMouth(ctx, skin, mouth) {
  const cx = mouth.x * W;
  const cy = mouth.y * H;
  const lip = [
    Math.min(255, skin[0] + 15),
    Math.max(40, skin[1] - 25),
    Math.max(35, skin[2] - 18),
  ];
  ctx.strokeStyle = `rgb(${lip.join(',')})`;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 0.09 * W, cy - 6);
  ctx.quadraticCurveTo(cx, cy + 34, cx + 0.09 * W, cy - 6);
  ctx.stroke();
  ctx.strokeStyle = 'rgb(50,30,22)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 0.08 * W, cy - 4);
  ctx.quadraticCurveTo(cx, cy + 28, cx + 0.08 * W, cy - 4);
  ctx.stroke();
}

function drawKoStars(ctx) {
  const cx = W * 0.5;
  const cy = H * 0.22;
  const stars = [
    [-0.16, -0.02],
    [-0.08, -0.08],
    [0.0, -0.1],
    [0.08, -0.08],
    [0.16, -0.02],
  ];
  for (const [dx, dy] of stars) {
    const x = cx + dx * W;
    const y = cy + dy * H;
    ctx.fillStyle = '#f5d84a';
    ctx.strokeStyle = '#c9a012';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      const r = i % 2 === 0 ? 18 : 8;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

async function generateExpression(cleanPath, mode, irisRgb, preferBlueIris) {
  const img = await loadImage(cleanPath);
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  const pts = detectFacePoints(d, preferBlueIris);
  console.log(
    '  detected eyes',
    pts.rightEye.x?.toFixed?.(3) ?? pts.rightEye.x,
    pts.rightEye.y?.toFixed?.(3) ?? pts.rightEye.y,
    pts.leftEye.x?.toFixed?.(3) ?? pts.leftEye.x,
    pts.leftEye.y?.toFixed?.(3) ?? pts.leftEye.y,
    'mouth',
    pts.mouth.x.toFixed(3),
    pts.mouth.y.toFixed(3)
  );
  const skin = sampleSkin(d, ((pts.rightEye.x + pts.leftEye.x) / 2) * W, pts.mouth.y * H - 40, 50);

  eraseMouthRegion(d, skin, pts.mouth);
  eraseEye(d, pts.rightEye, skin);
  eraseEye(d, pts.leftEye, skin);
  // Second pass after first fill — catch leftover teeth/iris edges.
  eraseMouthRegion(d, skin, pts.mouth);
  eraseEye(d, pts.rightEye, skin, 0.08 * W, 0.06 * H);
  eraseEye(d, pts.leftEye, skin, 0.08 * W, 0.06 * H);
  ctx.putImageData(id, 0, 0);

  const eyes = [pts.rightEye, pts.leftEye];
  if (mode === 'ooh') {
    drawOohEyes(ctx, irisRgb, eyes);
    drawOohMouth(ctx, skin, pts.mouth);
  } else {
    drawKoEyes(ctx, skin, eyes);
    drawKoMouth(ctx, skin, pts.mouth);
    drawKoStars(ctx);
  }
  return ctx.canvas;
}

/** Shrink any source into a large clear frame before LM align. */
async function prePadSource(srcPath, outPath, marginFrac = 0.14) {
  const img = await loadImage(srcPath);
  const ctx0 = createCanvas(W, H).getContext('2d');
  ctx0.clearRect(0, 0, W, H);
  ctx0.drawImage(img, 0, 0, W, H);
  const id = ctx0.getImageData(0, 0, W, H);
  const d = id.data;
  // Key near-black so RGB plates get a real bbox.
  for (let i = 0; i < d.length; i += 4) {
    const max = Math.max(d[i], d[i + 1], d[i + 2]);
    const min = Math.min(d[i], d[i + 1], d[i + 2]);
    if (max < 18) d[i + 3] = 0;
    else if (max < 42 && max - min < 12) d[i + 3] = Math.round(((max - 18) / 24) * d[i + 3]);
  }
  let x0 = W,
    y0 = H,
    x1 = 0,
    y1 = 0,
    n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] < ALPHA) continue;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (!n) {
    fs.copyFileSync(srcPath, outPath);
    return;
  }
  const M = Math.floor(marginFrac * W);
  const contentH = y1 - y0 + 1;
  const contentW = x1 - x0 + 1;
  let scale = Math.min((H - 2 * M) / contentH, (W - 2 * M) / contentW);
  if (scale > 1) scale = 1;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const srcCanvas = createCanvas(W, H);
  srcCanvas.getContext('2d').putImageData(id, 0, 0);
  const out = createCanvas(W, H).getContext('2d');
  out.clearRect(0, 0, W, H);
  out.translate(W / 2, H / 2);
  out.scale(scale, scale);
  out.translate(-cx, -cy);
  out.drawImage(srcCanvas, 0, 0);
  writePng(outPath, out.canvas);
}

function padPackInPlace(id, marginFrac) {
  const MARGIN = Math.floor(marginFrac * 1024);
  const root = path.join(CHAR_ROOT, id);
  const files = [
    'clean.png',
    'ooh.png',
    'knockout.png',
    ...fs.readdirSync(path.join(root, 'damage-stages')).map((n) => path.join('damage-stages', n)),
    ...fs
      .readdirSync(path.join(root, 'bobo-clown-stages'))
      .filter((n) => n.endsWith('.png'))
      .map((n) => path.join('bobo-clown-stages', n)),
  ];

  async function load(file) {
    const img = await loadImage(path.join(root, file));
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0);
    return { canvas: c, data: ctx.getImageData(0, 0, W, H).data };
  }

  function bbox(data) {
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

  return (async () => {
    const clean = await load('clean.png');
    const ooh = await load('ooh.png');
    const ko = await load('knockout.png');
    const boxes = [bbox(clean.data), bbox(ooh.data), bbox(ko.data)];
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const b of boxes) {
      if (!b) continue;
      x0 = Math.min(x0, b.x0);
      y0 = Math.min(y0, b.y0);
      x1 = Math.max(x1, b.x1);
      y1 = Math.max(y1, b.y1);
    }
    const contentH = y1 - y0 + 1;
    const contentW = x1 - x0 + 1;
    let scale = Math.min(
      (H - 2 * MARGIN) / contentH,
      (W - 2 * Math.floor(MARGIN * 0.55)) / contentW
    );
    if (scale > 1) scale = 1;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    let tx = W / 2;
    let ty = H / 2;

    function apply(srcCanvas, s, txx, tyy) {
      const ctx = createCanvas(W, H).getContext('2d');
      ctx.clearRect(0, 0, W, H);
      ctx.translate(txx, tyy);
      ctx.scale(s, s);
      ctx.translate(-cx, -cy);
      ctx.drawImage(srcCanvas, 0, 0);
      return ctx.canvas;
    }

    for (let iter = 0; iter < 25; iter++) {
      const probes = [clean, ooh, ko].map((s) => apply(s.canvas, scale, tx, ty));
      const pBoxes = probes.map((c) => bbox(c.getContext('2d').getImageData(0, 0, W, H).data));
      let ux0 = Infinity,
        uy0 = Infinity,
        ux1 = -Infinity,
        uy1 = -Infinity;
      for (const b of pBoxes) {
        if (!b) continue;
        ux0 = Math.min(ux0, b.x0);
        uy0 = Math.min(uy0, b.y0);
        ux1 = Math.max(ux1, b.x1);
        uy1 = Math.max(uy1, b.y1);
      }
      const side = Math.floor(MARGIN * 0.55);
      const ok =
        uy0 >= MARGIN &&
        uy1 <= H - 1 - MARGIN &&
        ux0 >= side &&
        ux1 <= W - 1 - side;
      if (ok) break;
      const ucx = (ux0 + ux1) / 2;
      const ucy = (uy0 + uy1) / 2;
      tx += W / 2 - ucx;
      ty += H / 2 - ucy;
      if (
        uy0 < MARGIN ||
        uy1 > H - 1 - MARGIN ||
        ux0 < side ||
        ux1 > W - 1 - side
      ) {
        scale *= 0.97;
        tx = W / 2;
        ty = H / 2;
      }
    }

    for (const file of files) {
      const src = await load(file);
      const out = apply(src.canvas, scale, tx, ty);
      writePng(path.join(root, file), out);
    }
    console.log(id, 'padded scale', scale.toFixed(3), 'margin', MARGIN);
  })();
}

// --- main ---
fs.mkdirSync(STAGE, { recursive: true });

for (const pack of PACKS) {
  ensure(pack.clean);
  const dir = path.join(STAGE, pack.id);
  fs.mkdirSync(dir, { recursive: true });

  const cleanRaw = path.join(dir, 'clean-raw.png');
  fs.copyFileSync(pack.clean, cleanRaw);
  await prePadSource(cleanRaw, path.join(dir, 'clean.png'), 0.14);

  if (pack.ooh === 'GENERATE') {
    const preferBlue = pack.id === 'male-boxer';
    const iris = preferBlue ? [70, 120, 190] : [120, 72, 42];
    console.log('Generating', pack.id, 'ooh/ko from clean…');
    const ooh = await generateExpression(path.join(dir, 'clean.png'), 'ooh', iris, preferBlue);
    const ko = await generateExpression(path.join(dir, 'clean.png'), 'ko', iris, preferBlue);
    writePng(path.join(dir, 'ooh.png'), ooh);
    writePng(path.join(dir, 'knockout.png'), ko);
  } else {
    ensure(pack.ooh);
    ensure(pack.ko);
    await prePadSource(pack.ooh, path.join(dir, 'ooh.png'), 0.14);
    await prePadSource(pack.ko, path.join(dir, 'knockout.png'), 0.14);
  }
  console.log('staged', pack.id);
}

// Process default first so mid-face reference is stable, then the rest.
const order = [
  'default',
  ...PACKS.map((p) => p.id).filter((id) => id !== 'default'),
];

for (const id of order) {
  const dir = path.join(STAGE, id);
  console.log('\n=== process', id, '===');
  const r = spawnSync(
    'node',
    [
      'scripts/process-character-pack.mjs',
      id,
      '--clean',
      path.join(dir, 'clean.png'),
      '--ooh',
      path.join(dir, 'ooh.png'),
      '--ko',
      path.join(dir, 'knockout.png'),
    ],
    { cwd: ROOT, encoding: 'utf8' }
  );
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) {
    console.error('FAILED', id, r.status);
    process.exit(1);
  }
}

console.log('\n=== pad large clear frames ===');
for (const id of order) {
  await padPackInPlace(id, MARGIN_FRAC);
}

console.log('\nAll packs rebuilt.');
