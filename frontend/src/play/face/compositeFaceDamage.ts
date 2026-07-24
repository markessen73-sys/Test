import { FACE_CONTAIN_PAD } from './composeFaceTexture';
import { FACE_SOURCE_SIZE } from './faceTemplate';
import type { FaceDamageId } from './faceDamage';
import { FACE_DAMAGE_REFERENCE_SRC } from './faceDamageAssets';

const [IMAGE_W, IMAGE_H] = FACE_SOURCE_SIZE;

/** RGB distance threshold — pixels that differ this much are treated as damage. */
const DIFF_THRESHOLD = 28;

function faceDrawRect(canvasW: number, canvasH: number) {
  const contain = Math.min(canvasW / IMAGE_W, canvasH / IMAGE_H) * FACE_CONTAIN_PAD;
  const drawW = IMAGE_W * contain;
  const drawH = IMAGE_H * contain;
  return {
    x: (canvasW - drawW) / 2,
    y: (canvasH - drawH) / 2,
    w: drawW,
    h: drawH,
  };
}

function sampleImage(
  image: HTMLImageElement,
  w: number,
  h: number
): ImageData {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(image, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Composite pixels from a damaged reference face onto the canvas where they
 * differ from the base face. Matches the user's supplied damaged-face PNGs.
 */
export function compositeFaceDamageReference(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  baseImage: HTMLImageElement,
  damagedImage: HTMLImageElement
) {
  const { x, y, w, h } = faceDrawRect(canvasW, canvasH);
  const sw = Math.max(1, Math.round(w));
  const sh = Math.max(1, Math.round(h));

  const baseData = sampleImage(baseImage, sw, sh);
  const dmgData = sampleImage(damagedImage, sw, sh);
  const out = ctx.createImageData(sw, sh);
  const b = baseData.data;
  const d = dmgData.data;
  const o = out.data;

  for (let i = 0; i < b.length; i += 4) {
    const dr = Math.abs(d[i] - b[i]);
    const dg = Math.abs(d[i + 1] - b[i + 1]);
    const db = Math.abs(d[i + 2] - b[i + 2]);
    const da = Math.abs(d[i + 3] - b[i + 3]);
    const diff = dr + dg + db + da * 0.25;

    // Keep damaged pixels only where content differs and damaged pixel isn't empty
    if (diff > DIFF_THRESHOLD && d[i + 3] > 16) {
      o[i] = d[i];
      o[i + 1] = d[i + 1];
      o[i + 2] = d[i + 2];
      o[i + 3] = d[i + 3];
    } else {
      o[i + 3] = 0;
    }
  }

  const layer = document.createElement('canvas');
  layer.width = sw;
  layer.height = sh;
  layer.getContext('2d')!.putImageData(out, 0, 0);
  ctx.drawImage(layer, x, y, w, h);
}

/** Apply all damages that have pre-rendered reference faces. */
export function compositeReferenceDamages(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  baseImage: HTMLImageElement,
  damages: readonly FaceDamageId[],
  damageImages: ReadonlyMap<FaceDamageId, HTMLImageElement>
) {
  for (const id of damages) {
    if (!FACE_DAMAGE_REFERENCE_SRC[id]) continue;
    const img = damageImages.get(id);
    if (!img) continue;
    compositeFaceDamageReference(ctx, canvasW, canvasH, baseImage, img);
  }
}

/** Damages that still use procedural canvas art (no reference PNG yet). */
export function proceduralDamagesOnly(
  damages: readonly FaceDamageId[]
): FaceDamageId[] {
  return damages.filter((id) => !FACE_DAMAGE_REFERENCE_SRC[id]);
}
