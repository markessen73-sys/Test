import { drawFullFaceOnCanvas } from './composeFaceTexture';
import type { CharacterDef } from './characters';
import {
  damageFaceIndexForStage,
  DAMAGE_METER_STEPS,
} from './faceDamage';
import { createDamageFaceVariants } from './createDamageFaceVariants';
import { createBoboClownFaceVariants } from './createBoboClownFaceVariants';

export type DamagedFaceAssets = {
  cleanFace: HTMLImageElement;
  /** Cumulative injury caricatures, baked at face-creation time. */
  damageFaces: HTMLImageElement[];
  knockoutFace: HTMLImageElement;
};

/** Load clean + knockout faces and bake the cumulative damage variants. */
export async function loadDamagedFaceAssets(
  character?: CharacterDef
): Promise<DamagedFaceAssets> {
  return createDamageFaceVariants(character);
}

/** Load the 11 comedy-clown faces for the bobo doll. */
export async function loadBoboClownFaceAssets(
  character?: CharacterDef
): Promise<DamagedFaceAssets> {
  return createBoboClownFaceVariants(character);
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
