import type { GlovePosition } from '../types/game';
import { hitZoneOutline, isKnuckleInHitZone, type HitZoneCorners } from './targetZone';

/** Bobo doll — full height hit zone (matches heavy bag scale). */
export const BOBO_HIT_CORNERS: HitZoneCorners = [
  { x: 0.32, y: 0.12 },
  { x: 0.68, y: 0.12 },
  { x: 0.72, y: 0.54 },
  { x: 0.28, y: 0.54 },
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
