/**
 * Guardrails for per-character face packs under public/faces/characters/<id>/.
 *
 * Catches the regressions we hit adding Byson / Tin Mick:
 *  - clean eyes/mouth not on damage-bake landmarks (black eye / stamps miss)
 *  - clean head smaller/larger than Default (inconsistent ring / HUD size)
 *  - knockout head shrunk vs clean (independent affine over-scale)
 *  - clown bake left colored irises instead of Default-style black pupils
 *  - clown whiteface instead of natural skin / missing red-blue accents / no curly wig
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
const LM_EYE_TOL = 0.04;
const LM_MOUTH_TOL = 0.055;
/** KO mid-face width vs clean — outside this range looks like a shrink/grow pop. */
const KO_WIDTH_MIN = 0.92;
const KO_WIDTH_MAX = 1.12;
/** Every character clean head must match Default mid-face width (ear span @ y=0.55). */
const REF_CHARACTER_ID = 'default';
const REF_HEAD_WIDTH_MIN = 0.93;
const REF_HEAD_WIDTH_MAX = 1.06;
/** Packs with tall hair / long chin are intentionally smaller so they fit the head slot. */
const REF_HEAD_WIDTH_MIN_BY_ID = {
  'king-of-the-north': 0.75,
  'the-nige': 0.75,
};
/** Stock boxers that mirror standard faces into bobo-clown-stages (no clown makeup). */
const STANDARD_BOBO_IDS = new Set(['king-of-the-north', 'bozza', 'the-nige']);
/** Clown pupil disk: min fraction of near-black (or white glint) pixels. */
const CLOWN_BLACK_MIN = 0.72;
/** Max mean RGB delta (cheek) between clean and clown — guards whiteface regression. */
const CLOWN_SKIN_MAX_DELTA = 48;
/** Min saturated red pixels near clown nose. */
const CLOWN_NOSE_RED_MIN = 120;
/** Min blue / red diamond pixels above each eye. */
const CLOWN_DIAMOND_MIN = 40;
/** Min vibrant multicolour wig pixels in the crown (curly wig template). */
const CLOWN_WIG_VIVID_MIN = 2500;

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
  // Glasses / dark-pupil fallback (Bozza, King Of The North).
  if (pts.length < 25) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5) / W;
        const ny = (y + 0.5) / H;
        if (Math.hypot(nx - eye.x, ny - eye.y) > searchR) continue;
        const i = (y * W + x) * 4;
        if (data[i + 3] < 200) continue;
        const L = lum(data[i], data[i + 1], data[i + 2]);
        const chroma = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
        if (L > 18 && L < 110 && chroma < 70) pts.push([x, y, 1]);
      }
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

function meanRgbInEllipse(data, cx, cy, rx, ry, predicate) {
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      if (ellipseDist(nx, ny, cx, cy, rx, ry) >= 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < 40) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (predicate && !predicate(r, g, b)) continue;
      sr += r;
      sg += g;
      sb += b;
      n++;
    }
  }
  return n ? { r: sr / n, g: sg / n, b: sb / n, n } : null;
}

function countPixelsInEllipse(data, cx, cy, rx, ry, predicate) {
  let n = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W;
      const ny = (y + 0.5) / H;
      if (ellipseDist(nx, ny, cx, cy, rx, ry) >= 1) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < 40) continue;
      if (predicate(data[i], data[i + 1], data[i + 2])) n++;
    }
  }
  return n;
}

function isVividClownWig(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Saturated primaries / secondaries — not skin, not black outline.
  return max > 140 && max - min > 55 && lum(r, g, b) > 40 && lum(r, g, b) < 230;
}

/** True when a sample mean looks like curly-wig candy paint (not peach/brown skin). */
function looksLikeWigPaint(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 90) return false;
  return (
    (r > 200 && g < 120 && b < 120) ||
    (g > 200 && r < 130 && b < 130) ||
    (b > 200 && r < 130 && g < 160) ||
    (r > 200 && g > 180 && b < 90) ||
    (r > 180 && b > 180 && g < 120)
  );
}

function isClownNoseRed(r, g, b) {
  return r > 170 && g < 90 && b < 100 && r > g + 60;
}

function isClownDiamondBlue(r, g, b) {
  return b > 140 && b > r + 30 && b > g + 20;
}

function isClownDiamondRed(r, g, b) {
  return r > 170 && g < 100 && b < 120 && r > g + 50;
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
  // Light blue (The Don-like).
  if (!isIris(90, 150, 210)) fail(id, 'blue iris sample not detected');
  // Bright ginger beard must NOT count as iris (would skip bruise paint).
  if (isIris(190, 110, 55)) fail(id, 'bright beard sample wrongly counted as iris');
  // Skin peach must not count as iris.
  if (isIris(246, 157, 103)) fail(id, 'skin sample wrongly counted as iris');
  // Medium-dark cheek must not count as iris.
  if (isIris(124, 66, 31)) fail(id, 'dark cheek sample wrongly counted as iris');
  // Orange tan cheek must not count as iris.
  if (isIris(220, 140, 90)) fail(id, 'tan cheek sample wrongly counted as iris');
}

