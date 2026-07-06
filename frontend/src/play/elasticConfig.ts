import type { GlovePosition } from '../types/game';

/** Anchor halfway down screen; L midway left↔centre, R midway right↔centre */
export const GLOVE_ANCHORS: Record<'left' | 'right', GlovePosition> = {
  left: { x: 0.25, y: 0.5 },
  right: { x: 0.75, y: 0.5 },
};

/**
 * Invisible elastic stiffness — 0 (loose) … 100 (tight).
 * Adjust this single value to tune snap-back and wobble.
 */
export const ELASTIC_TENSION = 50;

/** Minimum centre-to-centre distance so gloves never overlap (normalized screen). */
export const GLOVE_MIN_SEPARATION = 0.2;

export function springFromTension(tension: number) {
  const t = Math.max(0, Math.min(100, tension)) / 100;
  return {
    stiffness: 60 + t * 280,
    damping: 6 + t * 18,
    wobbleAmp: 0.01 * (1 - t * 0.55),
  };
}
