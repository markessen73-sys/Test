/**
 * Guardrails for per-character face packs under public/faces/characters/<id>/.
 *
 * Catches the regressions we hit adding Byson:
 *  - clean eyes/mouth not on damage-bake landmarks (black eye / stamps miss)
 *  - knockout head shrunk vs clean (independent affine over-scale)
 *  - clown bake left colored irises instead of Default-style black pupils
 *  - isIris() missing non-green eye colors (brown/amber)
 *  - incomplete stage file sets
 *
 * Usage:
 *   node scripts/check-character-faces.mjs
 *   npm run check:characters
 *
 * Requires the same `canvas` native module as the bake scripts
 * (`npm install --no-save canvas` if needed). Exit 0 = pass, 1 = fail.
 */
import { createCanvas, loadImage } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { W, H, LM, isIris, isSclera, ellipseDist, lum } from './lib/faceDamageBake.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAR_ROOT = path.resolve(__dirname, '../public/faces/characters');

const DAMAGE_NAMES = [
  '00-clean.png',
  '01-cauliflowerLeftEar.png',
  '02-blackRightEye.png',
  '03-chinCrossPlaster.png',
  '04-cauliflowerRightEar.png',
  '05-missingTooth.png',
  '06-swollenLeftEye.png',
  '07-brokenNose.png',
  '08-foreheadBandage.png',
  '09-hold.png',
  '10-knockout.png',
];

const CLOWN_EXTRA = ['ooh.png', 'knockout-clean.png'];

/** Max normalized distance from detected eye/mouth to LM. */
const LM_EYE_TOL = 0.035;
const LM_MOUTH_TOL = 0.055;
/** KO mid-face width vs clean — outside this range looks like a shrink/grow pop. */
const KO_WIDTH_MIN = 0.92;
const KO_WIDTH_MAX = 1.12;
/** Clown pupil disk: min fraction of near-black (or white glint) pixels. */
const CLOWN_BLACK_MIN = 0.72;

const failures = [];
const warnings = [];

function fail(id, msg) {
  failures.push(`[${id}] ${msg}`);
}
function warn(id, msg) {
  warnings.push(`[${id}] ${msg}`);
}

function listCharacterIds() {
  if (!fs.existsSync(CHAR_ROOT)) return [];
  return fs
    .readdirSync(CHAR_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function requiredPaths(id) {
  const root = path.join(CHAR_ROOT, id);
  const paths = [
    path.join(root, 'clean.png'),
    path.join(root, 'ooh.png'),
    path.join(root, 'knockout.png'),
  ];
  for (const name of DAMAGE_NAMES) paths.push(path.join(root, 'damage-stages', name));
  for (const name of DAMAGE_NAMES) paths.push(path.join(root, 'bobo-clown-stages', name));
  for (const name of CLOWN_EXTRA) paths.push(path.join(root, 'bobo-clown-stages', name));
  return paths;
}

async function loadRgba(filePath) {
  const img = await loadImage(filePath);
  const ctx = createCanvas(W, H).getContext('2d');
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  return ctx.getImageData(0, 0, W, H);
}

function opaqueBBox(data, { skipYellow = false } = {}) {
  let x0 = W,
    y0 = H,
    x1 = 0,
    y1 = 0,
    n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = data[i + 3];
      if (a < 20) continue;
      if (skipYellow) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (r > 200 && g > 170 && b < 100) continue; // KO stars
      }
      n++;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (!n) return null;
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, n };
}

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
  return { x0, x1, w: x1 - x0 + 1 };
}

/** Detect open-eye centers via iris/sclera near each LM eye (local, not global). */
function detectEyeNear(data, eye, searchR = 0.07) {
  const pts = [];
  const x0 = Math.max(0, Math.floor((eye.x - searchR) * W));
  const x1 = Math.min(W - 1, Math.ceil((eye.x + searchR) * W));
  const y0 = Math.max(0, Math.floor((eye.y - searchR) * H));
  const y1 = Math.min(H - 1, Math.ceil((eye.y + searchR) * H));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      if (Math.hypot(nx - eye.x, ny - eye.y) > searchR) continue;
      const i = (y * W + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 200) continue;
      // Prefer iris (tighter on pupil) over wide sclera rings.
      if (isIris(r, g, b)) pts.push([x, y, 2]);
      else if (isSclera(r, g, b)) pts.push([x, y, 1]);
    }
  }
  if (pts.length < 25) return null;
  let sx = 0;
  let sy = 0;
  let sw = 0;
  for (const [x, y, w] of pts) {
    sx += x * w;
    sy += y * w;
    sw += w;
  }
  return { x: sx / sw / W, y: sy / sw / H, n: pts.length };
}

function detectMouth(data) {
  const teeth = [];
  for (let y = Math.floor(0.55 * H); y < Math.floor(0.8 * H); y++) {
    for (let x = Math.floor(0.3 * W); x < Math.floor(0.7 * W); x++) {
      const i = (y * W + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 200) continue;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (r > 195 && g > 195 && b > 185 && chroma < 45) teeth.push([x, y]);
    }
  }
  if (teeth.length < 30) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of teeth) {
    sx += x;
    sy += y;
  }
  return { x: sx / teeth.length / W, y: sy / teeth.length / H, n: teeth.length };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Fraction of pupil-disk pixels that look like Default clown eyes (black + white glint). */
