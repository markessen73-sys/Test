/**
 * Detect faces, remove background (person segmentation), and cut to transparent PNG.
 * Uses MediaPipe Face Detector + Selfie Image Segmenter via @mediapipe/tasks-vision.
 */
import {
  FaceDetector,
  FilesetResolver,
  ImageSegmenter,
  type Detection,
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

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

let visionPromise: Promise<WasmFileset> | null = null;
let detectorPromise: Promise<FaceDetector> | null = null;
let segmenterPromise: Promise<ImageSegmenter> | null = null;

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
      // CPU is more reliable across browsers for selfie segmentation;
      // GPU delegate often fails silently and we were falling back to oval crops.
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

/** Expand face box to include forehead / chin / a bit of hair. */
export function expandFaceBox(
  box: { x: number; y: number; width: number; height: number },
  imgW: number,
  imgH: number
) {
  const padX = box.width * 0.35;
  const padTop = box.height * 0.55;
  const padBot = box.height * 0.35;
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
    // Prefer confidence mask (1 = person). Category mask uses 0=person, 255=background.
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
        // 0 = selfie/person, 255 = background for this model
        data[i] = (bytes[i] ?? 255) < 128 ? 1 : 0;
      }
      return { data, width: cat.width, height: cat.height };
    }
    throw new Error('Segmentation returned no mask');
  } finally {
    result.close();
  }
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
  // Higher floor than before — wall near hair often sits ~0.2–0.4
  const t = Math.min(1, Math.max(0, (confidence - 0.45) / 0.3));
  const s = t * t * (3 - 2 * t);
  // Extra punch so mid-confidence fringe dies
  return s * s;
}

/**
 * Crop face region and apply person segmentation so room/background is true alpha.
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
  outSize: number
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
      const a = softPersonAlpha(conf);
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
  ctx.ellipse(outSize / 2, outSize / 2, outSize * 0.46, outSize * 0.48, 0, 0, Math.PI * 2);
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

  const faces: DetectedFace[] = [];
  for (const expanded of rawBoxes) {
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
        256
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
    const { data, width, height } = await personAlphaMask(source);
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
      FACE_OUT_SIZE
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
