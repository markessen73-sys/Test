/**
 * Bake 11 comedy-classic clown faces for the bobo doll.
 *
 * Same caricature layout + cumulative injury ladder as the ring damage stages,
 * but first painted as a classic whiteface clown (white paint, red nose,
 * diamond eye makeup, big smile, rosy cheeks, candy hair tips).
 *
 * Stages 0–10:
 *   00 clean clown
 *   01–08 cumulative injuries (same order as ring)
 *   09 last injury face (copy of 08)
 *   10 clown knockout
 *
 * Usage: node scripts/bake-bobo-clown-faces.mjs
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
  isBackdrop,
  isLineArt,
  isIris,
  isSclera,
  isTooth,
  isGlassesFrame,
  isSkinTone,
  isBlondeHair,
  ellipseDist,
  softEdge,
  copyImageData,
  sampleFaceSkin,
  setAllowClownSkin,
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
const OUT = path.join(BASE, 'bobo-clown-stages');

function put(ctx, face, file) {
  ctx.putImageData(face, 0, 0);
  fs.writeFileSync(path.join(OUT, file), ctx.canvas.toBuffer('image/png'));
}

/**
 * Classic comedy whiteface clown makeup on the photo caricature.
 * Preserves glasses, eyes, teeth, line art, and ear silhouettes.
 */
