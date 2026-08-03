/**
 * Replace forehead plaster on character pack HUD stages with a small cut.
 * Shared `/faces/damage-stages` and `/faces/bobo-clown-stages` are rebaked
 * separately; this patches per-character packs from stage 07 + cut.
 *
 * Usage: node scripts/replace-forehead-plaster-with-cut.mjs
 */
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  W,
  H,
  LM,
  clamp,
  mix,
  isIris,
  isGlassesFrame,
  isBlondeHair,
  ellipseDist,
  copyImageData,
  applyForeheadCut,
} from './lib/faceDamageBake.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAR_ROOT = path.resolve(__dirname, '../public/faces/characters');
const IDS = ['default', 'byson', 'tin-mick', 'the-don'];

function loadFace(file) {
  return loadImage(file).then((img) => {
    const ctx = createCanvas(W, H).getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    return ctx.getImageData(0, 0, W, H);
  });
}

function writeFace(file, face) {
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.putImageData(face, 0, 0);
  fs.writeFileSync(file, ctx.canvas.toBuffer('image/png'));
}

/** Clown whiteface-safe small forehead cut (same as bake-bobo stage 08). */
function applyClownForeheadCut(face, clean) {
  let n = 0;
  const fh = LM.forehead;
  const cutCx = fh.x;
  const cutCy = fh.y + 0.01;
  const halfLen = 0.038;
  const halfThick = 0.007;
  const angle = -0.35;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const dx = nx - cutCx;
      const dy = ny - cutCy;
      const along = dx * cos + dy * sin;
      const across = -dx * sin + dy * cos;
      if (Math.abs(along) > halfLen || Math.abs(across) > halfThick * 2.2) continue;
      if (ny < 0.24 || ny > 0.36) continue;
      const i = (y * W + x) * 4;
      if (face.data[i + 3] < 40) continue;
      if (isGlassesFrame(face.data[i], face.data[i + 1], face.data[i + 2], face.data[i + 3])) continue;
      if (isIris(face.data[i], face.data[i + 1], face.data[i + 2])) continue;
      const r0 = clean.data[i];
      const g0 = clean.data[i + 1];
      const b0 = clean.data[i + 2];
      if (isBlondeHair(r0, g0, b0, clean.data[i + 3]) && ny < 0.26) continue;
      if (Math.max(r0, g0, b0) - Math.min(r0, g0, b0) > 80 && ny < 0.26) continue;

      const u = Math.abs(along) / halfLen;
      const v = Math.abs(across) / halfThick;
      const core = Math.max(0, 1 - u * u) * Math.max(0, 1 - v * v);
      if (core < 0.05) continue;

      const edge = Math.max(0, 1 - Math.abs(v));
      const isCore = Math.abs(across) < halfThick * 0.55;
      const r = face.data[i];
      const g = face.data[i + 1];
      const b = face.data[i + 2];
      let cr;
      let cg;
      let cb;
      if (isCore) {
        cr = mix(90, 40, core);
        cg = mix(28, 8, core);
        cb = mix(28, 10, core);
      } else {
        cr = mix(r, 160, 0.55 * edge);
        cg = mix(g, 70, 0.55 * edge);
        cb = mix(b, 60, 0.55 * edge);
      }
      const bead = ellipseDist(
        nx,
        ny,
        cutCx + halfLen * cos * 0.55,
        cutCy + halfLen * sin * 0.55 + 0.012,
        0.01,
        0.014,
      );
      if (bead < 1) {
        const bt = (1 - bead) * 0.65;
        cr = mix(cr, 150, bt);
        cg = mix(cg, 35, bt);
        cb = mix(cb, 35, bt);
      }
      const t = Math.min(1, isCore ? 0.92 * core + 0.35 : 0.7 * edge * core);
      face.data[i] = clamp(mix(r, cr, t));
      face.data[i + 1] = clamp(mix(g, cg, t));
      face.data[i + 2] = clamp(mix(b, cb, t));
      n++;
    }
  }
  return n;
}

/**
 * Swap plaster→cut on a KO face: where old 08 differed from 07 (plaster),
 * use the new 08 pixel; otherwise keep the KO pixel.
 */
function swapPlasterRegion(koFace, base07, old08, new08) {
  let n = 0;
  for (let i = 0; i < base07.data.length; i += 4) {
    const dr =
      Math.abs(old08.data[i] - base07.data[i]) +
      Math.abs(old08.data[i + 1] - base07.data[i + 1]) +
      Math.abs(old08.data[i + 2] - base07.data[i + 2]);
    if (dr < 25) continue;
    koFace.data[i] = new08.data[i];
    koFace.data[i + 1] = new08.data[i + 1];
    koFace.data[i + 2] = new08.data[i + 2];
    koFace.data[i + 3] = new08.data[i + 3];
    n++;
  }
  return n;
}

for (const id of IDS) {
  const damageDir = path.join(CHAR_ROOT, id, 'damage-stages');
  const clownDir = path.join(CHAR_ROOT, id, 'bobo-clown-stages');

  // Ring damage ladder
  const dClean = await loadFace(path.join(damageDir, '00-clean.png'));
  const d07 = await loadFace(path.join(damageDir, '07-brokenNose.png'));
  const dOld08 = await loadFace(path.join(damageDir, '08-foreheadBandage.png'));
  const d08 = copyImageData(d07);
  const dn = applyForeheadCut(d08, dClean);
  writeFace(path.join(damageDir, '08-foreheadBandage.png'), d08);
  writeFace(path.join(damageDir, '09-hold.png'), d08);
  const d10 = await loadFace(path.join(damageDir, '10-knockout.png'));
  const d10n = swapPlasterRegion(d10, d07, dOld08, d08);
  writeFace(path.join(damageDir, '10-knockout.png'), d10);
  console.log(id, 'damage cut', dn, 'ko swapped', d10n);

  // Clown ladder
  const cClean = await loadFace(path.join(clownDir, '00-clean.png'));
  const c07 = await loadFace(path.join(clownDir, '07-brokenNose.png'));
  const cOld08 = await loadFace(path.join(clownDir, '08-foreheadBandage.png'));
  const c08 = copyImageData(c07);
  const cn = applyClownForeheadCut(c08, cClean);
  writeFace(path.join(clownDir, '08-foreheadBandage.png'), c08);
  writeFace(path.join(clownDir, '09-hold.png'), c08);
  const c10 = await loadFace(path.join(clownDir, '10-knockout.png'));
  const c10n = swapPlasterRegion(c10, c07, cOld08, c08);
  writeFace(path.join(clownDir, '10-knockout.png'), c10);
  console.log(id, 'clown cut', cn, 'ko swapped', c10n);
}

// Also sync shared default mirrors from shared bake outputs when present
const facesRoot = path.resolve(__dirname, '../public/faces');
for (const [srcDir, destRel] of [
  ['damage-stages', 'characters/default/damage-stages'],
  ['bobo-clown-stages', 'characters/default/bobo-clown-stages'],
]) {
  for (const name of ['08-foreheadBandage.png', '09-hold.png', '10-knockout.png']) {
    const src = path.join(facesRoot, srcDir, name);
    const dest = path.join(facesRoot, destRel, name);
    if (fs.existsSync(src) && srcDir === 'damage-stages' && name !== '10-knockout.png') {
      // Shared damage 08/09 match template; copy onto default pack for consistency.
      fs.copyFileSync(src, dest);
    }
    if (srcDir === 'bobo-clown-stages' && fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }
}
console.log('Synced default pack 08/09 (and clown 08–10) from shared bake where applicable');
