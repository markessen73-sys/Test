/**
 * Bake 11 comedy-classic clown faces for the bobo doll.
 *
 * Same caricature layout + cumulative injury ladder as the ring damage stages,
 * with natural skin tone kept (no whiteface), red/blue clown accents, black
 * pupils, and a large multi-coloured curly wig.
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
 * Comedy clown makeup on the natural-skin caricature.
 * Keeps the character's real face colour; adds red/blue accents, black pupils,
 * and a large multi-coloured curly wig (works for bald + haired faces).
 */
function applyComedyClownMakeup(face, clean) {
  let painted = 0;

  // 1) Keep natural skin — no whiteface. (face already starts as a clean copy.)

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

  // 7) Large multi-coloured curly clown wig (covers bald heads + short hair).
  painted += paintCurlyClownWig(face, clean);

  return painted;
}

function hash01(ix, iy) {
  let n = (ix * 374761393 + iy * 668265263) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Big candy afro / curly wig — paints into backdrop and over the hairline. */
function paintCurlyClownWig(face, clean) {
  const palette = [
    [255, 45, 55],
    [255, 210, 40],
    [45, 110, 255],
    [255, 130, 40],
    [55, 200, 95],
    [190, 70, 255],
  ];
  const curls = [];
  // Horseshoe of curls around the crown + side puffs.
  for (let i = 0; i < 56; i++) {
    const t = i / 55;
    const ang = Math.PI * 1.12 + t * Math.PI * 1.76; // left → over top → right
    const rad = 0.33 + (hash01(i, 1) - 0.5) * 0.07;
    curls.push({
      x: 0.5 + Math.cos(ang) * rad,
      y: 0.4 + Math.sin(ang) * rad * 0.92 - 0.06,
      r: 0.042 + hash01(i, 2) * 0.038,
      rgb: palette[i % palette.length],
    });
  }
  // Extra top fluff for a tall curly silhouette.
  for (let i = 0; i < 28; i++) {
    curls.push({
      x: 0.22 + hash01(i, 3) * 0.56,
      y: 0.02 + hash01(i, 4) * 0.2,
      r: 0.048 + hash01(i, 5) * 0.042,
      rgb: palette[(i * 2 + 1) % palette.length],
    });
  }
  // Side puff volume near the ears (outside the face oval).
  for (let i = 0; i < 14; i++) {
    const side = i < 7 ? -1 : 1;
    const j = i % 7;
    curls.push({
      x: 0.5 + side * (0.34 + hash01(i, 6) * 0.1),
      y: 0.28 + j * 0.045 + hash01(i, 7) * 0.02,
      r: 0.05 + hash01(i, 8) * 0.03,
      rgb: palette[(i + 3) % palette.length],
    });
  }

  let painted = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      // Keep the face proper (eyes/cheeks/mouth) clear — wig only above hairline + sides.
      const inFaceCore = ellipseDist(nx, ny, 0.5, 0.54, 0.29, 0.33) < 1 && ny > 0.3;
      if (inFaceCore) continue;
      // Leave most of each ear visible.
      const onEar =
        ellipseDist(nx, ny, LM.leftEar.x, LM.leftEar.y, LM.leftEar.rx * 1.05, LM.leftEar.ry * 1.05) < 1 ||
        ellipseDist(nx, ny, LM.rightEar.x, LM.rightEar.y, LM.rightEar.rx * 1.05, LM.rightEar.ry * 1.05) < 1;
      if (onEar && ny > 0.42) continue;
      // Overall wig shell.
      const inShell = ellipseDist(nx, ny, 0.5, 0.34, 0.48, 0.42) < 1 && ny < 0.64;
      const inSidePuff =
        ny > 0.22 &&
        ny < 0.58 &&
        ((nx < 0.22 && nx > 0.04) || (nx > 0.78 && nx < 0.96));
      if (!inShell && !inSidePuff) continue;

      // Nearest curl — soft round "locks".
      let best = 9;
      let bestRgb = null;
      let bestEdge = 0;
      for (const c of curls) {
        const d = Math.hypot(nx - c.x, ny - c.y) / c.r;
        if (d < best) {
          best = d;
          bestRgb = c.rgb;
          bestEdge = softEdge(d, 0.55);
        }
      }
      if (!bestRgb || best > 1.05 || bestEdge < 0.04) continue;

      const i = (y * W + x) * 4;
      const a0 = face.data[i + 3];
      const voidish = a0 < 28 || isBackdrop(face.data[i], face.data[i + 1], face.data[i + 2], a0);
      const onHair =
        isBlondeHair(clean.data[i], clean.data[i + 1], clean.data[i + 2], clean.data[i + 3]) ||
        (clean.data[i + 3] > 40 && ny < 0.34);
      // Also allow covering bald crown skin above the hairline.
      const onCrownSkin =
        clean.data[i + 3] > 40 &&
        ny < 0.34 &&
        isSkinTone(clean.data[i], clean.data[i + 1], clean.data[i + 2], clean.data[i + 3]);
      if (!voidish && !onHair && !onCrownSkin) continue;

      // Slight shading between curls.
      const shade = best < 0.45 ? 1 : mix(0.72, 1, bestEdge);
      const t = Math.min(1, bestEdge * (voidish ? 1 : 0.98));
      face.data[i] = clamp(mix(face.data[i], bestRgb[0] * shade, t));
      face.data[i + 1] = clamp(mix(face.data[i + 1], bestRgb[1] * shade, t));
      face.data[i + 2] = clamp(mix(face.data[i + 2], bestRgb[2] * shade, t));
      face.data[i + 3] = 255;
      painted++;
    }
  }
  return painted;
}

