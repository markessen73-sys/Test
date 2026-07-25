import { drawFullFaceOnCanvas } from './composeFaceTexture';
import {
  damageFaceIndexForStage,
  DAMAGE_METER_STEPS,
} from './faceDamage';
import { createDamageFaceVariants } from './createDamageFaceVariants';

export type DamagedFaceAssets = {
  cleanFace: HTMLImageElement;
  /** Cumulative injury caricatures, baked at face-creation time. */
  damageFaces: HTMLImageElement[];
  knockoutFace: HTMLImageElement;
};

/** Load clean + knockout faces and bake the cumulative damage variants. */
export async function loadDamagedFaceAssets(): Promise<DamagedFaceAssets> {
  return createDamageFaceVariants();
}

/**
 * Draw the damage-box face for a meter stage (0–10).
 * 0 = clean, 1–8 = cumulative injury faces, 9 = last injury face, 10 = KO.
 */
export function renderDamagedFace(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  assets: DamagedFaceAssets,
  stage: number
) {
  const clamped = Math.max(0, Math.min(DAMAGE_METER_STEPS, stage));
  if (clamped >= DAMAGE_METER_STEPS) {
    drawFullFaceOnCanvas(ctx, assets.knockoutFace, canvasW, canvasH);
    return;
  }
  const faceIndex = damageFaceIndexForStage(clamped);
  if (faceIndex < 0) {
    drawFullFaceOnCanvas(ctx, assets.cleanFace, canvasW, canvasH);
    return;
  }
  const face = assets.damageFaces[faceIndex] ?? assets.cleanFace;
  drawFullFaceOnCanvas(ctx, face, canvasW, canvasH);
}
