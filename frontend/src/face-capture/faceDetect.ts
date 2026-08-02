/**
 * Detect faces and cut them out with a transparent background.
 * Uses MediaPipe BlazeFace (short-range) via @mediapipe/tasks-vision.
 */
import { FaceDetector, FilesetResolver, type Detection } from '@mediapipe/tasks-vision';

export const FACE_OUT_SIZE = 1024;

export type DetectedFace = {
  /** Bounding box in source image pixels */
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  /** Small preview of the cutout for picker UI */
  previewUrl: string;
};

let detectorPromise: Promise<FaceDetector> | null = null;

async function getDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm'
      );
      return FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'GPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.45,
      });
    })().catch((err) => {
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
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

function drawOvalCutout(
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
  const imgW =
    source instanceof HTMLVideoElement
      ? source.videoWidth
      : source instanceof HTMLCanvasElement
        ? source.width
        : source.naturalWidth;
  const imgH =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : source instanceof HTMLCanvasElement
        ? source.height
        : source.naturalHeight;

  const faces: DetectedFace[] = [];
  for (const d of result.detections) {
    const box = detectionToBox(d, imgW, imgH);
    if (!box) continue;
    const expanded = expandFaceBox(box, imgW, imgH);
    const previewUrl = drawOvalCutout(
      source,
      expanded.x,
      expanded.y,
      expanded.width,
      expanded.height,
      256
    );
    faces.push({ ...expanded, score: box.score, previewUrl });
  }
  faces.sort((a, b) => b.score * b.width * b.height - a.score * a.width * a.height);
  return faces;
}

/** Cut the chosen face (or largest) into a 1024 transparent PNG. */
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
  return drawOvalCutout(source, box.x, box.y, box.width, box.height, FACE_OUT_SIZE);
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