function clownPupilBlackFraction(data, eye) {
  let total = 0;
  let ok = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      if (ellipseDist(nx, ny, eye.x, eye.y, 0.04, 0.038) >= 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < 180) continue;
      total++;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const L = lum(r, g, b);
      const nearBlack = L < 28;
      const glint = r > 220 && g > 220 && b > 220;
      if (nearBlack || glint) ok++;
    }
  }
  return total > 40 ? ok / total : 0;
}

function meanLumInEllipse(data, cx, cy, rx, ry) {
  let s = 0;
  let n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      if (ellipseDist(nx, ny, cx, cy, rx, ry) >= 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < 40) continue;
      s += lum(data[i], data[i + 1], data[i + 2]);
      n++;
    }
  }
  return n ? s / n : null;
}

function checkIsIrisHeuristics() {
  const id = 'isIris';
  // Green Default iris.
  if (!isIris(70, 140, 55)) fail(id, 'green iris sample not detected');
  // Brown / amber (Byson-like).
  if (!isIris(95, 60, 35)) fail(id, 'brown iris sample not detected');
  // Dark brown (Tin Mick-like).
  if (!isIris(81, 32, 4)) fail(id, 'dark brown iris sample not detected');
  // Bright ginger beard must NOT count as iris (would skip bruise paint).
  if (isIris(190, 110, 55)) fail(id, 'bright beard sample wrongly counted as iris');
  // Skin peach must not count as iris.
  if (isIris(246, 157, 103)) fail(id, 'skin sample wrongly counted as iris');
  // Medium-dark cheek must not count as iris.
  if (isIris(124, 66, 31)) fail(id, 'dark cheek sample wrongly counted as iris');
}

