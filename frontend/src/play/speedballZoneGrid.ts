import type { GlovePosition } from '../types/game';
import { isKnuckleInHitZone, type HitZoneCorners } from './targetZone';

export function isKnuckleOnSpeedball(knuckle: GlovePosition, corners: HitZoneCorners): boolean {
  return isKnuckleInHitZone(knuckle, corners);
}

export function speedballHitZoneOutline(corners: HitZoneCorners): GlovePosition[] {
  return [...corners];
}
