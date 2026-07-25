import { assetUrl } from '../../assetUrl';
import { DAMAGE_FACE_SEQUENCE } from './faceDamage';

/** Clean comedy-clown caricature for the bobo doll. */
export const BOBO_CLOWN_CLEAN_SRC = assetUrl('/faces/bobo-clown-stages/00-clean.png');

/**
 * Pre-baked cumulative clown injury faces (same ladder as the ring HUD).
 * Index 0 = 10% … index 7 = 80%.
 */
export const BOBO_CLOWN_STAGE_SRCS: readonly string[] = [
  assetUrl('/faces/bobo-clown-stages/01-cauliflowerLeftEar.png'),
  assetUrl('/faces/bobo-clown-stages/02-blackRightEye.png'),
  assetUrl('/faces/bobo-clown-stages/03-chinCrossPlaster.png'),
  assetUrl('/faces/bobo-clown-stages/04-cauliflowerRightEar.png'),
  assetUrl('/faces/bobo-clown-stages/05-missingTooth.png'),
  assetUrl('/faces/bobo-clown-stages/06-swollenLeftEye.png'),
  assetUrl('/faces/bobo-clown-stages/07-brokenNose.png'),
  assetUrl('/faces/bobo-clown-stages/08-foreheadBandage.png'),
] as const;

/** 90% holds the last injury face. */
export const BOBO_CLOWN_HOLD_SRC = assetUrl('/faces/bobo-clown-stages/09-hold.png');

/** 100% clown knockout. */
export const BOBO_CLOWN_KO_SRC = assetUrl('/faces/bobo-clown-stages/10-knockout.png');

if (BOBO_CLOWN_STAGE_SRCS.length !== DAMAGE_FACE_SEQUENCE.length) {
  throw new Error('BOBO_CLOWN_STAGE_SRCS length must match DAMAGE_FACE_SEQUENCE');
}
