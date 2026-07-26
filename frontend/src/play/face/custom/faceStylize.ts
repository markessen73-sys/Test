import { FaceStylizer, FilesetResolver, type MPImage } from '@mediapipe/tasks-vision';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';

/** Prebuilt MediaPipe face stylizers (preserve likeness, cartoon/paint look). */
const STYLIZER_MODELS = [
  // Color-ink is the closest shipped style to flat cartoon line art.
  'https://storage.googleapis.com/mediapipe-models/face_stylizer/blaze_face_stylizer/float32/1/face_stylizer_color_ink.task',
  'https://storage.googleapis.com/mediapipe-models/face_stylizer/blaze_face_stylizer/float32/1/face_stylizer_oil_painting.task',
  'https://storage.googleapis.com/mediapipe-models/face_stylizer/blaze_face_stylizer/float32/1/blaze_face_stylizer.task',
] as const;

let stylizerPromise: Promise<FaceStylizer> | null = null;
let stylizerModelIndex = 0;

async function getStylizer(): Promise<FaceStylizer> {
  if (!stylizerPromise) {
    const modelPath = STYLIZER_MODELS[stylizerModelIndex] ?? STYLIZER_MODELS[0];
    stylizerPromise = FilesetResolver.forVisionTasks(WASM_ROOT)
      .then(async (fileset) => {
        try {
          return await FaceStylizer.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' },
          });
        } catch {
          return FaceStylizer.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
          });
        }
      })
      .catch(async (err) => {
        stylizerPromise = null;
        if (stylizerModelIndex < STYLIZER_MODELS.length - 1) {
          stylizerModelIndex += 1;
          return getStylizer();
        }
        throw err;
      });
  }
  return stylizerPromise;
}

function mpImageToCanvas(mp: MPImage): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = mp.width;
  canvas.height = mp.height;
  const ctx = canvas.getContext('2d')!;
  try {
    const data = mp.getAsImageData();
    ctx.putImageData(data, 0, 0);
  } catch {
    // Some builds prefer ImageBitmap.
    const bmp = mp.getAsImageBitmap();
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
  }
  return canvas;
}

/**
 * Stylize a face crop into a cartoon/caricature still preserving likeness.
 * Returns a PNG blob (RGB, typically opaque background from the model).
 */
export async function stylizeFaceToCaricature(
  source: HTMLImageElement | HTMLCanvasElement
): Promise<Blob> {
  const stylizer = await getStylizer();
  const result = stylizer.stylize(source);
  if (!result) {
    throw new Error('Face stylizer found no face to caricature. Try a clearer front-facing photo.');
  }
  try {
    const canvas = mpImageToCanvas(result);
    // Place on pure black square so it matches gym pack convention.
    const out = document.createElement('canvas');
    const side = 1024;
    out.width = side;
    out.height = side;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, side, side);
    const scale = Math.min(side / canvas.width, side / canvas.height) * 0.96;
    const dw = canvas.width * scale;
    const dh = canvas.height * scale;
    ctx.drawImage(canvas, (side - dw) / 2, (side - dh) / 2, dw, dh);
    // Punch near-white / studio backdrops to transparent then refill black.
    const id = ctx.getImageData(0, 0, side, side);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      // Model often leaves pale studio bg — force to black.
      if (min > 210 && max - min < 28) {
        d[i] = 0;
        d[i + 1] = 0;
        d[i + 2] = 0;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);

    return new Promise((resolve, reject) => {
      out.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode caricature'))), 'image/png');
    });
  } finally {
    result.close();
  }
}
