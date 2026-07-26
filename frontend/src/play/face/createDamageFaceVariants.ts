import { loadFaceImage } from './composeFaceTexture';
import type { CharacterDef } from './characters';
import { CHARACTERS, DEFAULT_CHARACTER_ID } from './characters';

/**
 * Load the cumulative injury faces for a character.
 * Baked ahead of time (see `scripts/bake-damage-stage-faces.mjs`).
 */
export async function createDamageFaceVariants(
  character: CharacterDef = CHARACTERS[DEFAULT_CHARACTER_ID]
): Promise<{
  cleanFace: HTMLImageElement;
  damageFaces: HTMLImageElement[];
  knockoutFace: HTMLImageElement;
}> {
  const [cleanFace, knockoutFace, ...damageFaces] = await Promise.all([
    loadFaceImage(character.damageStageCleanSrc),
    loadFaceImage(character.knockoutSrc),
    ...character.damageStageSrcs.map(loadFaceImage),
  ]);
  return { cleanFace, damageFaces, knockoutFace };
}
