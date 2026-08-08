import type { GlovePosition } from '../types/game';
import { BAG_HIT_CORNERS, isGloveTopOnPunchBag, bagHitZoneOutline } from './gloveZoneGrid';

/** Bobo uses the exact same screen-space hit zone as the heavy bag. */
export const BOBO_HIT_CORNERS = BAG_HIT_CORNERS;

/**
 * Projected head/face bounds for BOBO_PLAY_CAMERA. This covers the visible clown
 * face that sits slightly above the inherited heavy-bag body zone.
 */
const BOBO_HEAD_HIT_CENTER: GlovePosition = { x: 0.5, y: 0.25 };
const BOBO_HEAD_HIT_RADIUS_X = 0.14;
const BOBO_HEAD_HIT_RADIUS_Y = 0.13;

function isPointOnBoboHead(point: GlovePosition, zoneOffset: GlovePosition): boolean {
  const dx = (point.x - (BOBO_HEAD_HIT_CENTER.x + zoneOffset.x)) / BOBO_HEAD_HIT_RADIUS_X;
  const dy = (point.y - (BOBO_HEAD_HIT_CENTER.y + zoneOffset.y)) / BOBO_HEAD_HIT_RADIUS_Y;
  return dx * dx + dy * dy <= 1;
}

function isPointOnBoboDoll(point: GlovePosition, zoneOffset: GlovePosition): boolean {
  return isGloveTopOnPunchBag(point, zoneOffset) || isPointOnBoboHead(point, zoneOffset);
}

export function isKnuckleOnBoboDoll(
  knuckle: GlovePosition,
  zoneOffset: GlovePosition = { x: 0, y: 0 },
  contact?: { cuff: GlovePosition }
): boolean {
  return isPointOnBoboDoll(knuckle, zoneOffset) || Boolean(contact && isPointOnBoboDoll(contact.cuff, zoneOffset));
}

export function boboHitZoneOutline(zoneOffset: GlovePosition = { x: 0, y: 0 }): GlovePosition[] {
  return bagHitZoneOutline(zoneOffset);
}