/** Clown KO — closed eyes, sad-clown frown, stars; lids match natural skin. */
function applyClownKnockout(face, clean) {
  // Force-cover eyes with natural-skin shut lids + arc.
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
        // Sample nearby clean skin for lid colour (fallback peach).
        const sx = Math.max(0, Math.min(W - 1, x + (x < W / 2 ? -18 : 18)));
        const sy = Math.max(0, Math.min(H - 1, y + 22));
        const si = (sy * W + sx) * 4;
        let lr = clean.data[si];
        let lg = clean.data[si + 1];
        let lb = clean.data[si + 2];
        if (
          clean.data[si + 3] < 40 ||
          !isSkinTone(lr, lg, lb, clean.data[si + 3])
        ) {
          lr = 220;
          lg = 160;
          lb = 120;
        }
        const lidT = Math.min(1, softEdge(d, 0.55) * 1.05);
        face.data[i] = clamp(mix(fr, lr, lidT));
        face.data[i + 1] = clamp(mix(fg, lg, lidT));
        face.data[i + 2] = clamp(mix(fb, lb, lidT));
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
          // Restore natural skin from the clean caricature.
          face.data[i] = clean.data[i];
          face.data[i + 1] = clean.data[i + 1];
          face.data[i + 2] = clean.data[i + 2];
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

  // Hide teeth with a soft closed-mouth fill under the frown (natural lip tone).
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      if (ellipseDist(nx, ny, mouth.x, mouth.y + 0.01, 0.11, 0.05) >= 1) continue;
      const i = (y * W + x) * 4;
      if (!isTooth(face.data[i], face.data[i + 1], face.data[i + 2])) continue;
      const cr = clean.data[i];
      const cg = clean.data[i + 1];
      const cb = clean.data[i + 2];
      face.data[i] = clamp(mix(cr, 160, 0.35));
      face.data[i + 1] = clamp(mix(cg, 90, 0.35));
      face.data[i + 2] = clamp(mix(cb, 80, 0.35));
    }
  }

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
      // Only paint into void / near head edge, or over hair / curly wig.
      const a = face.data[i + 3];
      const fr = face.data[i];
      const fg = face.data[i + 1];
      const fb = face.data[i + 2];
      const onHair = isBlondeHair(fr, fg, fb, a);
      const onWig =
        a > 180 &&
        ny < 0.5 &&
        Math.max(fr, fg, fb) > 140 &&
        Math.max(fr, fg, fb) - Math.min(fr, fg, fb) > 40;
      const voidish = a < 30 || isBackdrop(fr, fg, fb, a);
      if (!voidish && !onHair && !onWig && r > 0.55) continue;
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

// From here, injuries paint on natural skin (+ clown accents).
setAllowClownSkin(false);
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
