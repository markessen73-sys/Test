/**
 * Fill interior transparent holes in male/female face packs (clean/ooh/KO +
 * damage + bobo mirrors) and in ring body textures.
 *
 *   node scripts/fix-pack-holes-and-bodies.mjs
 */
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, '../public');
const CHAR_ROOT = path.join(PUBLIC, 'faces/characters');
const BODY_DIR = path.join(PUBLIC, 'boxer/bodies');

const FACE_PACKS = ['male-boxer', 'female-boxer'];

function fillInteriorHoles(data, W, H) {
  const n = W * H;
  const trans = new Uint8Array(n);
  for (let i = 0; i < n; i++) trans[i] = data[i * 4 + 3] < 40 ? 1 : 0;
  const bg = new Uint8Array(n);
  const q = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
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
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  let filled = 0;
  for (let iter = 0; iter < 120; iter++) {
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

function hardenSoftInterior(data, W, H) {
  // Soft semi-transparent interior fringe → opaque (keep exterior soft clear).
  const n = W * H;
  const trans = new Uint8Array(n);
  for (let i = 0; i < n; i++) trans[i] = data[i * 4 + 3] < 40 ? 1 : 0;
  const bg = new Uint8Array(n);
  const q = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
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
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  let nSoft = 0;
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3];
    if (a <= 0 || a >= 40) continue;
    if (bg[i]) {
      data[i * 4 + 3] = 0;
      continue;
    }
    data[i * 4 + 3] = 255;
    nSoft++;
  }
  return nSoft;
}

async function fixPng(file) {
  const img = await loadImage(file);
  const W = img.width;
  const H = img.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, W, H);
  const soft = hardenSoftInterior(id.data, W, H);
  const holes = fillInteriorHoles(id.data, W, H);
  ctx.putImageData(id, 0, 0);
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
  return { holes, soft, W, H };
}

function listPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith('.png'))
    .map((n) => path.join(dir, n));
}

async function fixFacePack(id) {
  const root = path.join(CHAR_ROOT, id);
  const files = [
    ...['clean.png', 'ooh.png', 'knockout.png'].map((n) => path.join(root, n)),
    ...listPngs(path.join(root, 'damage-stages')),
    ...listPngs(path.join(root, 'bobo-clown-stages')),
  ].filter((f) => fs.existsSync(f));
  console.log('\n===', id, `(${files.length} pngs) ===`);
  for (const file of files) {
    const r = await fixPng(file);
    console.log(
      ' ',
      path.relative(root, file),
      'holes',
      r.holes,
      'soft',
      r.soft
    );
  }
}

async function fixBodies() {
  const files = [
    path.join(PUBLIC, 'boxer/sparring-boxer.png'),
    ...listPngs(BODY_DIR).filter((f) => !f.includes('-thumb')),
  ];
  console.log('\n=== bodies ===');
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const r = await fixPng(file);
    console.log(' ', path.basename(file), 'holes', r.holes, 'soft', r.soft);
  }
}

for (const id of FACE_PACKS) await fixFacePack(id);
await fixBodies();
console.log('\nDone');
