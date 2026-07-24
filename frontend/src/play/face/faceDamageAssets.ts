import type { FaceDamageId } from './faceDamage';

/**
 * Pre-rendered damaged faces supplied by the user.
 * When a damage has a reference PNG, that image's differences from the
 * base face are composited (exact ear/bruise art). Others use procedural overlays.
 */
export const FACE_DAMAGE_REFERENCE_SRC: Partial<Record<FaceDamageId, string>> = {
  cauliflowerLeftEar: '/faces/damage/cauliflower-left-ear.png',
  cauliflowerRightEar: '/faces/damage/cauliflower-right-ear.png',
};

export const FACE_DAMAGE_REFERENCE_IDS = Object.keys(
  FACE_DAMAGE_REFERENCE_SRC
) as FaceDamageId[];
