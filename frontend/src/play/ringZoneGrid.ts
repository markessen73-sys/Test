import type { GlovePosition } from '../types/game';
import { hitZoneOutline, isKnuckleInHitZone, type HitZoneCorners } from './targetZone';

/**
 * Sparring partner torso + head hit zone in ring play mode (screen-normalized).
 * Shared across all body styles: every pack is feet-aligned at the same sprite
 * scale, so head/torso land in this fixed camera region. Neon glow / arms outside
 * the silhouette do not expand the zone.
 */
export const RING_HIT_CORNERS: HitZoneCorners = [
  { x: 0.24, y: 0.0 },
  { x: 0.76, y: 0.0 },
  // Bottom edge covers waist across slim→heavy silhouettes (was 0.42).
  { x: 0.76, y: 0.48 },
  { x: 0.24, y: 0.48 },
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
