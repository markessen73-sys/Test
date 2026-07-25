/** Heavy-bag Polaroid placement + damage phases. */

/** Bag-width photo, then −20% so it sits inset on the leather. */
export const BAG_POLAROID_WIDTH = 0.9 * 0.8

/** Classic Polaroid outer aspect (taller white footer). */
export const BAG_POLAROID_ASPECT = 1.22

export const BAG_POLAROID_HEIGHT = BAG_POLAROID_WIDTH * BAG_POLAROID_ASPECT

/**
 * Photo centre on the bag body (bag-local metres).
 * Sits on the front leather, upper-mid so the two pins read clearly.
 */
export const BAG_POLAROID_CENTER: [number, number, number] = [0, 0.28, 0.47]

/** Inset of each pin from the top corners of the Polaroid (metres). */
export const BAG_POLAROID_PIN_INSET = 0.045

/** Pin head radius. */
export const BAG_POLAROID_PIN_RADIUS = 0.016

export type BagPolaroidPhase =
  | 'intact'
  | 'cornerTear'
  | 'onePin'
  | 'bothCorners'
  | 'halfTear'
  | 'fallen'

export type PolaroidScrapKind = 'cornerL' | 'cornerR' | 'half'

/**
 * Map meter stage (0–10, each step 10%) onto Polaroid destruction phases.
 * 20% corner · 40% pin out · 60% other corner · 80% half gone · 100% falls.
 */
export function bagPolaroidPhaseForStage(stage: number): BagPolaroidPhase {
  if (stage >= 10) return 'fallen'
  if (stage >= 8) return 'halfTear'
  if (stage >= 6) return 'bothCorners'
  if (stage >= 4) return 'onePin'
  if (stage >= 2) return 'cornerTear'
  return 'intact'
}

/** True once the right pin has come loose (40%+). */
export function bagPolaroidHangsByOnePin(phase: BagPolaroidPhase): boolean {
  return phase === 'onePin' || phase === 'bothCorners' || phase === 'halfTear'
}
