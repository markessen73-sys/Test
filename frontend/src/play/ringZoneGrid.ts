import type { GlovePosition } from '../types/game';
import { hitZoneOutline, isKnuckleInHitZone, type HitZoneCorners } from './targetZone';

/** Sparring partner torso + head hit zone in ring play mode. */
export const RING_HIT_CORNERS: HitZoneCorners = [
  { x: 0.36, y: 0.08 },
  { x: 0.64, y: 0.08 },
  { x: 0.68, y: 0.52 },
  { x: 0.32, y: 0.52 },
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
