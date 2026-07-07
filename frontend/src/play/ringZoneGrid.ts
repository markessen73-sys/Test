import type { GlovePosition } from '../types/game';
import { hitZoneOutline, isKnuckleInHitZone, type HitZoneCorners } from './targetZone';

/** Sparring partner torso + head hit zone in ring play mode. */
export const RING_HIT_CORNERS: HitZoneCorners = [
  { x: 0.26, y: 0.02 },
  { x: 0.74, y: 0.02 },
  { x: 0.76, y: 0.7 },
  { x: 0.24, y: 0.7 },
];

export function isKnuckleOnSparringPartner(
  knuckle: GlovePosition,
  zoneOffset: GlovePosition = { x: 0, y: 0 }
): boolean {
  return isKnuckleInHitZone(knuckle, RING_HIT_CORNERS, zoneOffset);
}

export function ringHitZoneOutline(zoneOffset: GlovePosition = { x: 0, y: 0 }): GlovePosition[] {
  return hitZoneOutline(RING_HIT_CORNERS, zoneOffset);
}
