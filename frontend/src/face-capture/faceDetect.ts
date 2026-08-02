/**
 * Detect faces, remove background (person segmentation), and cut to transparent PNG.
 * Uses MediaPipe Face Detector + Selfie Image Segmenter + Face Landmarker (head oval).
 */
import {
  FaceDetector,
  FaceLandmarker,
  FilesetResolver,
  ImageSegmenter,
  type Detection,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

export const FACE_OUT_SIZE = 1024;

export type DetectedFace = {
  /** Bounding box in source image pixels (already expanded for forehead/chin) */
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  /** Small preview of the cutout for picker UI */
  previewUrl: string;
};

const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm';
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const SELFIE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
const LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

/** Ordered face-oval landmark indices (MediaPipe FACE_LANDMARKS_FACE_OVAL walk). */
const FACE_OVAL_IDX = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
  176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
] as const;

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

let visionPromise: Promise<WasmFileset> | null = null;
let detectorPromise: Promise<FaceDetector> | null = null;
let segmenterPromise: Promise<ImageSegmenter> | null = null;
let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function getVision(): Promise<WasmFileset> {
  if (!visionPromise) {
    visionPromise = FilesetResolver.forVisionTasks(WASM_PATH).catch((err) => {
      visionPromise = null;
      throw err;
    });
  }
  return visionPromise;
}

async function getDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const vision = await getVision();
      try {
        return await FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
          runningMode: 'IMAGE',
          minDetectionConfidence: 0.45,
        });
      } catch {
        return FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'CPU' },
          runningMode: 'IMAGE',
          minDetectionConfidence: 0.45,
        });
      }
    })().catch((err) => {
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
}

async function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const vision = await getVision();
      return ImageSegmenter.createFromOptions(vision, {
        baseOptions: { modelAssetPath: SELFIE_MODEL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: true,
      });
    })().catch((err) => {
      segmenterPromise = null;
      throw err;
    });
  }
  return segmenterPromise;
}

async function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await getVision();
      const opts = {
        runningMode: 'IMAGE' as const,
        numFaces: 4,
      };
      try {
        return await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: LANDMARKER_MODEL, delegate: 'GPU' },
          ...opts,
        });
      } catch {
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: LANDMARKER_MODEL, delegate: 'CPU' },
          ...opts,
        });
      }
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

function sourceSize(source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) {
  if (source instanceof HTMLVideoElement) {
    return { w: source.videoWidth, h: source.videoHeight };
  }
  if (source instanceof HTMLCanvasElement) {
    return { w: source.width, h: source.height };
  }
  return { w: source.naturalWidth, h: source.naturalHeight };
}

function detectionToBox(d: Detection, imgW: number, imgH: number) {
  const box = d.boundingBox;
  if (!box) return null;
  const x = Math.max(0, box.originX);
  const y = Math.max(0, box.originY);
  const width = Math.min(imgW - x, box.width);
  const height = Math.min(imgH - y, box.height);
  if (width < 8 || height < 8) return null;
  const score = d.categories?.[0]?.score ?? 0;
  return { x, y, width, height, score };
}

/** Expand face box for hair on top; keep bottom tight so neck/shoulders stay out. */
export function expandFaceBox(
  box: { x: number; y: number; width: number; height: number },
  imgW: number,
  imgH: number
) {
  const padX = box.width * 0.28;
  const padTop = box.height * 0.7;
  const padBot = box.height * 0.02;
  const x = Math.max(0, box.x - padX);
  const y = Math.max(0, box.y - padTop);
  const x2 = Math.min(imgW, box.x + box.width + padX);
  const y2 = Math.min(imgH, box.y + box.height + padBot);
  return { x, y, width: x2 - x, height: y2 - y };
}

/**
 * Person alpha mask aligned to the source image size (0..1 float per pixel).
 * Selfie segmenter: confidence high = person; category 0 = person, 255 = background.
 */
async function personAlphaMask(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<{ data: Float32Array; width: number; height: number }> {
  const segmenter = await getSegmenter();
  const result = segmenter.segment(source);
  try {
    const conf = result.confidenceMasks?.[0];
    if (conf) {
      return {
        data: new Float32Array(conf.getAsFloat32Array()),
        width: conf.width,
        height: conf.height,
      };
    }
    if (result.categoryMask) {
      const cat = result.categoryMask;
      const bytes = cat.getAsUint8Array();
      const data = new Float32Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        data[i] = (bytes[i] ?? 255) < 128 ? 1 : 0;
      }
      return { data, width: cat.width, height: cat.height };
    }
    throw new Error('Segmentation returned no mask');
  } finally {
    result.close();
  }
}

