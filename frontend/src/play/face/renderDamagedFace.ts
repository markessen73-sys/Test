import { drawFullFaceOnCanvas, loadFaceImage } from './composeFaceTexture';
import { drawFaceDamageOverlays } from './drawFaceDamageOverlays';
import { FACE_KO_SRC, FACE_TEMPLATE_SRC } from './faceTemplate';
import type { FaceDamageId } from './faceDamage';

export type DamagedFaceAssets = {
  liveFace: HTMLImageElement;
  knockoutFace: HTMLImageElement;
};

/** Load normal + knockout caricatures for the damage HUD. */
export async function loadDamagedFaceAssets(): Promise<DamagedFaceAssets> {
  const [liveFace, knockoutFace] = await Promise.all([
    loadFaceImage(FACE_TEMPLATE_SRC),
    loadFaceImage(FACE_KO_SRC),
  ]);
  return { liveFace, knockoutFace };
}

/**
 * Draw base face + bruise/cut stamps, or the knockout face at 100% damage.
 */
export function renderDamagedFace(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  assets: DamagedFaceAssets,
  damages: readonly FaceDamageId[],
  knockedOut = false
) {
  if (knockedOut) {
    drawFullFaceOnCanvas(ctx, assets.knockoutFace, canvasW, canvasH);
    return;
  }
  drawFullFaceOnCanvas(ctx, assets.liveFace, canvasW, canvasH);
  drawFaceDamageOverlays(ctx, canvasW, canvasH, damages);
}