function applyComedyClownMakeup(face, clean) {
  let painted = 0;

  // 1) Full white face paint on skin (keep shading via luminance).
  for (let i = 0; i < face.data.length; i += 4) {
    const r = clean.data[i];
    const g = clean.data[i + 1];
    const b = clean.data[i + 2];
    const a = clean.data[i + 3];
    if (a < 20 || isBackdrop(r, g, b, a)) continue;
    if (isGlassesFrame(r, g, b, a) || isLineArt(r, g, b)) continue;
    if (isIris(r, g, b) || isSclera(r, g, b) || isTooth(r, g, b)) continue;
    if (isBlondeHair(r, g, b, a)) continue;
    // Broad peach / flesh catch — full whiteface coverage.
    const flesh =
      isSkinTone(r, g, b, a) ||
      (r > 140 && g > 90 && b > 60 && r >= g - 8 && g >= b - 15 && Math.max(r, g, b) - Math.min(r, g, b) > 18);
    if (!flesh) continue;

    const x = (i / 4) % W;
    const y = ((i / 4) / W) | 0;
    const nx = (x + 0.5) / W;
    const ny = (y + 0.5) / H;
    // Keep ears closer to flesh so cauliflower injuries still read later.
    const onEar =
      ellipseDist(nx, ny, LM.leftEar.x, LM.leftEar.y, LM.leftEar.rx * 1.15, LM.leftEar.ry * 1.15) < 1 ||
      ellipseDist(nx, ny, LM.rightEar.x, LM.rightEar.y, LM.rightEar.rx * 1.15, LM.rightEar.ry * 1.15) < 1;

    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    const shade = Math.max(0.88, Math.min(1.06, L / 200));
    let wr = 252 * shade;
    let wg = 250 * shade;
    let wb = 246 * shade;
    if (ny > 0.62 && ny < 0.82) {
      wr *= 0.97;
      wg *= 0.975;
      wb *= 0.99;
    }
    const t = onEar ? 0.28 : 0.97;
    face.data[i] = clamp(mix(r, wr, t));
    face.data[i + 1] = clamp(mix(g, wg, t));
    face.data[i + 2] = clamp(mix(b, wb, t));
    painted++;
  }

  // 2) Rosy cheek circles — classic clown blush (below glasses).
  for (const cheek of [
    { x: 0.3, y: 0.6 },
    { x: 0.7, y: 0.59 },
  ]) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        const d = ellipseDist(nx, ny, cheek.x, cheek.y, 0.065, 0.05);
        if (d >= 1) continue;
        const i = (y * W + x) * 4;
        if (face.data[i + 3] < 40) continue;
        if (isGlassesFrame(face.data[i], face.data[i + 1], face.data[i + 2], face.data[i + 3])) continue;
        if (isIris(face.data[i], face.data[i + 1], face.data[i + 2])) continue;
        const t = softEdge(d, 0.5) * 0.72;
        face.data[i] = clamp(mix(face.data[i], 235, t));
        face.data[i + 1] = clamp(mix(face.data[i + 1], 85, t));
        face.data[i + 2] = clamp(mix(face.data[i + 2], 100, t));
        painted++;
      }
    }
  }

  // 3) Big shiny red clown nose over the bulbous caricature nose.
  {
    const nose = LM.nose;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        const d = ellipseDist(nx, ny, nose.x, nose.y + 0.012, 0.08, 0.072);
        if (d >= 1) continue;
        const i = (y * W + x) * 4;
        if (clean.data[i + 3] < 20 || isBackdrop(clean.data[i], clean.data[i + 1], clean.data[i + 2], clean.data[i + 3])) {
          continue;
        }
        if (isGlassesFrame(face.data[i], face.data[i + 1], face.data[i + 2], face.data[i + 3])) continue;
        const edge = softEdge(d, 0.78);
        const hi = ellipseDist(nx, ny, nose.x - 0.022, nose.y - 0.01, 0.028, 0.022);
        let rr = 215;
        let gg = 32;
        let bb = 40;
        if (d > 0.72) {
          rr = 155;
          gg = 20;
          bb = 30;
        }
        if (hi < 1) {
          const ht = (1 - hi) * 0.8;
          rr = mix(rr, 255, ht);
          gg = mix(gg, 155, ht);
          bb = mix(bb, 150, ht);
        }
        const t = Math.min(1, edge);
        face.data[i] = clamp(mix(face.data[i], rr, t));
        face.data[i + 1] = clamp(mix(face.data[i + 1], gg, t));
        face.data[i + 2] = clamp(mix(face.data[i + 2], bb, t));
        face.data[i + 3] = 255;
        painted++;
      }
    }
  }

  // 4) Small red diamonds ABOVE the glasses (classic eye accents).
  for (const eye of [LM.leftEye, LM.rightEye]) {
    const cx = eye.x;
    const cy = eye.y - 0.095;
    const rx = 0.032;
    const ry = 0.04;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        const d = Math.abs(nx - cx) / rx + Math.abs(ny - cy) / ry;
        if (d >= 1.02) continue;
        // Stay above the glasses brow line.
        if (ny > eye.y - 0.055) continue;
        const i = (y * W + x) * 4;
        if (clean.data[i + 3] < 20) continue;
        if (isGlassesFrame(clean.data[i], clean.data[i + 1], clean.data[i + 2], clean.data[i + 3])) continue;
        const edge = d > 0.78;
        if (edge) {
          face.data[i] = 40;
          face.data[i + 1] = 22;
          face.data[i + 2] = 26;
        } else {
          const t = softEdge(d, 0.7) * 0.95;
          face.data[i] = clamp(mix(face.data[i], 210, t));
          face.data[i + 1] = clamp(mix(face.data[i + 1], 40, t));
          face.data[i + 2] = clamp(mix(face.data[i + 2], 50, t));
        }
        face.data[i + 3] = 255;
        painted++;
      }
    }
  }

  // 5) Classic clown smile — red lip outline around teeth + upward corner wings.
  {
    const mouth = LM.mouth;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        const dx = nx - mouth.x;
        const i = (y * W + x) * 4;
        if (face.data[i + 3] < 20) continue;
        if (isTooth(face.data[i], face.data[i + 1], face.data[i + 2])) continue;
        if (isGlassesFrame(face.data[i], face.data[i + 1], face.data[i + 2], face.data[i + 3])) continue;

        // Mouth oval ring (lips only — outside the tooth row).
        const md = ellipseDist(nx, ny, mouth.x, mouth.y + 0.01, 0.13, 0.07);
        const inner = ellipseDist(nx, ny, mouth.x, mouth.y + 0.005, 0.1, 0.045);
        const onLip = md < 1 && inner > 0.78;

        // Upward smile wings from corners toward cheeks (not through mouth).
        const cornerX = Math.abs(dx);
        const wingTargetY = mouth.y - 0.02 - (cornerX - 0.1) * 0.7;
        const onWing =
          cornerX >= 0.1 &&
          cornerX <= 0.19 &&
          Math.abs(ny - wingTargetY) < 0.018 &&
          ny <= mouth.y + 0.01;

        if (!onLip && !onWing) continue;
        const t = onLip ? 0.94 : 0.9;
        face.data[i] = clamp(mix(face.data[i], 205, t));
        face.data[i + 1] = clamp(mix(face.data[i + 1], 30, t));
        face.data[i + 2] = clamp(mix(face.data[i + 2], 45, t));
        painted++;
      }
    }
  }

  // 6) Candy-coloured hair tips (red / blue / yellow).
  const tips = [
    { x: 0.38, y: 0.16, rgb: [220, 50, 60] },
    { x: 0.5, y: 0.12, rgb: [255, 210, 50] },
    { x: 0.62, y: 0.16, rgb: [50, 110, 220] },
    { x: 0.28, y: 0.22, rgb: [255, 210, 50] },
    { x: 0.72, y: 0.22, rgb: [220, 50, 60] },
  ];
  for (const tip of tips) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        const d = ellipseDist(nx, ny, tip.x, tip.y, 0.055, 0.05);
        if (d >= 1) continue;
        const i = (y * W + x) * 4;
        const r = clean.data[i];
        const g = clean.data[i + 1];
        const b = clean.data[i + 2];
        const a = clean.data[i + 3];
        if (!isBlondeHair(r, g, b, a) && !(a > 40 && r > 140 && g > 100 && b < 140 && ny < 0.32)) continue;
        const t = softEdge(d, 0.65) * 0.85;
        face.data[i] = clamp(mix(face.data[i], tip.rgb[0], t));
        face.data[i + 1] = clamp(mix(face.data[i + 1], tip.rgb[1], t));
        face.data[i + 2] = clamp(mix(face.data[i + 2], tip.rgb[2], t));
        painted++;
      }
    }
  }

  return painted;
}

