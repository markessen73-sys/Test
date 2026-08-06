/**
 * Scale a character face pack so mid-face width @ y=0.55 matches Default boxer.
 * Preserves full hair/chin by uniform scale around the nose landmark.
 *
 * Usage: node scripts/rescale-character-pack-to-default.mjs bozza king-of-the-north
 */
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { W, H, LM } from './lib/faceDamageBake.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAR_ROOT = path.resolve(__dirname, '../public/faces/characters');
const REF_ID = 'default';

function spanAtY(data, yFrac) {
  const y = Math.max(0, Math.min(H - 1, Math.round(yFrac * H)));
  let x0 = -1;
  let x1 = -1;
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * 4 + 3] > 40) {
      if (x0 < 0) x0 = x;
      x1 = x;
    }
  }
  if (x0 < 0) return null;
  return { w: x1 - x0 + 1 };
}

async function loadRgba(filePath) {
  const img = await loadImage(filePath);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  return ctx.getImageData(0, 0, W, H);
}

async function scalePng(filePath, scale, pivotX, pivotY) {
  const img = await loadImage(filePath);
  const out = createCanvas(W, H);
  const ctx = out.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.translate(pivotX, pivotY);
  ctx.scale(scale, scale);
  ctx.translate(-pivotX, -pivotY);
  ctx.drawImage(img, 0, 0, W, H);
  fs.writeFileSync(filePath, out.toBuffer('image/png'));
}

function listPngs(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name.endsWith('.png') && fs.statSync(p).isFile()) out.push(p);
  }
  return out;
}

async function main() {
  const ids = process.argv.slice(2);
  if (!ids.length) {
    console.error('Usage: node scripts/rescale-character-pack-to-default.mjs <character-id> ...');
    process.exit(1);
  }

  const refPath = path.join(CHAR_ROOT, REF_ID, 'clean.png');
  const refData = await loadRgba(refPath);
  const refSpan = spanAtY(refData.data, 0.55);
  if (!refSpan) throw new Error('Could not measure default mid-face width');

  const pivotX = LM.nose.x * W;
  const pivotY = LM.nose.y * H;
  console.log(`Reference ${REF_ID} mid-face width @0.55: ${refSpan.w}px`);

  for (const id of ids) {
    const root = path.join(CHAR_ROOT, id);
    const paths = [
      path.join(root, 'clean.png'),
      path.join(root, 'ooh.png'),
      path.join(root, 'knockout.png'),
      ...listPngs(path.join(root, 'damage-stages')),
      ...listPngs(path.join(root, 'bobo-clown-stages')),
    ].filter((p) => fs.existsSync(p));

    const cleanData = await loadRgba(path.join(root, 'clean.png'));
    const cleanSpan = spanAtY(cleanData.data, 0.55);
    if (!cleanSpan) throw new Error(`Could not measure ${id} mid-face width`);
    const scale = refSpan.w / cleanSpan.w;
    console.log(`${id}: ${cleanSpan.w}px -> scale ${scale.toFixed(4)}`);

    for (const filePath of paths) {
      await scalePng(filePath, scale, pivotX, pivotY);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