async function detectAllLandmarks(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<NormalizedLandmark[][]> {
  try {
    const landmarker = await getLandmarker();
    return landmarker.detect(source).faceLandmarks ?? [];
  } catch {
    return [];
  }
}

function pickLandmarksNear(
  faces: NormalizedLandmark[][],
  near: { x: number; y: number; width: number; height: number },
  imgW: number,
  imgH: number
): NormalizedLandmark[] | null {
  if (!faces.length) return null;
  if (faces.length === 1) return faces[0] ?? null;
  const tx = (near.x + near.width / 2) / imgW;
  const ty = (near.y + near.height / 2) / imgH;
  let best = faces[0]!;
  let bestD = Infinity;
  for (const face of faces) {
    const nose = face[1] ?? face[152];
    if (!nose) continue;
    const d = (nose.x - tx) ** 2 + (nose.y - ty) ** 2;
    if (d < bestD) {
      bestD = d;
      best = face;
    }
  }
  return best;
}

async function detectLandmarksNear(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  near?: { x: number; y: number; width: number; height: number }
): Promise<NormalizedLandmark[] | null> {
  const faces = await detectAllLandmarks(source);
  if (!faces.length) return null;
  if (!near) return faces[0] ?? null;
  const { w: imgW, h: imgH } = sourceSize(source);
  return pickLandmarksNear(faces, near, imgW, imgH);
}

function sampleMask(
  mask: Float32Array,
  mw: number,
  mh: number,
  nx: number,
  ny: number
): number {
  const x = Math.min(mw - 1, Math.max(0, nx * (mw - 1)));
  const y = Math.min(mh - 1, Math.max(0, ny * (mh - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(mw - 1, x0 + 1);
  const y1 = Math.min(mh - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const v00 = mask[y0 * mw + x0] ?? 0;
  const v10 = mask[y0 * mw + x1] ?? 0;
  const v01 = mask[y1 * mw + x0] ?? 0;
  const v11 = mask[y1 * mw + x1] ?? 0;
  return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
}

/** Min of 3×3 neighborhood — slight erode to kill background fringe on hair. */
function sampleMaskEroded(
  mask: Float32Array,
  mw: number,
  mh: number,
  nx: number,
  ny: number
): number {
  const ox = 1.25 / mw;
  const oy = 1.25 / mh;
  let m = 1;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      m = Math.min(m, sampleMask(mask, mw, mh, nx + dx * ox, ny + dy * oy));
    }
  }
  return m;
}

/** Soft person alpha so cut edges feather. Bias toward killing background fringe. */
function softPersonAlpha(confidence: number): number {
  const t = Math.min(1, Math.max(0, (confidence - 0.45) / 0.3));
  const s = t * t * (3 - 2 * t);
  return s * s;
}

/**
 * Soft head+hair mask in output pixel space: face oval expanded up for hair,
 * clipped below the chin so neck/shoulders drop out.
 */
function buildHeadHairMask(
  landmarks: NormalizedLandmark[],
  imgW: number,
  imgH: number,
  sx: number,
  sy: number,
  scale: number,
  dx: number,
  dy: number,
  outSize: number
): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No canvas');
  ctx.clearRect(0, 0, outSize, outSize);

  const toOut = (lm: NormalizedLandmark) => ({
    x: dx + (lm.x * imgW - sx) * scale,
    y: dy + (lm.y * imgH - sy) * scale,
  });

  const pts = FACE_OVAL_IDX.map((i) => toOut(landmarks[i]!));
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;

  // Expand sideways a bit; expand upward more for hair; shrink below center (no neck).
  const expanded = pts.map((p) => {
    const ox = p.x - cx;
    const oy = p.y - cy;
    const up = oy < 0;
    const sxScale = 1.16;
    const syScale = up ? 1.55 : 0.88;
    return { x: cx + ox * sxScale, y: cy + oy * syScale };
  });

  ctx.beginPath();
  ctx.moveTo(expanded[0]!.x, expanded[0]!.y);
  for (let i = 1; i < expanded.length; i++) {
    ctx.lineTo(expanded[i]!.x, expanded[i]!.y);
  }
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Soften the oval edge
  ctx.filter = 'blur(5px)';
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  // Hard fade at/just below chin — kills neck & collar
  const chin = toOut(landmarks[152]!);
  const faceH =
    Math.hypot(toOut(landmarks[10]!).x - chin.x, toOut(landmarks[10]!).y - chin.y) ||
    outSize * 0.4;
  const fadeStart = chin.y - faceH * 0.01;
  const fadeEnd = chin.y + faceH * 0.06;

  const data = ctx.getImageData(0, 0, outSize, outSize);
  const a = new Uint8ClampedArray(outSize * outSize);
  for (let y = 0; y < outSize; y++) {
    let chinFade = 1;
    if (y > fadeEnd) chinFade = 0;
    else if (y > fadeStart) chinFade = 1 - (y - fadeStart) / (fadeEnd - fadeStart);
    for (let x = 0; x < outSize; x++) {
      const i = y * outSize + x;
      a[i] = Math.round((data.data[i * 4]! / 255) * chinFade * 255);
    }
  }
  return a;
}

/**
 * Crop face region; keep person ∩ head+hair so neck/shoulders/room are alpha.
 */
function drawSegmentedCutout(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  imgW: number,
  imgH: number,
  mask: Float32Array,
  mw: number,
  mh: number,
  outSize: number,
  landmarks: NormalizedLandmark[] | null
): string {
  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
  if (!ctx) throw new Error('No canvas');
  ctx.clearRect(0, 0, outSize, outSize);

  const scale = Math.max(outSize / sw, outSize / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (outSize - dw) / 2;
  const dy = (outSize - dh) / 2;
  ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);

  const headMask = landmarks
    ? buildHeadHairMask(landmarks, imgW, imgH, sx, sy, scale, dx, dy, outSize)
    : null;

  // Always apply a head-biased ellipse in output space so neck/shoulders die
  // even when landmarker misses (crop is already face-tight).
  const ellCx = outSize / 2;
  const ellCy = outSize * 0.37;
  const ellRx = outSize * 0.38;
  const ellRy = outSize * 0.37;

  const imageData = ctx.getImageData(0, 0, outSize, outSize);
  const px = imageData.data;

  for (let py = 0; py < outSize; py++) {
    for (let px_ = 0; px_ < outSize; px_++) {
      const i = (py * outSize + px_) * 4;
      const srcX = sx + (px_ - dx) / scale;
      const srcY = sy + (py - dy) / scale;
      if (srcX < 0 || srcY < 0 || srcX >= imgW || srcY >= imgH) {
        px[i + 3] = 0;
        continue;
      }
      const conf = sampleMaskEroded(mask, mw, mh, srcX / imgW, srcY / imgH);
      let a = softPersonAlpha(conf);
      if (headMask) {
        a *= (headMask[py * outSize + px_] ?? 0) / 255;
      }
      const enx = (px_ - ellCx) / ellRx;
      const eny = (py - ellCy) / ellRy;
      const ell = enx * enx + eny * eny;
      // Soft edge outside 1.0 — hard kill past 1.15
      if (ell > 1.15) a = 0;
      else if (ell > 1) a *= 1 - (ell - 1) / 0.15;
      px[i + 3] = Math.round((px[i + 3] ?? 255) * a);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function drawOvalFallback(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  outSize: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('No canvas');
  ctx.clearRect(0, 0, outSize, outSize);
  const scale = Math.max(outSize / sw, outSize / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (outSize - dw) / 2;
  const dy = (outSize - dh) / 2;
  ctx.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  // Tighter oval biased upward (more forehead/hair, less neck)
  ctx.ellipse(outSize / 2, outSize * 0.46, outSize * 0.42, outSize * 0.46, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  return canvas.toDataURL('image/png');
}

export async function detectFacesInImage(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<DetectedFace[]> {
  const detector = await getDetector();
  const result = detector.detect(source);
  const { w: imgW, h: imgH } = sourceSize(source);

  const rawBoxes: Array<{ x: number; y: number; width: number; height: number; score: number }> = [];
  for (const d of result.detections) {
    const box = detectionToBox(d, imgW, imgH);
    if (!box) continue;
    rawBoxes.push({ ...expandFaceBox(box, imgW, imgH), score: box.score });
  }
  rawBoxes.sort((a, b) => b.score * b.width * b.height - a.score * a.width * a.height);

  let mask: Float32Array | null = null;
  let mw = 0;
  let mh = 0;
  try {
    const m = await personAlphaMask(source);
    mask = m.data;
    mw = m.width;
    mh = m.height;
  } catch {
    /* preview falls back to oval if segmenter fails */
  }

  const allLandmarks = await detectAllLandmarks(source);

  const faces: DetectedFace[] = [];
  for (const expanded of rawBoxes) {
    const faceLm = pickLandmarksNear(allLandmarks, expanded, imgW, imgH);
    let previewUrl: string;
    if (mask) {
      previewUrl = drawSegmentedCutout(
        source,
        expanded.x,
        expanded.y,
        expanded.width,
        expanded.height,
        imgW,
        imgH,
        mask,
        mw,
        mh,
        256,
        faceLm
      );
    } else {
      previewUrl = drawOvalFallback(
        source,
        expanded.x,
        expanded.y,
        expanded.width,
        expanded.height,
        256
      );
    }
    faces.push({ ...expanded, previewUrl });
  }
  return faces;
}

/** Cut the chosen face (or largest) into a 1024 transparent PNG with background removed. */
export async function cutOutFace(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  face?: Pick<DetectedFace, 'x' | 'y' | 'width' | 'height'>
): Promise<string> {
  let box = face;
  if (!box) {
    const faces = await detectFacesInImage(source);
    if (!faces.length) {
      throw new Error('No face found — try again facing the camera.');
    }
    box = faces[0];
  }
  const { w: imgW, h: imgH } = sourceSize(source);
  try {
    const [{ data, width, height }, landmarks] = await Promise.all([
      personAlphaMask(source),
      detectLandmarksNear(source, box),
    ]);
    return drawSegmentedCutout(
      source,
      box.x,
      box.y,
      box.width,
      box.height,
      imgW,
      imgH,
      data,
      width,
      height,
      FACE_OUT_SIZE,
      landmarks
    );
  } catch (err) {
    console.warn('Person segmentation failed, using oval fallback', err);
    return drawOvalFallback(source, box.x, box.y, box.width, box.height, FACE_OUT_SIZE);
  }
}

/** Mirror a video frame to a canvas (selfie preview match). */
export function captureMirroredVideoFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  return canvas;
}
