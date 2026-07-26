import type { GlovePosition } from '../types/game';
import type { GloveId } from '../types/game';
import type { GloveTransform } from './skeleton/types';
import { PLAY_EQUIPMENT_BOTTOM_Y } from './gloveZoneGrid';
import {
  gloveCuffYForBottomNorm,
  halfGloveHeightNorm,
  halfGloveWidthNorm,
  ZONE_GLOVE_W,
} from './gloveGeometry';

/** Fixed inward tilt (degrees) — knuckles angle toward centre when idle. */
export const INWARD_GLOVE_TILT = 14;

/** Reference width for horizontal inset — keeps guard spacing stable across viewports. */
const REF_SCREEN_W = 1080;

/** Left guard sits a touch higher than the right. */
const LEFT_GUARD_RAISE_FRAC = 0.22;

/** Rest anchors — glove bottoms line up with equipment base; X spacing stays fixed. */
export function gloveRestAnchors(screenH: number): Record<'left' | 'right', GlovePosition> {
  const halfGloveNorm = halfGloveWidthNorm(REF_SCREEN_W);
  const leftRaise = halfGloveHeightNorm(screenH) * LEFT_GUARD_RAISE_FRAC;
  const rightY = gloveCuffYForBottomNorm(
    PLAY_EQUIPMENT_BOTTOM_Y,
    screenH,
    'right',
    INWARD_GLOVE_TILT
  );
  const leftY = gloveCuffYForBottomNorm(
    PLAY_EQUIPMENT_BOTTOM_Y,
    screenH,
    'left',
    -INWARD_GLOVE_TILT,
    leftRaise
  );
  return {
    left: { x: 0.4 - halfGloveNorm, y: leftY },
    right: { x: 0.6 + halfGloveNorm, y: rightY },
  };
}

/** Default anchors for 800px-tall play area (updated live on resize in useElasticGloves). */
export const GLOVE_ANCHORS = gloveRestAnchors(800);

export { ZONE_GLOVE_W };

/**
 * Fast-move threshold on a 0–100 scale (trail + bag impact).
 * 50 = moderate flick; raise for harder/faster required, lower for easier.
 */
export const FAST_MOVE_SPEED_LEVEL = 10;

/** Pixel speed that maps to 100 on the fast-move scale. */
export const MAX_SPEED_PX_S = 1200;

export function fastMoveThresholdPxPerSec(level = FAST_MOVE_SPEED_LEVEL): number {
  return (Math.max(0, Math.min(100, level)) / 100) * MAX_SPEED_PX_S;
}

export function speedLevelFromPxPerSec(pxPerSec: number): number {
  return Math.min(100, (pxPerSec / MAX_SPEED_PX_S) * 100);
}

/**
 * Fixed guard orientation for SVG fallback — knuckles up, angled slightly inward.
 * Rotation does not change with elastic stretch (no spinning).
 */
export const GUARD_GLOVE_POSE: Record<GloveId, GloveTransform> = {
  left: { rotate: -INWARD_GLOVE_TILT, scale: 1, scaleX: -1, skewX: 0, originY: '68%' },
  right: { rotate: INWARD_GLOVE_TILT, scale: 1, scaleX: -1, skewX: 0, originY: '68%' },
};

/**
 * Invisible elastic stiffness — 0 (loose) … 100 (tight).
 * Adjust this single value to tune snap-back and wobble.
 */
export const ELASTIC_TENSION = 50;

/** Minimum centre-to-centre distance so gloves never overlap (normalized screen). */
export const GLOVE_MIN_SEPARATION = 0.15;

export function springFromTension(tension: number) {
  const t = Math.max(0, Math.min(100, tension)) / 100;
  return {
    stiffness: 60 + t * 280,
    damping: 6 + t * 18,
    wobbleAmp: 0.01 * (1 - t * 0.55),
  };
}
