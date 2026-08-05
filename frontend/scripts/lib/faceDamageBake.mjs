/**
 * Shared face-bake helpers + cumulative injury painters.
 * Used by bake-damage-stage-faces.mjs and bake-bobo-clown-faces.mjs
 */
import { createCanvas } from 'canvas';

export const W = 1024;
export const H = 1024;

export const LM = {
  rightEye: { x: 0.382, y: 0.459 },
  leftEye: { x: 0.595, y: 0.443 },
  nose: { x: 0.5, y: 0.52 },
  mouth: { x: 0.504, y: 0.665 },
  bottomLip: { x: 0.504, y: 0.715 },
  chin: { x: 0.51, y: 0.8 },
  rightEar: { x: 0.162, y: 0.544, rx: 0.065, ry: 0.125 },
  leftEar: { x: 0.836, y: 0.536, rx: 0.065, ry: 0.125 },
  forehead: { x: 0.5, y: 0.295 },
};


/** When true, near-white clown face paint counts as paintable skin. */
export let allowClownSkin = false;
export function setAllowClownSkin(v) {
  allowClownSkin = !!v;
}

export function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}
export function mix(a, b, t) {
  return a * (1 - t) + b * t;
}
export function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
export function isBackdrop(r, g, b, a) {
  if (a < 20) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 22) return true;
  if (min > 232) return true;
  if (min > 200 && max - min < 14) return true;
  return false;
}
export function isLineArt(r, g, b) {
  return Math.max(r, g, b) < 55;
}
export function isIris(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  // Ignore near-gray / very bright (sclera-ish) pixels.
  if (chroma < 18 || max > 235) return false;

  // Green (Default): G dominant over R/B.
  if (g > 70 && g >= r - 5 && g > b + 5) return true;

  // Blue / blue-gray (The Don, Bozza, King Of The North).
  if (b > 75 && b >= g - 8 && b > r + 18 && g > 50 && r < 160) return true;

  // Brown / amber / dark brown (Byson, Tin Mick): warm, modest luminance.
  // Cap max so bright ginger beard / peach / tan cheeks stay out.
  if (r >= g && g >= b && max <= 115 && chroma >= 25 && b < 50 && g < r * 0.85) {
    return true;
  }

  return false;
}
export function isSclera(r, g, b) {
  return r > 200 && g > 200 && b > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 30;
}
export function isTooth(r, g, b) {
  return r > 195 && g > 195 && b > 185 && Math.max(r, g, b) - Math.min(r, g, b) < 45;
}
export function isGlassesFrame(r, g, b, a) {
  return a > 200 && Math.max(r, g, b) < 48;
}
export function isSkinTone(r, g, b, a) {
  if (a < 20 || isBackdrop(r, g, b, a) || isLineArt(r, g, b)) return false;
  if (isIris(r, g, b) || isTooth(r, g, b) || isSclera(r, g, b) || isGlassesFrame(r, g, b, a)) return false;
  // Clown white face paint (warm off-white).
  if (allowClownSkin && r > 215 && g > 210 && b > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 40) {
    return true;
  }
  if (r < 130 || g < 85 || b < 60 || r < g - 10) return false;
  return true;
}
export function ellipseDist(nx, ny, cx, cy, rx, ry) {
  return Math.hypot((nx - cx) / rx, (ny - cy) / ry);
}
export function softEdge(d, inner = 0.82) {
  if (d <= inner) return 1;
  if (d >= 1) return 0;
  // Smoothstep feather
  const t = (d - inner) / (1 - inner);
  return 1 - t * t * (3 - 2 * t);
}
export function sampleBilinear(data, x, y) {
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

export function copyImageData(src) {
  const out = createCanvas(W, H).getContext('2d').createImageData(W, H);
  out.data.set(src.data);
  return out;
}

/**
 * Inflamed skin: a redder shade of the caricature's peach skin
 * (warm red, not purple). `shade` 0 = darker fold, 1 = highlight.
 */
export function inflamedFromSkin(skinR, skinG, skinB, shade = 0.55, strength = 0.45) {
  // Push toward red while keeping peach character.
  const targetR = Math.min(255, skinR + 28);
  const targetG = skinG * 0.72;
  const targetB = skinB * 0.52;
  let r = mix(skinR, targetR, strength);
  let g = mix(skinG, targetG, strength);
  let b = mix(skinB, targetB, strength);
  const lit = 0.86 + shade * 0.2;
  r *= lit;
  g *= lit;
  b *= lit;
  // Ensure warm red (R > G > B), never magenta/purple.
  if (b > g * 0.8) b = g * 0.7;
  if (g > r * 0.88) g = r * 0.85;
  return [clamp(r), clamp(g), clamp(b)];
}

export function sampleFaceSkin(clean) {
  // Cheek sample on the photo caricature.
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let y = Math.floor(H * 0.48); y < Math.floor(H * 0.62); y += 2) {
    for (let x = Math.floor(W * 0.42); x < Math.floor(W * 0.58); x += 2) {
      const i = (y * W + x) * 4;
      const r = clean.data[i];
      const g = clean.data[i + 1];
      const b = clean.data[i + 2];
      const a = clean.data[i + 3];
      if (!isSkinTone(r, g, b, a)) continue;
      sr += r;
      sg += g;
      sb += b;
      n++;
    }
  }
  return n ? [sr / n, sg / n, sb / n] : [250, 170, 120];
}

