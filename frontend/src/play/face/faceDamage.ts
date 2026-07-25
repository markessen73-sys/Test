/**
 * Cumulative sparring-partner face injuries for the damage HUD.
 * Applied in fixed order; each meter step is +10%.
 */
export type FaceDamageId =
  | 'cauliflowerLeftEar'
  | 'blackRightEye'
  | 'swollenBottomLip'
  | 'cauliflowerRightEar'
  | 'missingTooth'
  | 'swollenLeftEye'
  | 'foreheadBandage'
  | 'brokenNose';

/**
 * Eight cumulative damage faces (baked when the caricature is created).
 * Shown in the damage box at 10%…80%. 90% keeps the last face; 100% = KO.
 *
 * 1 left cauliflower ear
 * 2 + right black eye
 * 3 + swollen bottom lip
 * 4 + cauliflower right ear
 * 5 + missing tooth
 * 6 + swollen left eye
 * 7 + broken nose
 * 8 + bandage across head
 */
export const DAMAGE_FACE_SEQUENCE: readonly FaceDamageId[] = [
  'cauliflowerLeftEar',
  'blackRightEye',
  'swollenBottomLip',
  'cauliflowerRightEar',
  'missingTooth',
  'swollenLeftEye',
  'brokenNose',
  'foreheadBandage',
] as const;

/** @deprecated Prefer DAMAGE_FACE_SEQUENCE — kept for call-site compatibility. */
export const ALL_FACE_DAMAGES = DAMAGE_FACE_SEQUENCE;

/** Meter fills in 10% steps; KO at 100% (stage 10). */
export const DAMAGE_METER_STEPS = 10;

/** Random hits required before the next damage step (3–6 inclusive). */
export function randomDamageThreshold(): number {
  return 3 + Math.floor(Math.random() * 4);
}

/** Next injury in the fixed sequence, or null when all 8 faces are applied. */
export function nextSequentialFaceDamage(
  applied: readonly FaceDamageId[]
): FaceDamageId | null {
  if (applied.length >= DAMAGE_FACE_SEQUENCE.length) return null;
  return DAMAGE_FACE_SEQUENCE[applied.length];
}

/** Damage % for a meter stage (0–10 → 0–100). */
export function damagePercentForStage(stage: number): number {
  return Math.max(0, Math.min(DAMAGE_METER_STEPS, stage)) * 10;
}

/**
 * Which baked face to show for a meter stage.
 * 0 → none (clean); 1–8 → variant index 0–7; 9 → last variant; 10 → KO (caller).
 */
export function damageFaceIndexForStage(stage: number): number {
  if (stage <= 0) return -1;
  return Math.min(stage, DAMAGE_FACE_SEQUENCE.length) - 1;
}
