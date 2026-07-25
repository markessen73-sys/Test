/** Bobo head sphere: centre y=2.28, radius 0.44. */
export const BOBO_HEAD_Y = 2.28;
export const BOBO_HEAD_RADIUS = 0.44;

/**
 * Face plane sits just in front of the sphere surface so the opaque head
 * doesn't clip out the middle of the caricature.
 */
export const BOBO_FACE_CENTER: [number, number, number] = [
  0,
  BOBO_HEAD_Y,
  BOBO_HEAD_RADIUS + 0.04,
];

/** Head diameter × 1.3 — clown face reads big on the ball. */
export const BOBO_FACE_SIZE: [number, number] = [
  BOBO_HEAD_RADIUS * 2 * 1.3,
  BOBO_HEAD_RADIUS * 2 * 1.3,
];
