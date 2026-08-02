/**
 * Synthesize punched (ooh) and knockout (sad) faces from a single clean cutout
 * using MediaPipe Face Landmarker — local mouth-band warps (no global IDW swirl).
 */
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FACE_OUT_SIZE } from './faceDetect';
import type { CustomFaceFeatures, CustomFaceSet, FaceFeatureMark } from './customFace';

const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm';
const LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

type Pt = { x: number; y: number };

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
      try {
        return await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: LANDMARKER_MODEL, delegate: 'GPU' },
          runningMode: 'IMAGE',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
      } catch {
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: LANDMARKER_MODEL, delegate: 'CPU' },
          runningMode: 'IMAGE',
          numFaces: 1,
        });
      }
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load face for expression edit'));
    img.src = src;
  });
}

/** Landmarker struggles with transparent pixels — detect on an opaque composite. */
function opaqueComposite(img: HTMLImageElement, fill = '#808080'): HTMLCanvasElement {
  const w = img.naturalWidth || img.width || FACE_OUT_SIZE;
  const h = img.naturalHeight || img.height || FACE_OUT_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

function toPx(lm: NormalizedLandmark, w: number, h: number): Pt {
  return { x: lm.x * w, y: lm.y * h };
}

function mouthMetrics(landmarks: NormalizedLandmark[], w: number, h: number) {
  const left = toPx(landmarks[61]!, w, h);
  const right = toPx(landmarks[291]!, w, h);
  const upper = toPx(landmarks[13] ?? landmarks[0]!, w, h);
  const lower = toPx(landmarks[14] ?? landmarks[17]!, w, h);
  const width = Math.hypot(right.x - left.x, right.y - left.y) || w * 0.2;
  const cx = (left.x + right.x) / 2;
  const cy = (upper.y + lower.y) / 2;
  return { left, right, upper, lower, width, cx, cy };
}

function sampleRgb(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
): { r: number; g: number; b: number; a: number } | null {
  const xi = Math.min(w - 1, Math.max(0, Math.round(x)));
  const yi = Math.min(h - 1, Math.max(0, Math.round(y)));
  const i = (yi * w + xi) * 4;
  const a = data[i + 3] ?? 0;
  if (a < 40) return null;
  return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, a };
}

