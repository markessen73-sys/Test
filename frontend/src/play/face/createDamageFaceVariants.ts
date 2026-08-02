import { loadFaceImage } from './composeFaceTexture';
import type { CharacterDef } from './characters';
import { CHARACTERS, DEFAULT_CHARACTER_ID } from './characters';
import { bakePhotoDamageStages } from '../../face-capture/bakePhotoDamage';

/**
 * Load the cumulative injury faces for a character.
 * Photo uploads with feature marks bake injuries onto the photo at load time
 * so the damage HUD always shows the user's face (not the stock caricature).
 */
export async function createDamageFaceVariants(
  character: CharacterDef = CHARACTERS[DEFAULT_CHARACTER_ID]
): Promise<{
  cleanFace: HTMLImageElement;
  damageFaces: HTMLImageElement[];
  knockoutFace: HTMLImageElement;
}> {
  if (character.photoFeatures) {
    const baked = await bakePhotoDamageStages(
      character.damageStageCleanSrc,
      character.photoFeatures,
      character.damageStageKnockoutSrc,
    );
    const [cleanFace, knockoutFace, ...damageFaces] = await Promise.all([
      loadFaceImage(character.damageStageCleanSrc),
      loadFaceImage(baked.knockout),
      ...baked.stages.map(loadFaceImage),
    ]);
    return { cleanFace, damageFaces, knockoutFace };
  }

  const [cleanFace, knockoutFace, ...damageFaces] = await Promise.all([
    loadFaceImage(character.damageStageCleanSrc),
    loadFaceImage(character.damageStageKnockoutSrc),
    ...character.damageStageSrcs.map(loadFaceImage),
  ]);
  return { cleanFace, damageFaces, knockoutFace };
}
