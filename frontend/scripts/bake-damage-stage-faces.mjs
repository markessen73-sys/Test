/**
 * Bake cumulative damage-stage faces for the ring HUD.
 *
 * Replicates each original-boxer injury change on the photo caricature:
 * grow/recolor cauliflower ears, purple black-eye + lid droop, chin cross
 * plaster, missing tooth, swollen-shut eye, broken-nose cut, forehead bandage.
 *
 * Usage: node scripts/bake-damage-stage-faces.mjs
 */
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  W,
  H,
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
const BASE = path.resolve(__dirname, '../public/faces');
const OUT = path.join(BASE, 'damage-stages');

const liveImg = await loadImage(`${BASE}/test-template-face.png`);
const liveCtx = createCanvas(W, H).getContext('2d');
liveCtx.drawImage(liveImg, 0, 0, W, H);
const clean = liveCtx.getImageData(0, 0, W, H);
let face = copyImageData(clean);
const skin = sampleFaceSkin(clean);
console.log('skin sample', skin.map((v) => Math.round(v)));

fs.mkdirSync(OUT, { recursive: true });
liveCtx.putImageData(face, 0, 0);
fs.writeFileSync(`${OUT}/00-clean.png`, liveCtx.canvas.toBuffer('image/png'));

const steps = [
  { name: '01-cauliflowerLeftEar', run: () => applyCauliflowerEar(face, clean, 'left', skin) },
  { name: '02-blackRightEye', run: () => applyBlackEye(face, 'right') },
  { name: '03-chinCrossPlaster', run: () => applyChinCrossPlaster(face, clean) },
  { name: '04-cauliflowerRightEar', run: () => applyCauliflowerEar(face, clean, 'right', skin) },
  { name: '05-missingTooth', run: () => applyMissingTooth(face) },
  { name: '06-swollenLeftEye', run: () => applySwollenEye(face, 'left') },
  { name: '07-brokenNose', run: () => applyBrokenNose(face) },
  { name: '08-foreheadBandage', run: () => applyForeheadBandage(face, clean) },
];

for (const step of steps) {
  const n = step.run();
  liveCtx.putImageData(face, 0, 0);
  fs.writeFileSync(`${OUT}/${step.name}.png`, liveCtx.canvas.toBuffer('image/png'));
  console.log(step.name, n);
}

// 90% holds the last injury face (stage 9); 100% uses the authored KO face.
liveCtx.putImageData(face, 0, 0);
fs.writeFileSync(`${OUT}/09-hold.png`, liveCtx.canvas.toBuffer('image/png'));
console.log('09-hold (same as 08)');

const koImg = await loadImage(`${BASE}/test-template-face-knockout.png`);
liveCtx.clearRect(0, 0, W, H);
liveCtx.drawImage(koImg, 0, 0, W, H);
fs.writeFileSync(`${OUT}/10-knockout.png`, liveCtx.canvas.toBuffer('image/png'));
console.log('10-knockout');

console.log('Wrote 11 stage faces →', OUT);
