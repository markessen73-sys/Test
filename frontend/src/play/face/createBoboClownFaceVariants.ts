import { loadFaceImage } from './composeFaceTexture';
import type { CharacterDef } from './characters';
import { CHARACTERS, DEFAULT_CHARACTER_ID } from './characters';

/**
 * Load the 11 comedy-clown faces baked for a character's bobo doll set.
 */
export async function createBoboClownFaceVariants(
  character: CharacterDef = CHARACTERS[DEFAULT_CHARACTER_ID]
): Promise<{
  cleanFace: HTMLImageElement;
  damageFaces: HTMLImageElement[];
  knockoutFace: HTMLImageElement;
}> {
  const [cleanFace, knockoutFace, ...damageFaces] = await Promise.all([
    loadFaceImage(character.boboCleanSrc),
    loadFaceImage(character.boboKoSrc),
    ...character.boboDamageStageSrcs.map(loadFaceImage),
  ]);
  return { cleanFace, damageFaces, knockoutFace };
}
