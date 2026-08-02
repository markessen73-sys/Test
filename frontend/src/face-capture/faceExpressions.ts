/**
 * Synthesize punched (ooh) and knockout (sad) faces from a single clean cutout
 * using MediaPipe Face Landmarker — local mouth-band warps (no global IDW swirl).
 */
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FACE_OUT_SIZE } from './faceDetect';
import type { CustomFaceSet } from './customFace';

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

/** Stretch lips apart vertically and paint an open-mouth oval. */
function makeOoh(img: HTMLImageElement, landmarks: NormalizedLandmark[]): string {
  const w = img.naturalWidth || img.width || FACE_OUT_SIZE;
  const h = img.naturalHeight || img.height || FACE_OUT_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No canvas');
  ctx.drawImage(img, 0, 0, w, h);

  const m = mouthMetrics(landmarks, w, h);
  const open = m.width * 0.4;
  const padX = m.width * 0.6;
  const padY = m.width * 0.85;
  const x0 = Math.max(0, Math.floor(m.cx - padX));
  const x1 = Math.min(w, Math.ceil(m.cx + padX));
  const y0 = Math.max(0, Math.floor(m.cy - padY));
  const y1 = Math.min(h, Math.ceil(m.cy + padY));

  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  dst.data.set(src.data);

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const nx = (x - m.cx) / padX;
      const ny = (y - m.cy) / padY;
      const gate = Math.max(0, 1 - (nx * nx + ny * ny));
      if (gate <= 0.01) continue;

      // Pull upper half up and lower half down, strongest near mouth center line
      const side = (y - m.cy) / (padY || 1);
      const pull = open * gate * gate;
      const srcY = y - Math.sign(side || 1) * pull * Math.min(1, Math.abs(side) * 1.8 + 0.15);
      const srcX = x + nx * open * 0.08 * gate; // slight inward pinch

      const sx = Math.min(w - 1.001, Math.max(0, srcX));
      const sy = Math.min(h - 1.001, Math.max(0, srcY));
      const xA = Math.floor(sx);
      const yA = Math.floor(sy);
      const fx = sx - xA;
      const fy = sy - yA;
      const i00 = (yA * w + xA) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + w * 4;
      const i11 = i01 + 4;
      const di = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        dst.data[di + c] =
          (src.data[i00 + c]! * (1 - fx) + src.data[i10 + c]! * fx) * (1 - fy) +
          (src.data[i01 + c]! * (1 - fx) + src.data[i11 + c]! * fx) * fy;
      }
    }
  }
  ctx.putImageData(dst, 0, 0);

  // Dark open-mouth cavity
  const rx = m.width * 0.28;
  const ry = open * 0.55;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(m.cx, m.cy + open * 0.08, rx, ry, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(m.cx, m.cy - ry * 0.2, 0, m.cx, m.cy, ry);
  g.addColorStop(0, 'rgba(35, 14, 18, 0.94)');
  g.addColorStop(0.65, 'rgba(60, 25, 30, 0.88)');
  g.addColorStop(1, 'rgba(90, 45, 50, 0.35)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

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
 */
export async function synthesizeFaceExpressions(cleanDataUrl: string): Promise<CustomFaceSet> {
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
      ooh: makeOoh(img, face),
      knockout: makeSad(img, face),
    };
  } catch {
    return { clean: cleanDataUrl, ooh: cleanDataUrl, knockout: cleanDataUrl };
  }
}
