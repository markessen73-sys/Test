import type { GlovePosition } from '../types/game';
import { hitZoneOutline, isKnuckleInHitZone, type HitZoneCorners } from './targetZone';

/** Speedball strike zone in play mode. */
export const SPEEDBALL_HIT_CORNERS: HitZoneCorners = [
  { x: 0.38, y: 0.14 },
  { x: 0.62, y: 0.14 },
  { x: 0.64, y: 0.38 },
  { x: 0.36, y: 0.38 },
];

export function isKnuckleOnSpeedball(
  knuckle: GlovePosition,
  zoneOffset: GlovePosition = { x: 0, y: 0 }
): boolean {
  return isKnuckleInHitZone(knuckle, SPEEDBALL_HIT_CORNERS, zoneOffset);
}

export function speedballHitZoneOutline(zoneOffset: GlovePosition = { x: 0, y: 0 }): GlovePosition[] {
  return hitZoneOutline(SPEEDBALL_HIT_CORNERS, zoneOffset);
}
