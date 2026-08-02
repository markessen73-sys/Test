/**
 * Synthesize punched (ooh) and knockout (sad) faces from a single clean cutout
 * using MediaPipe Face Landmarker mouth / brow warps.
 */
import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FACE_OUT_SIZE } from './faceDetect';
import type { CustomFaceSet } from './customFace';

const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm';
const LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/** MediaPipe Face Mesh lip / expression landmark indices */
const UPPER_LIP = [0, 37, 39, 40, 267, 269, 270, 11, 72, 73, 74, 302, 303, 304];
const LOWER_LIP = [17, 84, 181, 91, 146, 314, 405, 321, 375, 15, 86, 179, 89, 96, 316, 403, 319, 325];
const MOUTH_CORNERS = [61, 291];
const INNER_MOUTH = [13, 14, 78, 308, 82, 312, 87, 317];
const LEFT_BROW_INNER = [55, 65, 52, 53];
const RIGHT_BROW_INNER = [285, 295, 282, 283];
const LEFT_EYE_LOWER = [145, 153, 154, 155, 133];
const RIGHT_EYE_LOWER = [374, 380, 381, 382, 362];

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

function toPx(lm: NormalizedLandmark, w: number, h: number): Pt {
  return { x: lm.x * w, y: lm.y * h };
}

function mouthScale(landmarks: NormalizedLandmark[], w: number, h: number) {
  const left = toPx(landmarks[61]!, w, h);
  const right = toPx(landmarks[291]!, w, h);
  return Math.hypot(right.x - left.x, right.y - left.y) || w * 0.2;
}

function buildControls(
  landmarks: NormalizedLandmark[],
  w: number,
  h: number,
  kind: 'ooh' | 'sad'
): { from: Pt[]; to: Pt[] } {
  const from: Pt[] = [];
  const to: Pt[] = [];
  const s = mouthScale(landmarks, w, h);

  const push = (idx: number, dx: number, dy: number) => {
    const lm = landmarks[idx];
    if (!lm) return;
    const p = toPx(lm, w, h);
    from.push(p);
    to.push({ x: p.x + dx, y: p.y + dy });
  };

  if (kind === 'ooh') {
    const open = s * 0.28;
    const pinch = s * 0.06;
    for (const i of UPPER_LIP) push(i, 0, -open * 0.85);
    for (const i of LOWER_LIP) push(i, 0, open);
    push(MOUTH_CORNERS[0]!, pinch, open * 0.15);
    push(MOUTH_CORNERS[1]!, -pinch, open * 0.15);
    for (const i of INNER_MOUTH) {
      const lm = landmarks[i]!;
      const midY = ((landmarks[13]?.y ?? lm.y) + (landmarks[14]?.y ?? lm.y)) / 2;
      const dy = lm.y < midY ? -open * 0.7 : open * 0.85;
      push(i, 0, dy);
    }
  } else {
    const drop = s * 0.22;
    const spread = s * 0.04;
    push(MOUTH_CORNERS[0]!, -spread, drop);
    push(MOUTH_CORNERS[1]!, spread, drop);
    for (const i of UPPER_LIP) push(i, 0, drop * 0.25);
    for (const i of LOWER_LIP) push(i, 0, drop * 0.55);
    for (const i of LEFT_BROW_INNER) push(i, -s * 0.02, s * 0.08);
    for (const i of RIGHT_BROW_INNER) push(i, s * 0.02, s * 0.08);
    for (const i of LEFT_EYE_LOWER) push(i, 0, s * 0.03);
    for (const i of RIGHT_EYE_LOWER) push(i, 0, s * 0.03);
  }

  // Anchor points outside the mouth so cheeks stay put
  const anchors = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
  for (const i of anchors) {
    const lm = landmarks[i];
    if (!lm) continue;
    const p = toPx(lm, w, h);
    from.push(p);
    to.push({ ...p });
  }

  return { from, to };
}

