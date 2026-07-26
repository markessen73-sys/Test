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
  applyMissingTooth,
  applySwollenEye,
  applyBrokenNose,
} from './lib/faceDamageBake.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(__dirname, '../public/faces');
const OUT = path.join(BASE, 'bobo-clown-stages');

function put(ctx, face, file) {
  ctx.putImageData(face, 0, 0);
  fs.writeFileSync(path.join(OUT, file), ctx.canvas.toBuffer('image/png'));
}

/** Barycentric point-in-triangle test. */
function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const v0x = cx - ax;
  const v0y = cy - ay;
  const v1x = bx - ax;
  const v1y = by - ay;
  const v2x = px - ax;
  const v2y = py - ay;
  const dot00 = v0x * v0x + v0y * v0y;
  const dot01 = v0x * v1x + v0y * v1y;
  const dot02 = v0x * v2x + v0y * v2y;
  const dot11 = v1x * v1x + v1y * v1y;
  const dot12 = v1x * v2x + v1y * v2y;
  const den = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(den) < 1e-12) return false;
  const inv = 1 / den;
  const u = (dot11 * dot02 - dot01 * dot12) * inv;
  const v = (dot00 * dot12 - dot01 * dot02) * inv;
  return u >= 0 && v >= 0 && u + v <= 1;
}

/**
 * Crisp anime-style triangular catchlight in the upper-left of a black pupil.
 * Tip points top-left; sized to read on the bobo doll head.
 */
function paintAnimeEyeGlint(face, eyeX, eyeY) {
  // Large right-triangle catchlight (tip top-left) + small round sparkle.
  const a = { x: eyeX - 0.024, y: eyeY - 0.022 }; // tip
  const b = { x: eyeX + 0.002, y: eyeY - 0.024 };
  const c = { x: eyeX - 0.022, y: eyeY + 0.004 };
  const spark = { x: eyeX + 0.002, y: eyeY + 0.014, r: 0.0055 };

  const x0 = Math.max(0, Math.floor((eyeX - 0.035) * W));
  const x1 = Math.min(W - 1, Math.ceil((eyeX + 0.015) * W));
  const y0 = Math.max(0, Math.floor((eyeY - 0.035) * H));
  const y1 = Math.min(H - 1, Math.ceil((eyeY + 0.025) * H));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const i = (y * W + x) * 4;
      // Only paint onto the black pupil we just filled.
      if (face.data[i + 3] < 200) continue;
      if (face.data[i] > 20 || face.data[i + 1] > 20 || face.data[i + 2] > 20) continue;
      // Stay inside the pupil disk so the glint doesn't spill onto sclera.
      if (ellipseDist(nx, ny, eyeX, eyeY, 0.04, 0.038) >= 1) continue;

      const inTri = pointInTriangle(nx, ny, a.x, a.y, b.x, b.y, c.x, c.y);
      const inSpark = Math.hypot(nx - spark.x, ny - spark.y) <= spark.r;
      if (!inTri && !inSpark) continue;

      face.data[i] = 255;
      face.data[i + 1] = 255;
      face.data[i + 2] = 255;
      face.data[i + 3] = 255;
    }
  }
}

/**
 * Classic comedy whiteface clown makeup — vivid primaries on the photo caricature.
 * Preserves glasses, eyes, teeth, line art, and ear silhouettes.
 */
