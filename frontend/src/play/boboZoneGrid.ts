import type { GlovePosition } from '../types/game';
import { hitZoneOutline, isKnuckleInHitZone, type HitZoneCorners } from './targetZone';

/** Bobo doll body + head hit zone in play mode. */
export const BOBO_HIT_CORNERS: HitZoneCorners = [
  { x: 0.34, y: 0.1 },
  { x: 0.66, y: 0.1 },
  { x: 0.7, y: 0.58 },
  { x: 0.3, y: 0.58 },
];

export function isKnuckleOnBoboDoll(
  knuckle: GlovePosition,
  zoneOffset: GlovePosition = { x: 0, y: 0 }
): boolean {
  return isKnuckleInHitZone(knuckle, BOBO_HIT_CORNERS, zoneOffset);
}

export function boboHitZoneOutline(zoneOffset: GlovePosition = { x: 0, y: 0 }): GlovePosition[] {
  return hitZoneOutline(BOBO_HIT_CORNERS, zoneOffset);
}