/** Clown KO — closed eyes, sad-clown frown, stars, keep whiteface + red nose. */
function applyClownKnockout(face, clean) {
  // Force-cover eyes (bruises / iris / lids) with pale shut lids + arc.
  for (const eye of [LM.leftEye, LM.rightEye]) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        const d = ellipseDist(nx, ny, eye.x, eye.y + 0.002, 0.07, 0.055);
        if (d >= 1) continue;
        const i = (y * W + x) * 4;
        const fr = face.data[i];
        const fg = face.data[i + 1];
        const fb = face.data[i + 2];
        if (isGlassesFrame(fr, fg, fb, face.data[i + 3])) continue;
        // Opaque lid — erase green iris / purple bruise / swell.
        const lidT = Math.min(1, softEdge(d, 0.55) * 1.05);
        face.data[i] = clamp(mix(fr, 250, lidT));
        face.data[i + 1] = clamp(mix(fg, 248, lidT));
        face.data[i + 2] = clamp(mix(fb, 245, lidT));
        face.data[i + 3] = 255;
        const lidY = eye.y + 0.01 + Math.pow(Math.abs(nx - eye.x) / 0.055, 2) * 0.014;
        if (Math.abs(ny - lidY) < 0.008 && Math.abs(nx - eye.x) < 0.055) {
          face.data[i] = 40;
          face.data[i + 1] = 28;
          face.data[i + 2] = 30;
        }
      }
    }
  }

  // Clear red smile / lip paint in the mouth zone, then paint a sad frown.
  const mouth = LM.mouth;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const dx = nx - mouth.x;
      const i = (y * W + x) * 4;
      if (face.data[i + 3] < 20) continue;
      if (isTooth(face.data[i], face.data[i + 1], face.data[i + 2])) continue;

      const nearMouth = ellipseDist(nx, ny, mouth.x, mouth.y, 0.22, 0.14) < 1;
      if (nearMouth) {
        const isRedLip = face.data[i] > 150 && face.data[i + 1] < 100 && face.data[i + 2] < 110;
        if (isRedLip) {
          face.data[i] = 248;
          face.data[i + 1] = 246;
          face.data[i + 2] = 242;
        }
      }

      // Downward frown curve + downturned corner wings.
      const frownY = mouth.y + 0.025 + Math.pow(Math.abs(dx) / 0.13, 2) * 0.045;
      const onFrown = Math.abs(dx) < 0.14 && Math.abs(ny - frownY) < 0.016;
      const downWing =
        Math.abs(dx) >= 0.1 &&
        Math.abs(dx) <= 0.18 &&
        Math.abs(ny - (mouth.y + 0.03 + (Math.abs(dx) - 0.1) * 0.65)) < 0.016;
      if (!onFrown && !downWing) continue;
      face.data[i] = 190;
      face.data[i + 1] = 28;
      face.data[i + 2] = 42;
    }
  }

  // Hide teeth with a soft closed-mouth fill under the frown.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      if (ellipseDist(nx, ny, mouth.x, mouth.y + 0.01, 0.11, 0.05) >= 1) continue;
      const i = (y * W + x) * 4;
      if (!isTooth(face.data[i], face.data[i + 1], face.data[i + 2])) continue;
      face.data[i] = 245;
      face.data[i + 1] = 242;
      face.data[i + 2] = 238;
    }
  }

  void clean;

  const stars = [
    { x: 0.2, y: 0.2, s: 0.038 },
    { x: 0.8, y: 0.18, s: 0.036 },
    { x: 0.15, y: 0.36, s: 0.03 },
    { x: 0.86, y: 0.34, s: 0.032 },
    { x: 0.34, y: 0.08, s: 0.028 },
    { x: 0.66, y: 0.07, s: 0.028 },
  ];
  for (const st of stars) {
    drawStar(face, st.x, st.y, st.s, [255, 220, 60]);
  }
}

