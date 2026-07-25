import { drawFullFaceOnCanvas, loadFaceImage } from './composeFaceTexture';
import { drawFaceDamageOverlays } from './drawFaceDamageOverlays';
import {
  compositeReferenceDamages,
  FACE_DAMAGE_BASELINE_SRC,
  proceduralDamagesOnly,
} from './compositeFaceDamage';
import { faceDamageAssetSrcs } from './faceDamageAssets';
import { FACE_TEMPLATE_SRC } from './faceTemplate';
import type { FaceDamageId } from './faceDamage';

export type DamagedFaceAssets = {
  liveFace: HTMLImageElement;
  maleBaseline: HTMLImageElement;
  damageImages: Map<string, HTMLImageElement>;
};

/** Load live face + male baseline + all damage reference PNGs. */
export async function loadDamagedFaceAssets(): Promise<DamagedFaceAssets> {
  const srcs = faceDamageAssetSrcs();
  const [liveFace, maleBaseline, ...pairs] = await Promise.all([
    loadFaceImage(FACE_TEMPLATE_SRC),
    loadFaceImage(FACE_DAMAGE_BASELINE_SRC),
    ...srcs.map(async (src) => {
      const loaded = await loadFaceImage(src);
      return [src, loaded] as const;
    }),
  ]);
  const damageImages = new Map<string, HTMLImageElement>();
  for (const [src, loaded] of pairs) damageImages.set(src, loaded);
  return { liveFace, maleBaseline, damageImages };
}

/** Draw base face + accumulated injury stamps into a canvas context. */
export function renderDamagedFace(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  assets: DamagedFaceAssets,
  damages: readonly FaceDamageId[]
) {
  drawFullFaceOnCanvas(ctx, assets.liveFace, canvasW, canvasH);
  compositeReferenceDamages(
    ctx,
    canvasW,
    canvasH,
    assets.maleBaseline,
    damages,
    assets.damageImages
  );
  drawFaceDamageOverlays(ctx, canvasW, canvasH, proceduralDamagesOnly(damages));
}
