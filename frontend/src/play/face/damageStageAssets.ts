import { assetUrl } from '../../assetUrl';
import { DAMAGE_FACE_SEQUENCE } from './faceDamage';

/** Clean caricature used as the damage-box base (same style as injury refs). */
export const DAMAGE_STAGE_CLEAN_SRC = assetUrl('/faces/damage-stages/00-clean.png');

/**
 * Pre-baked cumulative injury faces created when the caricature is authored.
 * Index 0 = 10% (left cauliflower ear) … index 7 = 80% (bandage).
 */
export const DAMAGE_STAGE_SRCS: readonly string[] = [
  assetUrl('/faces/damage-stages/01-cauliflowerLeftEar.png'),
  assetUrl('/faces/damage-stages/02-blackRightEye.png'),
  assetUrl('/faces/damage-stages/03-swollenBottomLip.png'),
  assetUrl('/faces/damage-stages/04-cauliflowerRightEar.png'),
  assetUrl('/faces/damage-stages/05-missingTooth.png'),
  assetUrl('/faces/damage-stages/06-swollenLeftEye.png'),
  assetUrl('/faces/damage-stages/07-brokenNose.png'),
  assetUrl('/faces/damage-stages/08-foreheadBandage.png'),
] as const;

if (DAMAGE_STAGE_SRCS.length !== DAMAGE_FACE_SEQUENCE.length) {
  throw new Error('DAMAGE_STAGE_SRCS length must match DAMAGE_FACE_SEQUENCE');
}