function applyComedyClownMakeup(face, clean) {
  let painted = 0;

  // 1) Opaque whiteface on all flesh (ears stay warmer so injury stamps still read).
  for (let i = 0; i < face.data.length; i += 4) {
    const r = clean.data[i];
    const g = clean.data[i + 1];
    const b = clean.data[i + 2];
    const a = clean.data[i + 3];
    if (a < 20 || isBackdrop(r, g, b, a)) continue;
    if (isGlassesFrame(r, g, b, a) || isLineArt(r, g, b)) continue;
    if (isIris(r, g, b) || isSclera(r, g, b) || isTooth(r, g, b)) continue;

    const x = (i / 4) % W;
    const y = ((i / 4) / W) | 0;
    const nx = (x + 0.5) / W;
    const ny = (y + 0.5) / H;
    // Peach skin matches the blonde-hair heuristic — only skip the real hair cap.
    if (isBlondeHair(r, g, b, a) && ny < 0.22) continue;
    // Catch peach, warm browns, and soft shadows as paintable flesh.
    const flesh =
      isSkinTone(r, g, b, a) ||
      (r > 120 && g > 75 && b > 50 && r >= g - 12 && g >= b - 25) ||
      (r > 160 && g > 110 && b > 80 && Math.abs(r - g) < 90);
    if (!flesh) continue;
    const onEar =
      ellipseDist(nx, ny, LM.leftEar.x, LM.leftEar.y, LM.leftEar.rx * 1.15, LM.leftEar.ry * 1.15) < 1 ||
      ellipseDist(nx, ny, LM.rightEar.x, LM.rightEar.y, LM.rightEar.rx * 1.15, LM.rightEar.ry * 1.15) < 1;

    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    const shade = Math.max(0.92, Math.min(1.05, L / 210));
    // Cool bright white greasepaint (reads as clown white, not peach).
    let wr = 255 * shade;
    let wg = 252 * shade;
    let wb = 248 * shade;
    if (ny > 0.64 && ny < 0.84) {
      wr *= 0.96;
      wg *= 0.97;
      wb *= 0.99;
    }
    const t = onEar ? 0.22 : 0.98;
    face.data[i] = clamp(mix(r, wr, t));
    face.data[i + 1] = clamp(mix(g, wg, t));
    face.data[i + 2] = clamp(mix(b, wb, t));
    painted++;
  }

  // 2) Big hot-pink cheek circles.
  for (const cheek of [
    { x: 0.28, y: 0.6 },
    { x: 0.72, y: 0.59 },
  ]) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        const d = ellipseDist(nx, ny, cheek.x, cheek.y, 0.09, 0.07);
        if (d >= 1) continue;
        const i = (y * W + x) * 4;
        if (face.data[i + 3] < 40) continue;
        if (isGlassesFrame(face.data[i], face.data[i + 1], face.data[i + 2], face.data[i + 3])) continue;
        if (isIris(face.data[i], face.data[i + 1], face.data[i + 2])) continue;
        const t = softEdge(d, 0.45) * 0.92;
        face.data[i] = clamp(mix(face.data[i], 255, t));
        face.data[i + 1] = clamp(mix(face.data[i + 1], 55, t));
        face.data[i + 2] = clamp(mix(face.data[i + 2], 110, t));
        painted++;
      }
    }
  }

  // 3) Bigger glossy tomato-red clown nose.
  {
    const nose = LM.nose;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        const d = ellipseDist(nx, ny, nose.x, nose.y + 0.01, 0.095, 0.085);
        if (d >= 1) continue;
        const i = (y * W + x) * 4;
        if (clean.data[i + 3] < 20 || isBackdrop(clean.data[i], clean.data[i + 1], clean.data[i + 2], clean.data[i + 3])) {
          continue;
        }
        if (isGlassesFrame(face.data[i], face.data[i + 1], face.data[i + 2], face.data[i + 3])) continue;
        const edge = softEdge(d, 0.8);
        const hi = ellipseDist(nx, ny, nose.x - 0.025, nose.y - 0.012, 0.032, 0.026);
        let rr = 255;
        let gg = 28;
        let bb = 36;
        if (d > 0.7) {
          rr = 190;
          gg = 12;
          bb = 24;
        }
        if (hi < 1) {
          const ht = (1 - hi) * 0.85;
          rr = mix(rr, 255, ht);
          gg = mix(gg, 180, ht);
          bb = mix(bb, 170, ht);
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

  // 4) Larger eye diamonds — red above left, blue above right (classic candy pair).
  const diamonds = [
    { eye: LM.rightEye, rgb: [40, 90, 255] },
    { eye: LM.leftEye, rgb: [255, 40, 55] },
  ];
  for (const { eye, rgb } of diamonds) {
    const cx = eye.x;
    const cy = eye.y - 0.1;
    const rx = 0.042;
    const ry = 0.055;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        const d = Math.abs(nx - cx) / rx + Math.abs(ny - cy) / ry;
        if (d >= 1.02) continue;
        if (ny > eye.y - 0.05) continue;
        const i = (y * W + x) * 4;
        if (clean.data[i + 3] < 20) continue;
        if (isGlassesFrame(clean.data[i], clean.data[i + 1], clean.data[i + 2], clean.data[i + 3])) continue;
        const edge = d > 0.78;
        if (edge) {
          face.data[i] = 30;
          face.data[i + 1] = 18;
          face.data[i + 2] = 22;
        } else {
          const t = softEdge(d, 0.65) * 0.98;
          face.data[i] = clamp(mix(face.data[i], rgb[0], t));
          face.data[i + 1] = clamp(mix(face.data[i + 1], rgb[1], t));
          face.data[i + 2] = clamp(mix(face.data[i + 2], rgb[2], t));
        }
        face.data[i + 3] = 255;
        painted++;
      }
    }
  }

  // 5) Thick bright-red clown smile + wider corner wings.
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

        const md = ellipseDist(nx, ny, mouth.x, mouth.y + 0.01, 0.145, 0.08);
        const inner = ellipseDist(nx, ny, mouth.x, mouth.y + 0.005, 0.1, 0.042);
        const onLip = md < 1 && inner > 0.72;

        const cornerX = Math.abs(dx);
        const wingTargetY = mouth.y - 0.015 - (cornerX - 0.1) * 0.75;
        const onWing =
          cornerX >= 0.095 &&
          cornerX <= 0.22 &&
          Math.abs(ny - wingTargetY) < 0.024 &&
          ny <= mouth.y + 0.015;

        if (!onLip && !onWing) continue;
        const t = onLip ? 0.98 : 0.95;
        face.data[i] = clamp(mix(face.data[i], 255, t));
        face.data[i + 1] = clamp(mix(face.data[i + 1], 20, t));
        face.data[i + 2] = clamp(mix(face.data[i + 2], 40, t));
        painted++;
      }
    }
  }

  // 6) Solid black pupils — fill the whole iris disk (kills white specular glints).
  let pupilN = 0;
  for (const eye of [LM.leftEye, LM.rightEye]) {
    // Only open eyes (source still has a colored iris) — skip closed KO lids.
    // Match green Default irises and brown/amber ones (Byson etc.).
    let open = false;
    for (let y = Math.floor((eye.y - 0.04) * H); y < Math.ceil((eye.y + 0.04) * H) && !open; y++) {
      for (let x = Math.floor((eye.x - 0.04) * W); x < Math.ceil((eye.x + 0.04) * W); x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = (y * W + x) * 4;
        const r = clean.data[i];
        const g = clean.data[i + 1];
        const b = clean.data[i + 2];
        if (clean.data[i + 3] <= 200) continue;
        if ((g > 85 && g > r + 5 && g > b + 5 && r < 180) || isIris(r, g, b)) {
          open = true;
          break;
        }
      }
    }
    if (!open) continue;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        // Large solid pupil — covers iris, glints, and inner sclera (no white in the middle).
        const d = ellipseDist(nx, ny, eye.x, eye.y, 0.046, 0.044);
        if (d >= 1) continue;
        const i = (y * W + x) * 4;
        // Only protect glasses frame near the disk rim.
        if (
          d > 0.85 &&
          isGlassesFrame(clean.data[i], clean.data[i + 1], clean.data[i + 2], clean.data[i + 3])
        ) {
          continue;
        }
        face.data[i] = 0;
        face.data[i + 1] = 0;
        face.data[i + 2] = 0;
        face.data[i + 3] = 255;
        painted++;
        pupilN++;
      }
    }
    // Scrub any non-black speck left inside the pupil disk.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        if (ellipseDist(nx, ny, eye.x, eye.y, 0.044, 0.042) >= 1) continue;
        const i = (y * W + x) * 4;
        if (
          isGlassesFrame(clean.data[i], clean.data[i + 1], clean.data[i + 2], clean.data[i + 3])
        ) {
          continue;
        }
        if (face.data[i + 3] < 200 || face.data[i] > 2 || face.data[i + 1] > 2 || face.data[i + 2] > 2) {
          face.data[i] = 0;
          face.data[i + 1] = 0;
          face.data[i + 2] = 0;
          face.data[i + 3] = 255;
        }
      }
    }

    // Anime-style triangular catchlight in the top-left of each pupil.
    paintAnimeEyeGlint(face, eye.x, eye.y);
  }
  console.log('black pupils painted', pupilN);

  // 7) Bright candy wig — large primary patches across the hair.
  const tips = [
    { x: 0.36, y: 0.15, rx: 0.09, ry: 0.08, rgb: [255, 45, 55] },
    { x: 0.5, y: 0.11, rx: 0.1, ry: 0.085, rgb: [255, 220, 40] },
    { x: 0.64, y: 0.15, rx: 0.09, ry: 0.08, rgb: [45, 120, 255] },
    { x: 0.25, y: 0.22, rx: 0.08, ry: 0.07, rgb: [255, 220, 40] },
    { x: 0.75, y: 0.22, rx: 0.08, ry: 0.07, rgb: [255, 45, 55] },
    { x: 0.42, y: 0.2, rx: 0.07, ry: 0.06, rgb: [45, 120, 255] },
    { x: 0.58, y: 0.2, rx: 0.07, ry: 0.06, rgb: [255, 45, 55] },
  ];
  for (const tip of tips) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        const d = ellipseDist(nx, ny, tip.x, tip.y, tip.rx, tip.ry);
        if (d >= 1) continue;
        const i = (y * W + x) * 4;
        const r = clean.data[i];
        const g = clean.data[i + 1];
        const b = clean.data[i + 2];
        const a = clean.data[i + 3];
        if (!isBlondeHair(r, g, b, a) && !(a > 40 && r > 130 && g > 95 && b < 150 && ny < 0.36)) {
          continue;
        }
        const t = softEdge(d, 0.55) * 0.95;
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
  {
    name: '03-chinCrossPlaster',
    run: () => {
      // Shared painter only stamps on peach skin; clown chin is white/red smile paint.
      let n = 0;
      const chin = LM.chin;
      const hLen = 0.07;
      const hWid = 0.018;
      const vLen = 0.065;
      const vWid = 0.017;
      const pad = 0.004;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const nx = (x + 0.5) / W;
          const ny = (y + 0.5) / H;
          const dx = nx - chin.x;
          const dy = ny - chin.y;
          const inH =
            Math.abs(dx) <= hLen + pad &&
            Math.abs(dy) <= hWid + pad &&
            (Math.abs(dx) <= hLen || Math.hypot(Math.abs(dx) - hLen, dy) <= hWid);
          const inV =
            Math.abs(dy) <= vLen + pad &&
            Math.abs(dx) <= vWid + pad &&
            (Math.abs(dy) <= vLen || Math.hypot(dx, Math.abs(dy) - vLen) <= vWid);
          if (!inH && !inV) continue;
          const i = (y * W + x) * 4;
          if (face.data[i + 3] < 20) continue;
          if (isIris(face.data[i], face.data[i + 1], face.data[i + 2])) continue;
          // Don't use isTooth() — whiteface greasepaint matches the tooth heuristic.
          const inMouth = ellipseDist(nx, ny, LM.mouth.x, LM.mouth.y, 0.12, 0.06) < 1;
          if (inMouth) continue;
          let cr = 242;
          let cg = 228;
          let cb = 198;
          if (Math.abs(dx) < vWid * 1.1 && Math.abs(dy) < hWid * 1.1) {
            cr = 248;
            cg = 236;
            cb = 210;
          }
          if (Math.hypot(dx, dy) < 0.012) {
            const bt = 1 - Math.hypot(dx, dy) / 0.012;
            cr = mix(cr, 170, bt * 0.45);
            cg = mix(cg, 70, bt * 0.45);
            cb = mix(cb, 55, bt * 0.45);
          }
          face.data[i] = cr;
          face.data[i + 1] = cg;
          face.data[i + 2] = cb;
          face.data[i + 3] = 255;
          n++;
        }
      }
      return n;
    },
  },
  { name: '04-cauliflowerRightEar', run: () => applyCauliflowerEar(face, clownClean, 'right', peachSkin) },
  { name: '05-missingTooth', run: () => applyMissingTooth(face) },
  { name: '06-swollenLeftEye', run: () => applySwollenEye(face, 'left') },
  { name: '07-brokenNose', run: () => applyBrokenNose(face) },
  {
    name: '08-foreheadBandage',
    run: () => {
      // Shared painter uses a tight head-interior margin that fails on whiteface;
      // paint a cream band directly for the clown HUD stages.
      let n = 0;
      const fh = LM.forehead;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const nx = (x + 0.5) / W;
          const ny = (y + 0.5) / H;
          const d = ellipseDist(nx, ny, fh.x, fh.y, 0.2, 0.055);
          if (d >= 1 || ny < 0.23 || ny > 0.35) continue;
          const i = (y * W + x) * 4;
          if (face.data[i + 3] < 40) continue;
          if (isGlassesFrame(face.data[i], face.data[i + 1], face.data[i + 2], face.data[i + 3])) continue;
          if (isIris(face.data[i], face.data[i + 1], face.data[i + 2])) continue;
          // Stay on face (white paint / skin), skip candy hair.
          const r0 = clownClean.data[i];
          const g0 = clownClean.data[i + 1];
          const b0 = clownClean.data[i + 2];
          if (isBlondeHair(r0, g0, b0, clownClean.data[i + 3]) && ny < 0.24) continue;
          if (Math.max(r0, g0, b0) - Math.min(r0, g0, b0) > 80 && ny < 0.26) continue;
          const edge = softEdge(d, 0.85);
          if (edge < 0.1) continue;
          let cr = 245;
          let cg = 232;
          let cb = 200;
          const fold = Math.abs(((nx * 36) % 1) - 0.5);
          if (fold < 0.07) {
            cr = mix(cr, 210, 0.3);
            cg = mix(cg, 190, 0.3);
            cb = mix(cb, 155, 0.3);
          }
          face.data[i] = clamp(mix(face.data[i], cr, edge));
          face.data[i + 1] = clamp(mix(face.data[i + 1], cg, edge));
          face.data[i + 2] = clamp(mix(face.data[i + 2], cb, edge));
          n++;
        }
      }
      return n;
    },
  },
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