/**
 * Cauliflower ear — real wrestler's/boxer's ear traits:
 * keep the tall ear silhouette, fill the hollow folds with scar tissue,
 * thicken the helix into a few irregular knobs (not a round balloon pad).
 * Color: taut reddish shade of the caricature skin.
 */
export function applyCauliflowerEar(face, clean, side, skin) {
  const ear = side === 'left' ? LM.leftEar : LM.rightEar;
  const outSign = side === 'left' ? 1 : -1;
  const [skinR, skinG, skinB] = skin;

  // 1) Seed mask from the clean ear's actual pixels (keeps tall ear shape).
  const seed = new Uint8Array(W * H);
  const x0 = Math.max(0, Math.floor((ear.x - ear.rx * 1.35) * W));
  const x1 = Math.min(W - 1, Math.ceil((ear.x + ear.rx * 1.35) * W));
  const y0 = Math.max(0, Math.floor((ear.y - ear.ry * 1.25) * H));
  const y1 = Math.min(H - 1, Math.ceil((ear.y + ear.ry * 1.25) * H));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      if (ellipseDist(nx, ny, ear.x, ear.y, ear.rx * 1.2, ear.ry * 1.15) > 1) continue;
      const i = (y * W + x) * 4;
      const r = clean.data[i];
      const g = clean.data[i + 1];
      const b = clean.data[i + 2];
      const a = clean.data[i + 3];
      if (a < 20 || isBackdrop(r, g, b, a)) continue;
      if (isGlassesFrame(r, g, b, a)) continue;
      if (isBlondeHair(r, g, b, a)) continue;
      // Ear flesh or ear line art.
      if (isSkinTone(r, g, b, a) || isLineArt(r, g, b) || (r > 120 && g > 70 && b > 40 && r >= g - 5)) {
        seed[y * W + x] = 1;
      }
    }
  }

  // 2) Curl inward: little outward growth; knobs fold toward the head/concha
  //    (real cauliflower ear rim curls in on itself).
  const dilateR = Math.max(2, Math.round(ear.rx * W * 0.05));
  const lumps = [
    // Fill the hollow (concha).
    { x: ear.x + outSign * ear.rx * 0.05, y: ear.y - ear.ry * 0.02, rx: ear.rx * 0.52, ry: ear.ry * 0.44 },
    // Upper helix curled in toward head.
    { x: ear.x + outSign * ear.rx * 0.35, y: ear.y - ear.ry * 0.4, rx: ear.rx * 0.34, ry: ear.ry * 0.24 },
    // Mid rim curled in.
    { x: ear.x + outSign * ear.rx * 0.4, y: ear.y + ear.ry * 0.08, rx: ear.rx * 0.36, ry: ear.ry * 0.26 },
    // Rolled rim ridge (folded helix).
    { x: ear.x + outSign * ear.rx * 0.55, y: ear.y - ear.ry * 0.12, rx: ear.rx * 0.22, ry: ear.ry * 0.38 },
  ];

  const solid = new Uint8Array(W * H);
  for (let y = y0 - dilateR; y <= y1 + dilateR; y++) {
    if (y < 0 || y >= H) continue;
    for (let x = x0 - dilateR; x <= x1 + dilateR; x++) {
      if (x < 0 || x >= W) continue;
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      let hit = false;
      for (let dy = -dilateR; dy <= dilateR && !hit; dy += 2) {
        for (let dx = -dilateR; dx <= dilateR && !hit; dx += 2) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          if (!seed[yy * W + xx]) continue;
          if (dx * dx + dy * dy <= dilateR * dilateR) hit = true;
        }
      }
      for (const L of lumps) {
        if (ellipseDist(nx, ny, L.x, L.y, L.rx, L.ry) <= 1) hit = true;
      }
      if (!hit) continue;
      // Trim the far-outer tip so the ear reads curled in, not flared out.
      const outward = outSign * (nx - ear.x);
      if (outward > ear.rx * 0.92 && !seed[y * W + x]) continue;
      solid[y * W + x] = 1;
    }
  }

  // Carve a shallow notch on the outer rim (folded-over curl).
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!solid[y * W + x]) continue;
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const outward = outSign * (nx - ear.x);
      // Scoop the outer mid-rim inward.
      if (outward > ear.rx * 0.55 && outward < ear.rx * 1.05) {
        const along = Math.abs(ny - ear.y) / ear.ry;
        if (along < 0.55) {
          // Keep only if near a curled lump; else clear flare.
          let nearCurl = false;
          for (const L of lumps.slice(1)) {
            if (ellipseDist(nx, ny, L.x, L.y, L.rx * 1.05, L.ry * 1.05) <= 1) nearCurl = true;
          }
          if (!nearCurl && !seed[y * W + x]) solid[y * W + x] = 0;
        }
      }
    }
  }

  let painted = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!solid[y * W + x]) continue;
      const i = (y * W + x) * 4;
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;

      const cr0 = clean.data[i];
      const cg0 = clean.data[i + 1];
      const cb0 = clean.data[i + 2];
      const ca0 = clean.data[i + 3];
      if (ca0 > 180 && Math.max(cr0, cg0, cb0) < 70) continue;
      if (faGlasses(face, i)) continue;
      if (isBlondeHair(face.data[i], face.data[i + 1], face.data[i + 2], face.data[i + 3])) continue;

      let dLump = 99;
      for (const L of lumps) dLump = Math.min(dLump, ellipseDist(nx, ny, L.x, L.y, L.rx, L.ry));
      const dEar = ellipseDist(nx, ny, ear.x, ear.y, ear.rx, ear.ry);
      const shade = Math.max(0, 1 - Math.min(dEar, dLump));

      // Redder inflamed skin.
      let strength = seed[y * W + x] ? 0.58 : 0.64;
      if (dLump < 1) strength = 0.72;
      if (ellipseDist(nx, ny, ear.x + outSign * ear.rx * 0.05, ear.y, ear.rx * 0.48, ear.ry * 0.42) < 0.9) {
        strength = 0.78;
      }
      let [rr, gg, bb] = inflamedFromSkin(skinR, skinG, skinB, 0.4 + shade * 0.4, strength);

      // Curl crease: darker fold where rim rolls in.
      const curlFold = ellipseDist(
        nx,
        ny,
        ear.x + outSign * ear.rx * 0.42,
        ear.y - ear.ry * 0.05,
        ear.rx * 0.18,
        ear.ry * 0.42,
      );
      if (curlFold < 1) {
        const [fr, fg, fb] = inflamedFromSkin(skinR, skinG, skinB, 0.2, 0.88);
        const ft = (1 - curlFold) * 0.65;
        rr = clamp(mix(rr, fr, ft));
        gg = clamp(mix(gg, fg, ft));
        bb = clamp(mix(bb, fb, ft));
      }

      // Shiny taut highlight on lump crowns.
      if (dLump < 0.4) {
        const hi = 1 - dLump / 0.4;
        rr = clamp(mix(rr, 255, hi * 0.28));
        gg = clamp(mix(gg, 175, hi * 0.18));
        bb = clamp(mix(bb, 145, hi * 0.12));
      } else if (dLump > 0.72 && dLump < 1) {
        [rr, gg, bb] = inflamedFromSkin(skinR, skinG, skinB, 0.25, 0.8);
      }

      face.data[i] = rr;
      face.data[i + 1] = gg;
      face.data[i + 2] = bb;
      face.data[i + 3] = 255;
      painted++;
    }
  }

  // Outer perimeter outline only (follows knobby ear silhouette).
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!solid[y * W + x]) continue;
      let edge = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (!solid[(y + dy) * W + (x + dx)]) {
          edge = true;
          break;
        }
      }
      if (!edge) continue;
      const i = (y * W + x) * 4;
      if (clean.data[i + 3] > 180 && Math.max(clean.data[i], clean.data[i + 1], clean.data[i + 2]) < 70) continue;
      face.data[i] = clamp(mix(face.data[i], 30, 0.8));
      face.data[i + 1] = clamp(mix(face.data[i + 1], 18, 0.8));
      face.data[i + 2] = clamp(mix(face.data[i + 2], 20, 0.8));
    }
  }
  return painted;
}