function drawStar(face, cx, cy, size, rgb) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const dx = (nx - cx) / size;
      const dy = (ny - cy) / size;
      const ang = Math.atan2(dy, dx);
      const r = Math.hypot(dx, dy);
      // 5-point star radius modulation.
      const tip = Math.cos(ang * 5) * 0.5 + 0.5;
      const rad = 0.45 + tip * 0.55;
      if (r > rad) continue;
      const i = (y * W + x) * 4;
      // Only paint into void / near head edge, or over hair.
      const a = face.data[i + 3];
      const onHair = isBlondeHair(face.data[i], face.data[i + 1], face.data[i + 2], a);
      const voidish = a < 30 || isBackdrop(face.data[i], face.data[i + 1], face.data[i + 2], a);
      if (!voidish && !onHair && r > 0.55) continue;
      const t = r < rad * 0.7 ? 1 : (rad - r) / (rad * 0.3);
      face.data[i] = clamp(mix(face.data[i], rgb[0], t));
      face.data[i + 1] = clamp(mix(face.data[i + 1], rgb[1], t));
      face.data[i + 2] = clamp(mix(face.data[i + 2], rgb[2], t));
      face.data[i + 3] = 255;
    }
  }
}

// ---------------------------------------------------------------------------
const liveImg = await loadImage(`${BASE}/test-template-face.png`);
const liveCtx = createCanvas(W, H).getContext('2d');
liveCtx.drawImage(liveImg, 0, 0, W, H);
const photoClean = liveCtx.getImageData(0, 0, W, H);

fs.mkdirSync(OUT, { recursive: true });

// Clown base from photo caricature.
let face = copyImageData(photoClean);
const makeupN = applyComedyClownMakeup(face, photoClean);
console.log('clown makeup pixels', makeupN);

// From here, injuries paint on whiteface.
setAllowClownSkin(true);
const clownClean = copyImageData(face);
const skin = sampleFaceSkin(clownClean);
// Prefer a warm flesh sample for ear inflammation (from original cheeks).
const peachSkin = sampleFaceSkin(photoClean);
console.log('clown skin', skin.map((v) => Math.round(v)), 'peach', peachSkin.map((v) => Math.round(v)));

put(liveCtx, face, '00-clean.png');

const steps = [
  { name: '01-cauliflowerLeftEar', run: () => applyCauliflowerEar(face, clownClean, 'left', peachSkin) },
  { name: '02-blackRightEye', run: () => applyBlackEye(face, 'right') },
  { name: '03-chinCrossPlaster', run: () => applyChinCrossPlaster(face, clownClean) },
  { name: '04-cauliflowerRightEar', run: () => applyCauliflowerEar(face, clownClean, 'right', peachSkin) },
  { name: '05-missingTooth', run: () => applyMissingTooth(face) },
  { name: '06-swollenLeftEye', run: () => applySwollenEye(face, 'left') },
  { name: '07-brokenNose', run: () => applyBrokenNose(face) },
  { name: '08-foreheadBandage', run: () => applyForeheadBandage(face, clownClean) },
];

for (const step of steps) {
  const n = step.run();
  put(liveCtx, face, `${step.name}.png`);
  console.log(step.name, n);
}

// 09 = hold last injury face (90%).
put(liveCtx, face, '09-hold.png');
console.log('09-hold (copy of 08)');

// 10 = clown KO from the fully damaged clown face (damage HUD at 100%).
applyClownKnockout(face, clownClean);
put(liveCtx, face, '10-knockout.png');
console.log('10-knockout');

// Live doll expressions (no injury stamps) — same pattern as the ring partner.
async function bakeClownExpression(srcName, outName) {
  const img = await loadImage(`${BASE}/${srcName}`);
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.drawImage(img, 0, 0, W, H);
  const src = ctx.getImageData(0, 0, W, H);
  const out = copyImageData(src);
  const n = applyComedyClownMakeup(out, src);
  put(ctx, out, outName);
  console.log(outName, 'makeup', n);
}

await bakeClownExpression('test-template-face-ooh.png', 'ooh.png');
await bakeClownExpression('test-template-face-knockout.png', 'knockout-clean.png');

console.log('Wrote 11 stages + ooh + knockout-clean to', OUT);
