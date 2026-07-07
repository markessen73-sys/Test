/** Accumulated sparring-partner face injuries (canvas overlays). */
export type FaceDamageId =
  | 'cauliflowerLeftEar'
  | 'cauliflowerRightEar'
  | 'blackLeftEye'
  | 'swollenRightEye'
  | 'foreheadBandage'
  | 'brokenNose'
  | 'swollenBottomLip';

export const ALL_FACE_DAMAGES: readonly FaceDamageId[] = [
  'cauliflowerLeftEar',
  'cauliflowerRightEar',
  'blackLeftEye',
  'swollenRightEye',
  'foreheadBandage',
  'brokenNose',
  'swollenBottomLip',
] as const;

/** Random hits required before the next face injury (3–6 inclusive). */
export function randomDamageThreshold(): number {
  return 3 + Math.floor(Math.random() * 4);
}

export function pickRandomFaceDamage(applied: readonly FaceDamageId[]): FaceDamageId | null {
  const used = new Set(applied);
  const remaining = ALL_FACE_DAMAGES.filter((d) => !used.has(d));
  if (!remaining.length) return null;
  return remaining[Math.floor(Math.random() * remaining.length)];
}