async function checkCharacter(id) {
  const root = path.join(CHAR_ROOT, id);
  for (const p of requiredPaths(id)) {
    if (!fs.existsSync(p)) fail(id, `missing ${path.relative(root, p)}`);
  }
  const cleanPath = path.join(root, 'clean.png');
  const oohPath = path.join(root, 'ooh.png');
  const koPath = path.join(root, 'knockout.png');
  if (![cleanPath, oohPath, koPath].every((p) => fs.existsSync(p))) return;

  const clean = await loadRgba(cleanPath);
  const ooh = await loadRgba(oohPath);
  const ko = await loadRgba(koPath);

  // --- Landmark alignment (clean) ---
  const rightEye = detectEyeNear(clean.data, LM.rightEye);
  const leftEye = detectEyeNear(clean.data, LM.leftEye);
  const mouth = detectMouth(clean.data);
  if (!rightEye || !leftEye) {
    fail(id, 'could not detect eyes near LM on clean.png — align face so sclera/iris sit on bake landmarks');
  } else {
    const dR = dist(rightEye, LM.rightEye);
    const dL = dist(leftEye, LM.leftEye);
    if (dR > LM_EYE_TOL) {
      fail(
        id,
        `clean right eye at (${rightEye.x.toFixed(3)},${rightEye.y.toFixed(3)}) ` +
          `is ${dR.toFixed(3)} from LM (${LM.rightEye.x},${LM.rightEye.y}) — align before baking damage`
      );
    }
    if (dL > LM_EYE_TOL) {
      fail(
        id,
        `clean left eye at (${leftEye.x.toFixed(3)},${leftEye.y.toFixed(3)}) ` +
          `is ${dL.toFixed(3)} from LM (${LM.leftEye.x},${LM.leftEye.y}) — align before baking damage`
      );
    }
    // Iris pixels near LM should be classified (guards non-green eyes).
    let irisHits = 0;
    for (const eye of [LM.rightEye, LM.leftEye]) {
      for (let y = Math.floor((eye.y - 0.03) * H); y < Math.ceil((eye.y + 0.03) * H); y++) {
        for (let x = Math.floor((eye.x - 0.03) * W); x < Math.ceil((eye.x + 0.03) * W); x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = (y * W + x) * 4;
          if (clean.data[i + 3] < 200) continue;
          if (isIris(clean.data[i], clean.data[i + 1], clean.data[i + 2])) irisHits++;
        }
      }
    }
    if (irisHits < 40) {
      fail(
        id,
        `only ${irisHits} isIris() hits near LM eyes on clean.png — extend isIris for this eye color`
      );
    }
  }
  if (mouth) {
    const dM = dist(mouth, LM.mouth);
    if (dM > LM_MOUTH_TOL) {
      warn(
        id,
        `clean mouth at (${mouth.x.toFixed(3)},${mouth.y.toFixed(3)}) is ${dM.toFixed(3)} from LM mouth`
      );
    }
  }

  // --- KO / ooh size vs clean ---
  const cleanSpan = spanAtY(clean.data, 0.55);
  const koSpan = spanAtY(ko.data, 0.55);
  const oohSpan = spanAtY(ooh.data, 0.55);
  if (cleanSpan && koSpan) {
    const ratio = koSpan.w / cleanSpan.w;
    if (ratio < KO_WIDTH_MIN || ratio > KO_WIDTH_MAX) {
      fail(
        id,
        `knockout mid-face width ratio ${ratio.toFixed(3)} vs clean (need ${KO_WIDTH_MIN}–${KO_WIDTH_MAX}) — ` +
          `reuse the clean affine transform for KO instead of a separate eye-based warp`
      );
    }
  } else {
    warn(id, 'could not compare KO/clean mid-face width');
  }
  if (cleanSpan && oohSpan) {
    const ratio = oohSpan.w / cleanSpan.w;
    if (ratio < KO_WIDTH_MIN || ratio > KO_WIDTH_MAX) {
      fail(
        id,
        `ooh mid-face width ratio ${ratio.toFixed(3)} vs clean (need ${KO_WIDTH_MIN}–${KO_WIDTH_MAX})`
      );
    }
  }

  const cleanBox = opaqueBBox(clean.data);
  const koBox = opaqueBBox(ko.data, { skipYellow: true });
  if (cleanBox && koBox) {
    const wr = koBox.w / cleanBox.w;
    if (wr < 0.85) {
      fail(id, `knockout opaque bbox width ratio ${wr.toFixed(3)} vs clean — head will shrink on KO`);
    }
  }

  // --- Clown black pupils (match Default style) ---
  const clownCleanPath = path.join(root, 'bobo-clown-stages', '00-clean.png');
  const clownOohPath = path.join(root, 'bobo-clown-stages', 'ooh.png');
  if (fs.existsSync(clownCleanPath)) {
    const clown = await loadRgba(clownCleanPath);
    for (const [label, eye] of [
      ['right', LM.rightEye],
      ['left', LM.leftEye],
    ]) {
      const frac = clownPupilBlackFraction(clown.data, eye);
      if (frac < CLOWN_BLACK_MIN) {
        fail(
          id,
          `clown 00-clean ${label} eye black/glint fraction ${frac.toFixed(2)} < ${CLOWN_BLACK_MIN} — ` +
            `open-eye pupil bake must detect this iris color (see bake-bobo-clown-faces.mjs)`
        );
      }
    }
  }
  if (fs.existsSync(clownOohPath)) {
    const clownOoh = await loadRgba(clownOohPath);
    for (const [label, eye] of [
      ['right', LM.rightEye],
      ['left', LM.leftEye],
    ]) {
      const frac = clownPupilBlackFraction(clownOoh.data, eye);
      if (frac < CLOWN_BLACK_MIN) {
        fail(id, `clown ooh ${label} eye black/glint fraction ${frac.toFixed(2)} < ${CLOWN_BLACK_MIN}`);
      }
    }
  }

  // --- Damage black-eye stage should darken the right orbital area ---
  const dmg02 = path.join(root, 'damage-stages', '02-blackRightEye.png');
  const dmg00 = path.join(root, 'damage-stages', '00-clean.png');
  if (fs.existsSync(dmg02) && fs.existsSync(dmg00)) {
    const before = await loadRgba(dmg00);
    const after = await loadRgba(dmg02);
    const eye = LM.rightEye;
    const lum0 = meanLumInEllipse(before.data, eye.x, eye.y, 0.09, 0.08);
    const lum1 = meanLumInEllipse(after.data, eye.x, eye.y, 0.09, 0.08);
    if (lum0 != null && lum1 != null && lum1 > lum0 - 8) {
      fail(
        id,
        `damage 02-blackRightEye did not darken orbital area (lum ${lum0.toFixed(1)} → ${lum1.toFixed(1)}) — ` +
          `check LM alignment / isIris before rebake`
      );
    }
  }

  // damage 10 should match live knockout size
  const dmg10 = path.join(root, 'damage-stages', '10-knockout.png');
  if (fs.existsSync(dmg10) && koSpan) {
    const d10 = await loadRgba(dmg10);
    const d10Span = spanAtY(d10.data, 0.55);
    if (d10Span) {
      const ratio = d10Span.w / koSpan.w;
      if (ratio < 0.95 || ratio > 1.05) {
        fail(id, `damage-stages/10-knockout width ratio ${ratio.toFixed(3)} vs knockout.png`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
console.log('Checking character face packs in', CHAR_ROOT);
checkIsIrisHeuristics();

const ids = listCharacterIds();
if (ids.length === 0) {
  fail('characters', `no character folders under ${CHAR_ROOT}`);
} else {
  console.log('Characters:', ids.join(', '));
}

for (const id of ids) {
  await checkCharacter(id);
}

if (warnings.length) {
  console.log('\nWarnings:');
  for (const w of warnings) console.log('  ⚠', w);
}

if (failures.length) {
  console.error('\nCharacter face checks FAILED:');
  for (const f of failures) console.error('  ✗', f);
  console.error(`\n${failures.length} failure(s). Fix assets / bake, then re-run:`);
  console.error('  npm run check:characters');
  process.exit(1);
}

console.log('\nAll character face checks passed.');
process.exit(0);
