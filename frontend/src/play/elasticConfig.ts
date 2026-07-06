import type { GlovePosition } from '../types/game';
import type { GloveId } from '../types/game';
import type { GloveTransform } from './skeleton/types';
import { defaultAnchorY } from './gloveZoneGrid';

const anchorY = defaultAnchorY();

/** Anchor midway left↔centre and right↔centre, vertically centred in playable grid. */
export const GLOVE_ANCHORS: Record<'left' | 'right', GlovePosition> = {
  left: { x: 0.34, y: anchorY },
  right: { x: 0.66, y: anchorY },
};

/** Fixed inward tilt (degrees) — knuckles angle toward centre, not outward. */
export const INWARD_GLOVE_TILT = 14;

/**
 * Fixed guard orientation for SVG fallback — knuckles up, angled slightly inward.
 * Rotation does not change with elastic stretch (no spinning).
 */
export const GUARD_GLOVE_POSE: Record<GloveId, GloveTransform> = {
  left: { rotate: INWARD_GLOVE_TILT, scale: 1, scaleX: -1, skewX: 0, originY: '68%' },
  right: { rotate: -INWARD_GLOVE_TILT, scale: 1, scaleX: -1, skewX: 0, originY: '68%' },
};

/**
 * Invisible elastic stiffness — 0 (loose) … 100 (tight).
 * Adjust this single value to tune snap-back and wobble.
 */
export const ELASTIC_TENSION = 50;

/** Minimum centre-to-centre distance so gloves never overlap (normalized screen). */
export const GLOVE_MIN_SEPARATION = 0.18;

export function springFromTension(tension: number) {
  const t = Math.max(0, Math.min(100, tension)) / 100;
  return {
    stiffness: 60 + t * 280,
    damping: 6 + t * 18,
    wobbleAmp: 0.01 * (1 - t * 0.55),
  };
}