export function faGlasses(face, i) {
  return isGlassesFrame(face.data[i], face.data[i + 1], face.data[i + 2], face.data[i + 3]);
}

/**
 * Black eye — male change: deep purple orbital bruise + drooping lid over
 * top of iris. Smooth falloff, iris/glasses preserved.
 */
export function applyBlackEye(face, which) {
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

/**
 * Cross-shaped plaster (Band-Aid) on the chin — two overlapping strips
 * forming a +, cream cloth like a first-aid plaster.
 */
export function applyChinCrossPlaster(face, clean) {
  const chin = LM.chin;
  // Strip half-sizes in normalized coords.
  const hLen = 0.07; // horizontal strip half-length
  const hWid = 0.018; // horizontal strip half-width
  const vLen = 0.065;
  const vWid = 0.017;
  const pad = 0.004; // rounded ends

  let painted = 0;
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
      const cr0 = clean.data[i];
      const cg0 = clean.data[i + 1];
      const cb0 = clean.data[i + 2];
      const ca0 = clean.data[i + 3];
      // Only on chin skin (don't paint into void / teeth / mouth).
      if (ca0 < 20 || isBackdrop(cr0, cg0, cb0, ca0)) continue;
      if (!isSkinTone(cr0, cg0, cb0, ca0) && !isLineArt(cr0, cg0, cb0)) continue;
      if (isTooth(cr0, cg0, cb0) || isIris(cr0, cg0, cb0)) continue;

      // Edge falloff for soft plaster ends.
      let edge = 1;
      if (inH) {
        const ex = Math.abs(dx) > hLen ? 1 - (Math.abs(dx) - hLen) / pad : 1;
        const ey = Math.abs(dy) > hWid * 0.85 ? 1 - (Math.abs(dy) - hWid * 0.85) / (hWid * 0.15 + pad) : 1;
        edge = Math.min(edge, Math.max(0, ex), Math.max(0, ey));
      }
      if (inV) {
        const ey = Math.abs(dy) > vLen ? 1 - (Math.abs(dy) - vLen) / pad : 1;
        const ex = Math.abs(dx) > vWid * 0.85 ? 1 - (Math.abs(dx) - vWid * 0.85) / (vWid * 0.15 + pad) : 1;
        edge = Math.max(edge, Math.min(Math.max(0, ex), Math.max(0, ey)));
        if (!inH) edge = Math.min(Math.max(0, ex), Math.max(0, ey));
      }
      if (edge < 0.08) continue;

      // Cream plaster cloth.
      let cr = 242;
      let cg = 228;
      let cb = 198;
      // Soft center pad (slightly thicker look at crossing).
      if (Math.abs(dx) < vWid * 1.1 && Math.abs(dy) < hWid * 1.1) {
        cr = 248;
        cg = 236;
        cb = 210;
      }
      // Tiny fabric fold lines.
      if (inH && Math.abs((dy / hWid) % 1) < 0.12) {
        cr = mix(cr, 220, 0.25);
        cg = mix(cg, 205, 0.25);
        cb = mix(cb, 175, 0.25);
      }
      if (inV && Math.abs((dx / vWid) % 1) < 0.12) {
        cr = mix(cr, 220, 0.2);
        cg = mix(cg, 205, 0.2);
        cb = mix(cb, 175, 0.2);
      }
      // Small blood speck under the cross center.
      if (Math.hypot(dx, dy) < 0.012) {
        const bt = 1 - Math.hypot(dx, dy) / 0.012;
        cr = mix(cr, 170, bt * 0.45);
        cg = mix(cg, 70, bt * 0.45);
        cb = mix(cb, 55, bt * 0.45);
      }

      const t = Math.min(1, edge);
      const fr = face.data[i];
      const fg = face.data[i + 1];
      const fb = face.data[i + 2];
      face.data[i] = clamp(mix(fr, cr, t));
      face.data[i + 1] = clamp(mix(fg, cg, t));
      face.data[i + 2] = clamp(mix(fb, cb, t));
      face.data[i + 3] = 255;
      painted++;
    }
  }

  // Thin outline around plaster for cartoon cohesion.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const dx = nx - chin.x;
      const dy = ny - chin.y;
      const inH = Math.abs(dx) <= hLen && Math.abs(dy) <= hWid;
      const inV = Math.abs(dy) <= vLen && Math.abs(dx) <= vWid;
      if (!inH && !inV) continue;
      // Perimeter ring only.
      const onEdgeH = inH && (Math.abs(dx) > hLen - 0.003 || Math.abs(dy) > hWid - 0.0025);
      const onEdgeV = inV && (Math.abs(dy) > vLen - 0.003 || Math.abs(dx) > vWid - 0.0025);
      if (!onEdgeH && !onEdgeV) continue;
      const i = (y * W + x) * 4;
      if (face.data[i + 3] < 40) continue;
      face.data[i] = clamp(mix(face.data[i], 170, 0.35));
      face.data[i + 1] = clamp(mix(face.data[i + 1], 150, 0.35));
      face.data[i + 2] = clamp(mix(face.data[i + 2], 120, 0.35));
    }
  }
  return painted;
}

