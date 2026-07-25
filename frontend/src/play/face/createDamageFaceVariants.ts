import { drawFullFaceOnCanvas, loadFaceImage } from './composeFaceTexture';
import { compositeReferenceDamages } from './compositeFaceDamage';
import { DAMAGE_FACE_SEQUENCE } from './faceDamage';
import {
  FACE_DAMAGE_ASSETS,
  FACE_DAMAGE_BASELINE_SRC,
  faceDamageAssetSrcs,
} from './faceDamageAssets';
import { FACE_KO_SRC, FACE_SOURCE_SIZE, FACE_TEMPLATE_SRC } from './faceTemplate';

const [BAKE_W, BAKE_H] = FACE_SOURCE_SIZE;

async function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = canvas.toDataURL('image/png');
  await img.decode();
  return img;
}

/**
 * When a caricature face is created, bake the cumulative injury variants:
 * each face adds the next injury on top of the previous (left cauliflower ear →
 * + right black eye → + swollen lip → + right ear → + missing tooth →
 * + swollen left eye → + broken nose → + forehead bandage).
 *
 * Uses male-baseline deltas from the photo-ref damage PNGs so the same
 * pipeline works for any future AI caricature with matching landmarks.
 */
export async function createDamageFaceVariants(
  baseFaceSrc: string = FACE_TEMPLATE_SRC
): Promise<{
  cleanFace: HTMLImageElement;
  damageFaces: HTMLImageElement[];
  knockoutFace: HTMLImageElement;
}> {
  const srcs = faceDamageAssetSrcs();
  const damageSrcList = srcs.filter((s) => s !== FACE_DAMAGE_BASELINE_SRC);
  const [cleanFace, knockoutFace, maleBaseline, ...damageImgs] = await Promise.all([
    loadFaceImage(baseFaceSrc),
    loadFaceImage(FACE_KO_SRC),
    loadFaceImage(FACE_DAMAGE_BASELINE_SRC),
    ...damageSrcList.map(loadFaceImage),
  ]);

  const imagesBySrc = new Map<string, HTMLImageElement>();
  imagesBySrc.set(FACE_DAMAGE_BASELINE_SRC, maleBaseline);
  damageSrcList.forEach((src, i) => imagesBySrc.set(src, damageImgs[i]));

  const canvas = document.createElement('canvas');
  canvas.width = BAKE_W;
  canvas.height = BAKE_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create canvas for damage face bake');

  // Start from the clean caricature; each step stamps one more injury.
  drawFullFaceOnCanvas(ctx, cleanFace, BAKE_W, BAKE_H);

  const damageFaces: HTMLImageElement[] = [];
  for (const id of DAMAGE_FACE_SEQUENCE) {
    if (!FACE_DAMAGE_ASSETS[id]) {
      console.warn(`[damage faces] missing asset for ${id}`);
    }
    compositeReferenceDamages(ctx, BAKE_W, BAKE_H, maleBaseline, [id], imagesBySrc);
    damageFaces.push(await canvasToImage(canvas));
  }

  return { cleanFace, damageFaces, knockoutFace };
}
