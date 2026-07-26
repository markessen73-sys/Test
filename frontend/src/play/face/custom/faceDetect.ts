import {
  FaceDetector,
  FaceLandmarker,
  FilesetResolver,
  type Detection,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const DETECTOR_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.tflite';

export interface DetectedFace {
  /** Axis-aligned box in pixel coords of the source image. */
  box: { x: number; y: number; width: number; height: number };
  score: number;
}

let detectorPromise: Promise<FaceDetector> | null = null;
let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function vision() {
  return FilesetResolver.forVisionTasks(WASM_ROOT);
}

async function getDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = vision().then((fileset) =>
      FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: DETECTOR_MODEL, delegate: 'GPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.45,
      })
    );
  }
  return detectorPromise;
}

async function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = vision().then((fileset) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: LANDMARKER_MODEL, delegate: 'GPU' },
        runningMode: 'IMAGE',
        numFaces: 1,
      })
    );
  }
  return landmarkerPromise;
}

function detectionToFace(d: Detection, imgW: number, imgH: number): DetectedFace | null {
  const bb = d.boundingBox;
  if (!bb) return null;
  const x = Math.max(0, bb.originX);
  const y = Math.max(0, bb.originY);
  const width = Math.min(imgW - x, bb.width);
  const height = Math.min(imgH - y, bb.height);
  if (width < 8 || height < 8) return null;
  const score = d.categories?.[0]?.score ?? 0;
  return { box: { x, y, width, height }, score };
}

/** Detect faces in an HTMLImageElement / canvas / video frame. */
export async function detectFaces(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<DetectedFace[]> {
  const detector = await getDetector();
  const w =
    source instanceof HTMLVideoElement ? source.videoWidth : (source as HTMLImageElement).naturalWidth || source.width;
  const h =
    source instanceof HTMLVideoElement
      ? source.videoHeight
      : (source as HTMLImageElement).naturalHeight || source.height;
  const result = detector.detect(source);
  const faces = (result.detections || [])
    .map((d) => detectionToFace(d, w, h))
    .filter((f): f is DetectedFace => !!f)
    .sort((a, b) => b.score - a.score || b.box.width * b.box.height - a.box.width * a.box.height);
  return faces;
}

export interface FaceLandmarks {
  rightEye: { x: number; y: number };
  leftEye: { x: number; y: number };
  mouth: { x: number; y: number };
}

/** MediaPipe Face Mesh indices (approx eye centers + mouth). */
const RIGHT_EYE = 33;
const LEFT_EYE = 263;
const MOUTH = 13;

function landmarkAvg(
  landmarks: NormalizedLandmark[],
  indices: number[]
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const i of indices) {
    x += landmarks[i].x;
    y += landmarks[i].y;
  }
  return { x: x / indices.length, y: y / indices.length };
}

export async function detectFaceLandmarks(
  source: HTMLImageElement | HTMLCanvasElement
): Promise<FaceLandmarks | null> {
  const landmarker = await getLandmarker();
  const result = landmarker.detect(source);
  const lm = result.faceLandmarks?.[0];
  if (!lm || lm.length < 300) return null;
  return {
    rightEye: { x: lm[RIGHT_EYE].x, y: lm[RIGHT_EYE].y },
    leftEye: { x: lm[LEFT_EYE].x, y: lm[LEFT_EYE].y },
    mouth: landmarkAvg(lm, [MOUTH, 14, 17, 0]),
  };
}
