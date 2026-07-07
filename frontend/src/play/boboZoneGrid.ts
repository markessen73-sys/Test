import type { GlovePosition } from '../types/game';
import { BAG_HIT_CORNERS, isGloveTopOnPunchBag, bagHitZoneOutline } from './gloveZoneGrid';

/** Bobo uses the exact same screen-space hit zone as the heavy bag. */
export const BOBO_HIT_CORNERS = BAG_HIT_CORNERS;

export function isKnuckleOnBoboDoll(
  knuckle: GlovePosition,
  zoneOffset: GlovePosition = { x: 0, y: 0 }
): boolean {
  return isGloveTopOnPunchBag(knuckle, zoneOffset);
}

export function boboHitZoneOutline(zoneOffset: GlovePosition = { x: 0, y: 0 }): GlovePosition[] {
  return bagHitZoneOutline(zoneOffset);
}
