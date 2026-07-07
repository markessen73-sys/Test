import type { GlovePosition } from '../types/game';
import { hitZoneOutline, isKnuckleInHitZone, type HitZoneCorners } from './targetZone';

/** Speedball strike zone — upper screen (ball sits above fixed camera aim). */
export const SPEEDBALL_HIT_CORNERS: HitZoneCorners = [
  { x: 0.36, y: -0.04 },
  { x: 0.64, y: -0.04 },
  { x: 0.66, y: 0.16 },
  { x: 0.34, y: 0.16 },
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
