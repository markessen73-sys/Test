import { loadFaceImage } from './composeFaceTexture';
import {
  BOBO_CLOWN_CLEAN_SRC,
  BOBO_CLOWN_KO_SRC,
  BOBO_CLOWN_STAGE_SRCS,
} from './boboClownStageAssets';

/**
 * Load the 11 comedy-clown faces baked for the bobo doll
 * (`scripts/bake-bobo-clown-faces.mjs`).
 */
export async function createBoboClownFaceVariants(): Promise<{
  cleanFace: HTMLImageElement;
  damageFaces: HTMLImageElement[];
  knockoutFace: HTMLImageElement;
}> {
  const [cleanFace, knockoutFace, ...damageFaces] = await Promise.all([
    loadFaceImage(BOBO_CLOWN_CLEAN_SRC),
    loadFaceImage(BOBO_CLOWN_KO_SRC),
    ...BOBO_CLOWN_STAGE_SRCS.map(loadFaceImage),
  ]);
  return { cleanFace, damageFaces, knockoutFace };
}
