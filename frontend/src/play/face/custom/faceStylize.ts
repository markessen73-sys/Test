import { FaceStylizer, FilesetResolver, type MPImage } from '@mediapipe/tasks-vision';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_stylizer/blaze_face_stylizer/float32/1/face_stylizer_color_ink.task';

let stylizerPromise: Promise<FaceStylizer> | null = null;

async function getStylizer(): Promise<FaceStylizer> {
  if (!stylizerPromise) {
    stylizerPromise = FilesetResolver.forVisionTasks(WASM_ROOT).then((fileset) =>
      FaceStylizer.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
      })
    );
  }
  return stylizerPromise;
}

function mpImageToCanvas(mp: MPImage): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = mp.width;
  canvas.height = mp.height;
  const ctx = canvas.getContext('2d')!;
  try {
    ctx.putImageData(mp.getAsImageData(), 0, 0);
  } catch {
    const bmp = mp.getAsImageBitmap();
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
  }
  return canvas;
}

/** Stylize a face crop into an ink-cartoon look (preserves likeness). */
export async function stylizeFaceToCaricature(
  source: HTMLImageElement | HTMLCanvasElement
): Promise<Blob> {
  const stylizer = await getStylizer();
  const result = stylizer.stylize(source);
  if (!result) {
    throw new Error('Face stylizer found no face.');
  }
  try {
    const canvas = mpImageToCanvas(result);
    const out = document.createElement('canvas');
    out.width = 1024;
    out.height = 1024;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 1024, 1024);
    const scale = Math.min(1024 / canvas.width, 1024 / canvas.height) * 0.95;
    const dw = canvas.width * scale;
    const dh = canvas.height * scale;
    ctx.drawImage(canvas, (1024 - dw) / 2, (1024 - dh) / 2, dw, dh);
    const id = ctx.getImageData(0, 0, 1024, 1024);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const max = Math.max(d[i], d[i + 1], d[i + 2]);
      const min = Math.min(d[i], d[i + 1], d[i + 2]);
      if (min > 205 && max - min < 30) {
        d[i] = 0;
        d[i + 1] = 0;
        d[i + 2] = 0;
      }
    }
    ctx.putImageData(id, 0, 0);
    return new Promise((resolve, reject) => {
      out.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png');
    });
  } finally {
    result.close();
  }
}
