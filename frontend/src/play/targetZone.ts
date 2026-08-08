import type { GlovePosition } from '../types/game';

export type HitZoneCorners = readonly [GlovePosition, GlovePosition, GlovePosition, GlovePosition];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function shiftPoint(p: GlovePosition, offset: GlovePosition): GlovePosition {
  return { x: p.x + offset.x, y: p.y + offset.y };
}

/** True when a screen point lies inside a trapezoid hit zone (with optional swing offset). */
export function isKnuckleInHitZone(
  knuckle: GlovePosition,
  corners: HitZoneCorners,
  zoneOffset: GlovePosition = { x: 0, y: 0 }
): boolean {
  const shifted = corners.map((p) => shiftPoint(p, zoneOffset));
  const [tl, tr, br, bl] = shifted;
  if (knuckle.y < tl.y || knuckle.y > bl.y) return false;

  const t = (knuckle.y - tl.y) / (bl.y - tl.y);
  const leftX = lerp(tl.x, bl.x, t);
  const rightX = lerp(tr.x, br.x, t);
  return knuckle.x >= leftX && knuckle.x <= rightX;
}

export function hitZoneOutline(
  corners: HitZoneCorners,
  zoneOffset: GlovePosition = { x: 0, y: 0 }
): GlovePosition[] {
  return corners.map((p) => shiftPoint(p, zoneOffset));
}
