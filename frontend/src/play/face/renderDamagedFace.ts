import { drawFullFaceOnCanvas, loadFaceImage } from './composeFaceTexture';
import { drawFaceDamageOverlays } from './drawFaceDamageOverlays';
import { FACE_TEMPLATE_SRC } from './faceTemplate';
import type { FaceDamageId } from './faceDamage';

export type DamagedFaceAssets = {
  liveFace: HTMLImageElement;
};

/** Load the live 2D caricature used by the damage HUD. */
export async function loadDamagedFaceAssets(): Promise<DamagedFaceAssets> {
  const liveFace = await loadFaceImage(FACE_TEMPLATE_SRC);
  return { liveFace };
}

/**
 * Draw base face + simple bruise/cut stamps (works on any caricature).
 */
export function renderDamagedFace(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  assets: DamagedFaceAssets,
  damages: readonly FaceDamageId[]
) {
  drawFullFaceOnCanvas(ctx, assets.liveFace, canvasW, canvasH);
  drawFaceDamageOverlays(ctx, canvasW, canvasH, damages);
}