async function checkCharacter(id, refCleanSpan) {
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

  // --- Head size vs Default ---
  const cleanSpan = spanAtY(clean.data, 0.55);
  if (refCleanSpan && cleanSpan && id !== REF_CHARACTER_ID) {
    const ratio = cleanSpan.w / refCleanSpan.w;
    const min = REF_HEAD_WIDTH_MIN_BY_ID[id] ?? REF_HEAD_WIDTH_MIN;
    if (ratio < min || ratio > REF_HEAD_WIDTH_MAX) {
      fail(
        id,
        `clean mid-face width ratio ${ratio.toFixed(3)} vs ${REF_CHARACTER_ID} ` +
          `(need ${min}–${REF_HEAD_WIDTH_MAX}) — scale clean/ooh/KO to Default head size before baking`
      );
    }
  }

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
      // Glasses packs may have few classified iris pixels; dark pupils near LM are enough.
      if (!STANDARD_BOBO_IDS.has(id)) {
        fail(
          id,
          `only ${irisHits} isIris() hits near LM eyes on clean.png — extend isIris for this eye color`
        );
      } else if (irisHits < 5) {
        warn(id, `only ${irisHits} isIris() hits near LM (glasses pack — dark-pupil detect used)`);
      }
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

  // --- Clown bake: natural skin, black pupils, red/blue accents, curly wig ---
  // Skip makeup checks for packs that deliberately mirror standard (non-clown) faces.
  const clownCleanPath = path.join(root, 'bobo-clown-stages', '00-clean.png');
  const clownOohPath = path.join(root, 'bobo-clown-stages', 'ooh.png');
  if (fs.existsSync(clownCleanPath) && !STANDARD_BOBO_IDS.has(id)) {
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

    // Natural skin (no whiteface): sample forehead / jaw away from blush & wig.
    const skinSites = [
      [0.5, 0.36, 0.06, 0.04],
      [0.5, 0.78, 0.06, 0.04],
    ];
    let skinChecked = false;
    for (const [cx, cy, rx, ry] of skinSites) {
      const skinClean = meanRgbInEllipse(clean.data, cx, cy, rx, ry);
      const skinClown = meanRgbInEllipse(clown.data, cx, cy, rx, ry);
      if (!skinClean || !skinClown || skinClean.n < 80 || skinClown.n < 80) continue;
      // Skip sites covered by vivid curly-wig paint (not normal skin chroma).
      if (looksLikeWigPaint(skinClown.r, skinClown.g, skinClown.b)) continue;
      const delta =
        Math.abs(skinClean.r - skinClown.r) +
        Math.abs(skinClean.g - skinClown.g) +
        Math.abs(skinClean.b - skinClown.b);
      skinChecked = true;
      if (delta > CLOWN_SKIN_MAX_DELTA) {
        fail(
          id,
          `clown skin RGB delta ${delta.toFixed(0)} vs clean at (${cx},${cy}) (max ${CLOWN_SKIN_MAX_DELTA}) — ` +
            `keep natural skin tone; do not bake whiteface greasepaint`
        );
      }
      if (skinClown.r > 235 && skinClown.g > 230 && skinClown.b > 220) {
        fail(id, 'clown face looks whiteface — bake must preserve natural skin colour');
      }
      break;
    }
    if (!skinChecked) {
      warn(id, 'could not sample forehead/jaw for clown natural-skin check');
    }

    // Red clown nose.
    const noseRed = countPixelsInEllipse(
      clown.data,
      LM.nose.x,
      LM.nose.y + 0.01,
      0.09,
      0.08,
      isClownNoseRed
    );
    if (noseRed < CLOWN_NOSE_RED_MIN) {
      fail(
        id,
        `clown red-nose pixels ${noseRed} < ${CLOWN_NOSE_RED_MIN} — keep tomato-red nose accent`
      );
    }

    // Blue diamond above right eye, red above left.
    const blueDiamond = countPixelsInEllipse(
      clown.data,
      LM.rightEye.x,
      LM.rightEye.y - 0.1,
      0.05,
      0.06,
      isClownDiamondBlue
    );
    const redDiamond = countPixelsInEllipse(
      clown.data,
      LM.leftEye.x,
      LM.leftEye.y - 0.1,
      0.05,
      0.06,
      isClownDiamondRed
    );
    if (blueDiamond < CLOWN_DIAMOND_MIN) {
      fail(id, `clown blue eye-diamond pixels ${blueDiamond} < ${CLOWN_DIAMOND_MIN}`);
    }
    if (redDiamond < CLOWN_DIAMOND_MIN) {
      fail(id, `clown red eye-diamond pixels ${redDiamond} < ${CLOWN_DIAMOND_MIN}`);
    }

    // Large multicolour curly wig in the crown (not just short candy hair tips).
    const wigVivid = countPixelsInEllipse(clown.data, 0.5, 0.18, 0.42, 0.22, isVividClownWig);
    if (wigVivid < CLOWN_WIG_VIVID_MIN) {
      fail(
        id,
        `clown curly-wig vivid pixels ${wigVivid} < ${CLOWN_WIG_VIVID_MIN} — ` +
          `bake must include the large multi-coloured curly wig template`
      );
    }
  }
  if (fs.existsSync(clownOohPath) && !STANDARD_BOBO_IDS.has(id)) {
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

let refCleanSpan = null;
const refCleanPath = path.join(CHAR_ROOT, REF_CHARACTER_ID, 'clean.png');
if (fs.existsSync(refCleanPath)) {
  const refClean = await loadRgba(refCleanPath);
  refCleanSpan = spanAtY(refClean.data, 0.55);
  if (refCleanSpan) {
    console.log(
      `Reference head (${REF_CHARACTER_ID}) mid-face width @y=0.55: ${refCleanSpan.w}px`
    );
  }
} else {
  fail('characters', `missing reference ${REF_CHARACTER_ID}/clean.png`);
}

for (const id of ids) {
  await checkCharacter(id, refCleanSpan);
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