export function applyMissingTooth(face) {
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
export function applySwollenEye(face, which) {
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

export function applyBrokenNose(face) {
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

/** True if pixel is solid head content with a margin from the void edge. */
export function isInteriorHead(clean, x, y, margin = 4) {
  for (let dy = -margin; dy <= margin; dy++) {
    for (let dx = -margin; dx <= margin; dx++) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) return false;
      const i = (yy * W + xx) * 4;
      const r = clean.data[i];
      const g = clean.data[i + 1];
      const b = clean.data[i + 2];
      const a = clean.data[i + 3];
      if (a < 20 || isBackdrop(r, g, b, a)) return false;
    }
  }
  return true;
}

export function isBlondeHair(r, g, b, a) {
  if (a < 20) return false;
  // Spiky blonde hair: high R+G, lower B, not peach skin.
  return r > 150 && g > 120 && b < 130 && r + g > 300 && g > b + 25 && Math.abs(r - g) < 80;
}

/** Small forehead cut — thin crimson slit (replaces the old plaster bandage). */
export function applyForeheadCut(face, clean) {
  const fh = LM.forehead;
  let painted = 0;
  // Short diagonal cut centred on the forehead
  const cutCx = fh.x;
  const cutCy = fh.y + 0.01;
  const halfLen = 0.038;
  const halfThick = 0.007;
  const angle = -0.35; // slight tilt
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      const dx = nx - cutCx;
      const dy = ny - cutCy;
      // Local coords along / across the cut
      const along = dx * cos + dy * sin;
      const across = -dx * sin + dy * cos;
      if (Math.abs(along) > halfLen || Math.abs(across) > halfThick * 2.2) continue;
      if (ny < 0.24 || ny > 0.36) continue;

      const i = (y * W + x) * 4;
      if (!isInteriorHead(clean, x, y, 5)) continue;

      const cr0 = clean.data[i];
      const cg0 = clean.data[i + 1];
      const cb0 = clean.data[i + 2];
      const ca0 = clean.data[i + 3];
      if (isBlondeHair(cr0, cg0, cb0, ca0) && Math.abs(nx - cutCx) > 0.08) continue;
      if (!isSkinTone(cr0, cg0, cb0, ca0) && !isBlondeHair(cr0, cg0, cb0, ca0) && !isLineArt(cr0, cg0, cb0)) {
        continue;
      }

      const r = face.data[i];
      const g = face.data[i + 1];
      const b = face.data[i + 2];
      const a = face.data[i + 3];
      if (a > 20 && (isGlassesFrame(r, g, b, a) || isIris(r, g, b))) continue;

      // Soft capsule falloff along the slit
      const u = Math.abs(along) / halfLen;
      const v = Math.abs(across) / halfThick;
      const core = Math.max(0, 1 - u * u) * Math.max(0, 1 - v * v);
      if (core < 0.05) continue;

      // Dark crimson cut + slightly lighter swollen lip edges
      const edge = Math.max(0, 1 - Math.abs(v));
      const isCore = Math.abs(across) < halfThick * 0.55;
      let cr;
      let cg;
      let cb;
      if (isCore) {
        cr = mix(90, 40, core);
        cg = mix(28, 8, core);
        cb = mix(28, 10, core);
      } else {
        // Inflamed rim
        cr = mix(r, 160, 0.55 * edge);
        cg = mix(g, 70, 0.55 * edge);
        cb = mix(b, 60, 0.55 * edge);
      }
      // Tiny blood bead near the lower end
      const bead = ellipseDist(nx, ny, cutCx + halfLen * cos * 0.55, cutCy + halfLen * sin * 0.55 + 0.012, 0.01, 0.014);
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
      face.data[i + 3] = 255;
      painted++;
    }
  }
  return painted;
}

/** @deprecated Use applyForeheadCut — kept for bake script imports. */
export function applyForeheadBandage(face, clean) {
  return applyForeheadCut(face, clean);
}


