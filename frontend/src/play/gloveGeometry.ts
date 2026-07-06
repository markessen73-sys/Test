import type { GloveId, GlovePosition } from '../types/game';

/** Display size for zone glove art (matches ScreenGlove). */
export const ZONE_GLOVE_W = 130;
export const ZONE_GLOVE_H = 155;

export const CUFF_ANCHOR_X_FRAC = 0.5;
export const CUFF_ANCHOR_Y_FRAC = 0.68;

const BOTTOM_DIST_PX = ZONE_GLOVE_H * (1 - CUFF_ANCHOR_Y_FRAC);

/** Knuckle (highest red point) offset from cuff in display pixels, per zone sprite. */
const KNUCKLE_OFFSET_PX: Record<string, { dx: number; dy: number }> = {
  'zone-r0-c1': { dx: -4.5, dy: -105.4 },
  'zone-r0-c2': { dx: 3.4, dy: -105.4 },
  'zone-r0-c3': { dx: 16.6, dy: -103.2 },
  'zone-r1-c1': { dx: -3.0, dy: -105.4 },
  'zone-r1-c2': { dx: 15.7, dy: -103.6 },
  'zone-r1-c3': { dx: 17.9, dy: -103.6 },
  'zone-r2-c1': { dx: -7.8, dy: -97.6 },
  'zone-r2-c2': { dx: -8.6, dy: -98.0 },
  'zone-r2-c3': { dx: 18.9, dy: -103.6 },
  'zone-r3-c1': { dx: -7.6, dy: -97.6 },
  'zone-r3-c2': { dx: -9.6, dy: -99.1 },
  'zone-r3-c3': { dx: 16.1, dy: -103.6 },
};

const DEFAULT_KNUCKLE_OFFSET = { dx: 4.0, dy: -102.2 };

function zoneKeyFromSrc(zoneSrc?: string): string | null {
  if (!zoneSrc) return null;
  const name = zoneSrc.split('/').pop() ?? '';
  return name.replace(/\.png$/, '');
}

function knuckleOffsetForZone(zoneSrc: string | undefined, side: GloveId): { dx: number; dy: number } {
  const key = zoneKeyFromSrc(zoneSrc);
  const base = (key && KNUCKLE_OFFSET_PX[key]) || DEFAULT_KNUCKLE_OFFSET;
  if (side === 'left') return { dx: -base.dx, dy: base.dy };
  return base;
}

function rotateLocalOffset(localDx: number, localDy: number, aimDeg: number) {
  const rad = (aimDeg * Math.PI) / 180;
  return {
    px: localDx * Math.cos(rad) + localDy * Math.sin(rad),
    py: -localDx * Math.sin(rad) + localDy * Math.cos(rad),
  };
}

/** Highest red knuckle point in normalized screen coords. */
export function gloveKnuckleNorm(
  cuffPos: GlovePosition,
  aimDeg: number,
  screenW: number,
  screenH: number,
  side: GloveId,
  zoneSrc?: string
): GlovePosition {
  const { dx, dy } = knuckleOffsetForZone(zoneSrc, side);
  const { px, py } = rotateLocalOffset(dx, dy, aimDeg);
  return {
    x: cuffPos.x + px / screenW,
    y: cuffPos.y + py / screenH,
  };
}

/** Bottom of glove in normalized screen coords (vapour trail anchor). */
export function gloveBottomNorm(
  cuffPos: GlovePosition,
  aimDeg: number,
  screenW: number,
  screenH: number
): GlovePosition {
  const { px, py } = rotateLocalOffset(0, BOTTOM_DIST_PX, aimDeg);
  return {
    x: cuffPos.x + px / screenW,
    y: cuffPos.y + py / screenH,
  };
}
