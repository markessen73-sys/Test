import { loadFaceImage } from './composeFaceTexture';
import { DAMAGE_STAGE_CLEAN_SRC, DAMAGE_STAGE_SRCS } from './damageStageAssets';
import { FACE_KO_SRC } from './faceTemplate';

/**
 * Load the cumulative injury faces created with the caricature.
 *
 * These PNGs are authored/baked ahead of time (see
 * `scripts/bake-damage-stage-faces.mjs`) so the damage box can swap a real
 * face every 10% instead of stamping procedural bruises.
 */
export async function createDamageFaceVariants(): Promise<{
  cleanFace: HTMLImageElement;
  damageFaces: HTMLImageElement[];
  knockoutFace: HTMLImageElement;
}> {
  const [cleanFace, knockoutFace, ...damageFaces] = await Promise.all([
    loadFaceImage(DAMAGE_STAGE_CLEAN_SRC),
    loadFaceImage(FACE_KO_SRC),
    ...DAMAGE_STAGE_SRCS.map(loadFaceImage),
  ]);
  return { cleanFace, damageFaces, knockoutFace };
}