/** Inverse IDW warp: for each output pixel, sample source. */
function warpRegion(
  src: ImageData,
  dst: ImageData,
  from: Pt[],
  to: Pt[],
  roi: { x: number; y: number; w: number; h: number }
) {
  const { width, height } = src;
  const sdata = src.data;
  const ddata = dst.data;
  const n = from.length;
  if (n === 0) return;

  const x0 = Math.max(0, Math.floor(roi.x));
  const y0 = Math.max(0, Math.floor(roi.y));
  const x1 = Math.min(width, Math.ceil(roi.x + roi.w));
  const y1 = Math.min(height, Math.ceil(roi.y + roi.h));

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      let wSum = 0;
      let sx = 0;
      let sy = 0;
      let exact = false;
      for (let i = 0; i < n; i++) {
        const tx = to[i]!.x;
        const ty = to[i]!.y;
        const dx = x - tx;
        const dy = y - ty;
        const d2 = dx * dx + dy * dy;
        if (d2 < 0.25) {
          sx = from[i]!.x;
          sy = from[i]!.y;
          exact = true;
          break;
        }
        const w = 1 / d2;
        wSum += w;
        sx += from[i]!.x * w;
        sy += from[i]!.y * w;
      }
      if (!exact) {
        sx /= wSum;
        sy /= wSum;
      }

      const xA = Math.floor(sx);
      const yA = Math.floor(sy);
      if (xA < 0 || yA < 0 || xA >= width - 1 || yA >= height - 1) continue;
      const fx = sx - xA;
      const fy = sy - yA;
      const i00 = (yA * width + xA) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + width * 4;
      const i11 = i01 + 4;
      const di = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        const v =
          (sdata[i00 + c]! * (1 - fx) + sdata[i10 + c]! * fx) * (1 - fy) +
          (sdata[i01 + c]! * (1 - fx) + sdata[i11 + c]! * fx) * fy;
        ddata[di + c] = v;
      }
    }
  }
}

function mouthRoi(landmarks: NormalizedLandmark[], w: number, h: number, pad: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const idxs = [...UPPER_LIP, ...LOWER_LIP, ...MOUTH_CORNERS, ...INNER_MOUTH, ...LEFT_BROW_INNER, ...RIGHT_BROW_INNER];
  for (const i of idxs) {
    const lm = landmarks[i];
    if (!lm) continue;
    const p = toPx(lm, w, h);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

function fillOohMouth(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  w: number,
  h: number
) {
  const ul = toPx(landmarks[13] ?? landmarks[0]!, w, h);
  const ll = toPx(landmarks[14] ?? landmarks[17]!, w, h);
  const left = toPx(landmarks[78] ?? landmarks[61]!, w, h);
  const right = toPx(landmarks[308] ?? landmarks[291]!, w, h);
  const cx = (left.x + right.x) / 2;
  const cy = (ul.y + ll.y) / 2 + mouthScale(landmarks, w, h) * 0.12;
  const rx = Math.max(4, Math.abs(right.x - left.x) * 0.38);
  const ry = Math.max(4, mouthScale(landmarks, w, h) * 0.22);

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(cx, cy - ry * 0.2, 0, cx, cy, ry);
  g.addColorStop(0, 'rgba(40, 18, 22, 0.92)');
  g.addColorStop(0.7, 'rgba(55, 22, 28, 0.88)');
  g.addColorStop(1, 'rgba(80, 40, 45, 0.55)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function applyExpression(
  img: HTMLImageElement,
  landmarks: NormalizedLandmark[],
  kind: 'ooh' | 'sad'
): string {
  const w = img.naturalWidth || img.width || FACE_OUT_SIZE;
  const h = img.naturalHeight || img.height || FACE_OUT_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No canvas');
  ctx.drawImage(img, 0, 0, w, h);

  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  dst.data.set(src.data);

  const { from, to } = buildControls(landmarks, w, h, kind);
  const s = mouthScale(landmarks, w, h);
  const roi = mouthRoi(landmarks, w, h, s * (kind === 'ooh' ? 0.85 : 0.7));
  // Expand ROI for brows on sad
  if (kind === 'sad') {
    roi.y -= s * 0.5;
    roi.h += s * 0.6;
  }

  warpRegion(src, dst, from, to, roi);
  ctx.putImageData(dst, 0, 0);

  if (kind === 'ooh') {
    fillOohMouth(ctx, landmarks, w, h);
  }

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
    const result = landmarker.detect(img);
    const face = result.faceLandmarks?.[0];
    if (!face?.length) {
      return { clean: cleanDataUrl, ooh: cleanDataUrl, knockout: cleanDataUrl };
    }
    const ooh = applyExpression(img, face, 'ooh');
    const knockout = applyExpression(img, face, 'sad');
    return { clean: cleanDataUrl, ooh, knockout };
  } catch {
    return { clean: cleanDataUrl, ooh: cleanDataUrl, knockout: cleanDataUrl };
  }
}