function averageSamples(
  samples: Array<{ r: number; g: number; b: number }>,
): { r: number; g: number; b: number } {
  if (!samples.length) return { r: 180, g: 140, b: 120 };
  let r = 0;
  let g = 0;
  let b = 0;
  for (const s of samples) {
    r += s.r;
    g += s.g;
    b += s.b;
  }
  const n = samples.length;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function eyeMarkFromLandmarks(
  landmarks: NormalizedLandmark[],
  w: number,
  h: number,
  side: 'left' | 'right',
): FaceFeatureMark {
  // MediaPipe: image-left eye uses 33/133, image-right 362/263
  const ids = side === 'left' ? [33, 133, 159, 145] : [362, 263, 386, 374];
  const pts = ids.map((i) => toPx(landmarks[i]!, w, h));
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length / w;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length / h;
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  return {
    cx,
    cy,
    rx: Math.max(0.04, ((maxX - minX) / w) * 0.55),
    ry: Math.max(0.03, ((maxY - minY) / h) * 0.65),
  };
}

/** Classic comedy: eyes bulge, centred exactly on highlighter marks. */
function drawComedyPopEyes(
  ctx: CanvasRenderingContext2D,
  imgData: ImageData,
  left: FaceFeatureMark,
  right: FaceFeatureMark,
  w: number,
  h: number,
) {
  const skinSamples: Array<{ r: number; g: number; b: number }> = [];
  for (const eye of [left, right]) {
    const offsets = [
      { x: 0, y: -eye.ry * h * 1.6 },
      { x: -eye.rx * w * 1.3, y: 0 },
      { x: eye.rx * w * 1.3, y: 0 },
      { x: 0, y: eye.ry * h * 1.5 },
    ];
    for (const o of offsets) {
      const s = sampleRgb(imgData.data, w, h, eye.cx * w + o.x, eye.cy * h + o.y);
      if (s) skinSamples.push(s);
    }
  }
  const skin = averageSamples(skinSamples);

  const paintOne = (eye: FaceFeatureMark) => {
    // Exact centre of the highlighted eye area
    const cx = eye.cx * w;
    const cy = eye.cy * h;
    // Eyeball sized to the highlight ellipse
    const popRx = Math.max(14, eye.rx * w * 1.05);
    const popRy = Math.max(12, eye.ry * h * 1.05);

    // Soft skin cover under / around the bulge (same centre)
    ctx.fillStyle = `rgb(${skin.r}, ${skin.g}, ${skin.b})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, popRx * 1.12, popRy * 1.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // White bulging eyeball — centre locked to highlight centre
    ctx.fillStyle = '#fffef8';
    ctx.beginPath();
    ctx.ellipse(cx, cy, popRx, popRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 40, 50, 0.55)';
    ctx.lineWidth = Math.max(1.5, popRx * 0.08);
    ctx.stroke();

    const irisR = Math.min(popRx, popRy) * 0.45;
    const iris = ctx.createRadialGradient(
      cx - irisR * 0.2,
      cy - irisR * 0.2,
      0,
      cx,
      cy,
      irisR,
    );
    iris.addColorStop(0, '#5a9fd4');
    iris.addColorStop(0.65, '#2a5f8f');
    iris.addColorStop(1, '#1a3348');
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0a0c';
    ctx.beginPath();
    ctx.arc(cx, cy, irisR * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(cx - irisR * 0.28, cy - irisR * 0.3, irisR * 0.22, 0, Math.PI * 2);
    ctx.fill();
  };

  paintOne(left);
  paintOne(right);
}

/**
 * Open-mouth "ooh": cover the full original smile (including corners) with skin,
 * then paint a clean oval cavity so leftover smile sides don't remain.
 * Comedy pop-out eyes use highlighted eye marks when available.
 */
function makeOoh(
  img: HTMLImageElement,
  landmarks: NormalizedLandmark[],
  features?: CustomFaceFeatures,
): string {
  const w = img.naturalWidth || img.width || FACE_OUT_SIZE;
  const h = img.naturalHeight || img.height || FACE_OUT_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No canvas');
  ctx.drawImage(img, 0, 0, w, h);

  const m = mouthMetrics(landmarks, w, h);
  // Outer lip / smile extent — include corners so residual sides get covered
  const outerIdx = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
  let minX = m.left.x;
  let maxX = m.right.x;
  let minY = m.upper.y;
  let maxY = m.lower.y;
  for (const i of outerIdx) {
    const lm = landmarks[i];
    if (!lm) continue;
    const p = toPx(lm, w, h);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const smileW = Math.max(m.width, maxX - minX);
  const smileH = Math.max(m.lower.y - m.upper.y, maxY - minY, smileW * 0.18);

  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  dst.data.set(src.data);

  // Skin from philtrum / cheeks just outside the smile (not lip pixels)
  const skinSamples: Array<{ r: number; g: number; b: number }> = [];
  const lipSamples: Array<{ r: number; g: number; b: number }> = [];
  const skinOffsets: Pt[] = [
    { x: m.cx, y: m.cy - smileH * 1.35 },
    { x: m.cx - smileW * 0.22, y: m.cy - smileH * 1.15 },
    { x: m.cx + smileW * 0.22, y: m.cy - smileH * 1.15 },
    { x: m.cx - smileW * 0.55, y: m.cy - smileH * 0.15 },
    { x: m.cx + smileW * 0.55, y: m.cy - smileH * 0.15 },
    { x: m.cx, y: m.cy + smileH * 1.45 },
    { x: m.cx - smileW * 0.2, y: m.cy + smileH * 1.25 },
    { x: m.cx + smileW * 0.2, y: m.cy + smileH * 1.25 },
  ];
  for (const p of skinOffsets) {
    const s = sampleRgb(src.data, w, h, p.x, p.y);
    if (s) skinSamples.push(s);
  }
  for (const i of [13, 14, 78, 308, 82, 312]) {
    const lm = landmarks[i];
    if (!lm) continue;
    const p = toPx(lm, w, h);
    const s = sampleRgb(src.data, w, h, p.x, p.y);
    if (s) lipSamples.push(s);
  }
  const skin = averageSamples(skinSamples);
  const lip = averageSamples(lipSamples.length ? lipSamples : skinSamples);

  // Soft-cover the entire smile (wide enough for corners) with skin
  const coverRx = smileW * 0.62;
  const coverRy = Math.max(smileH * 0.95, smileW * 0.22);
  const x0 = Math.max(0, Math.floor(m.cx - coverRx));
  const x1 = Math.min(w, Math.ceil(m.cx + coverRx));
  const y0 = Math.max(0, Math.floor(m.cy - coverRy));
  const y1 = Math.min(h, Math.ceil(m.cy + coverRy));

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const nx = (x - m.cx) / coverRx;
      const ny = (y - m.cy) / coverRy;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      // Soft edge so cover blends into cheeks
      const gate = Math.min(1, Math.max(0, (1 - r2) / 0.28));
      const di = (y * w + x) * 4;
      const a = dst.data[di + 3] ?? 0;
      if (a < 20) continue;
      dst.data[di] = Math.round(dst.data[di]! * (1 - gate) + skin.r * gate);
      dst.data[di + 1] = Math.round(dst.data[di + 1]! * (1 - gate) + skin.g * gate);
      dst.data[di + 2] = Math.round(dst.data[di + 2]! * (1 - gate) + skin.b * gate);
    }
  }
  ctx.putImageData(dst, 0, 0);

  // Clean ooh cavity — narrower than the old smile so corners stay covered by skin
  const open = smileW * 0.38;
  const rx = smileW * 0.22;
  const ry = open * 0.52;
  const oy = m.cy + open * 0.04;

  ctx.save();
  // Lip rim
  ctx.beginPath();
  ctx.ellipse(m.cx, oy, rx * 1.18, ry * 1.22, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${lip.r}, ${lip.g}, ${lip.b})`;
  ctx.fill();
  // Dark interior
  ctx.beginPath();
  ctx.ellipse(m.cx, oy, rx, ry, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(m.cx, oy - ry * 0.25, 0, m.cx, oy, ry);
  g.addColorStop(0, 'rgba(28, 10, 14, 0.97)');
  g.addColorStop(0.55, 'rgba(55, 22, 28, 0.92)');
  g.addColorStop(0.85, `rgba(${Math.max(40, lip.r - 40)}, ${Math.max(20, lip.g - 50)}, ${Math.max(25, lip.b - 40)}, 0.75)`);
  g.addColorStop(1, `rgba(${lip.r}, ${lip.g}, ${lip.b}, 0.15)`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  // Comedy pop-out eyes — prefer user highlighter marks
  const leftEye = features?.leftEye ?? eyeMarkFromLandmarks(landmarks, w, h, 'left');
  const rightEye = features?.rightEye ?? eyeMarkFromLandmarks(landmarks, w, h, 'right');
  const afterMouth = ctx.getImageData(0, 0, w, h);
  drawComedyPopEyes(ctx, afterMouth, leftEye, rightEye, w, h);

  return canvas.toDataURL('image/png');
}

/** Drop mouth corners and slightly droop brows / lower lids. */
function makeSad(img: HTMLImageElement, landmarks: NormalizedLandmark[]): string {
  const w = img.naturalWidth || img.width || FACE_OUT_SIZE;
  const h = img.naturalHeight || img.height || FACE_OUT_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No canvas');
  ctx.drawImage(img, 0, 0, w, h);

  const m = mouthMetrics(landmarks, w, h);
  const drop = m.width * 0.55;
  // Keep warp local to the mouth — large pads were twisting glasses
  const padX = m.width * 0.72;
  const padY = m.width * 0.55;
  const x0 = Math.max(0, Math.floor(m.cx - padX));
  const x1 = Math.min(w, Math.ceil(m.cx + padX));
  const y0 = Math.max(0, Math.floor(m.cy - padY));
  const y1 = Math.min(h, Math.ceil(m.cy + padY * 1.35));

  // Brow region — pull inner brows down harder for a sadder look
  const browY = toPx(landmarks[55] ?? landmarks[105] ?? landmarks[10]!, w, h).y;
  const browPad = m.width * 0.55;
  const bx0 = Math.max(0, Math.floor(m.cx - m.width * 0.95));
  const bx1 = Math.min(w, Math.ceil(m.cx + m.width * 0.95));
  const by0 = Math.max(0, Math.floor(browY - browPad));
  const by1 = Math.min(h, Math.ceil(browY + browPad * 0.75));

  // Lower lids — slight droop
  const eyeY = toPx(landmarks[145] ?? landmarks[159]!, w, h).y;
  const eyePad = m.width * 0.35;
  const ex0 = Math.max(0, Math.floor(m.cx - m.width * 0.75));
  const ex1 = Math.min(w, Math.ceil(m.cx + m.width * 0.75));
  const ey0 = Math.max(0, Math.floor(eyeY - eyePad * 0.4));
  const ey1 = Math.min(h, Math.ceil(eyeY + eyePad));

  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  dst.data.set(src.data);

  const sample = (sx: number, sy: number, di: number) => {
    const x = Math.min(w - 1.001, Math.max(0, sx));
    const y = Math.min(h - 1.001, Math.max(0, sy));
    const xA = Math.floor(x);
    const yA = Math.floor(y);
    const fx = x - xA;
    const fy = y - yA;
    const i00 = (yA * w + xA) * 4;
    const i10 = i00 + 4;
    const i01 = i00 + w * 4;
    const i11 = i01 + 4;
    const a =
      (src.data[i00 + 3]! * (1 - fx) + src.data[i10 + 3]! * fx) * (1 - fy) +
      (src.data[i01 + 3]! * (1 - fx) + src.data[i11 + 3]! * fx) * fy;
    // Don't pull transparent edge pixels into the face (creates black holes)
    if (a < 32) return;
    for (let c = 0; c < 4; c++) {
      dst.data[di + c] =
        (src.data[i00 + c]! * (1 - fx) + src.data[i10 + c]! * fx) * (1 - fy) +
        (src.data[i01 + c]! * (1 - fx) + src.data[i11 + c]! * fx) * fy;
    }
  };

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const nx = (x - m.cx) / padX;
      const ny = (y - m.cy) / padY;
      const gate = Math.max(0, 1 - (nx * nx * 0.65 + ny * ny));
      if (gate <= 0.01) continue;
      // Corners drop hard; center also drops to flatten a smile into a frown
      const corner = Math.min(1, Math.abs(nx) * 1.55);
      const dy = drop * (0.35 + 0.65 * corner * corner) * gate;
      // Slight inward pinch at corners for a tighter frown
      const dx = -Math.sign(nx || 1) * m.width * 0.04 * corner * gate;
      sample(x - dx, y - dy, (y * w + x) * 4);
    }
  }

  for (let y = by0; y < by1; y++) {
    for (let x = bx0; x < bx1; x++) {
      const nx = (x - m.cx) / (m.width * 0.95);
      const ny = (y - browY) / browPad;
      const gate = Math.max(0, 1 - (nx * nx + ny * ny * 1.3));
      if (gate <= 0.01) continue;
      const inward = Math.max(0, 1 - Math.abs(nx) * 1.05);
      sample(x, y - m.width * 0.16 * inward * gate, (y * w + x) * 4);
    }
  }

  for (let y = ey0; y < ey1; y++) {
    for (let x = ex0; x < ex1; x++) {
      const nx = (x - m.cx) / (m.width * 0.75);
      const ny = (y - eyeY) / eyePad;
      const gate = Math.max(0, 1 - (nx * nx * 0.8 + ny * ny * 1.6));
      if (gate <= 0.01) continue;
      sample(x, y - m.width * 0.045 * gate, (y * w + x) * 4);
    }
  }

  ctx.putImageData(dst, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * From one cutout PNG, produce smile (as-is) + synthesized ooh + sad.
 * Falls back to cloning the clean face if landmarks cannot be found.
 * Pass feature marks (from highlighter pass) for comedy pop-out eye placement.
 */
export async function synthesizeFaceExpressions(
  cleanDataUrl: string,
  features?: CustomFaceFeatures,
): Promise<CustomFaceSet> {
  const img = await loadImage(cleanDataUrl);
  try {
    const landmarker = await getLandmarker();
    // Detect on opaque composite — alpha holes look like voids to the model
    const forDetect = opaqueComposite(img, '#6a6a6a');
    const result = landmarker.detect(forDetect);
    const face = result.faceLandmarks?.[0];
    if (!face?.length) {
      return { clean: cleanDataUrl, ooh: cleanDataUrl, knockout: cleanDataUrl };
    }
    return {
      clean: cleanDataUrl,
      ooh: makeOoh(img, face, features),
      knockout: makeSad(img, face),
    };
  } catch {
    return { clean: cleanDataUrl, ooh: cleanDataUrl, knockout: cleanDataUrl };
  }
}
