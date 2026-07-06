import type { GloveId, GlovePosition } from '../types/game';

/** Display size for zone glove art (matches ScreenGlove). */
export const ZONE_GLOVE_W = 130;
export const ZONE_GLOVE_H = 155;

export const CUFF_ANCHOR_X_FRAC = 0.5;
export const CUFF_ANCHOR_Y_FRAC = 0.68;

const BOTTOM_DIST_PX = ZONE_GLOVE_H * (1 - CUFF_ANCHOR_Y_FRAC);

/**
 * Pink-tip contact point offset from cuff (display px), per zone sprite.
 * Calibrated from top red cluster on zone art + user pink markup on
 * 57a20c7f-157d-4457-bfdc-4ad5b25a8732.png.
 */
const KNUCKLE_OFFSET_PX: Record<string, { dx: number; dy: number }> = {
  'zone-r0-c1': { dx: 2.1, dy: -98.2 },
  'zone-r0-c2': { dx: 1.9, dy: -97.9 },
  'zone-r0-c3': { dx: 22.2, dy: -96.1 },
  'zone-r1-c1': { dx: 2.3, dy: -98.2 },
  'zone-r1-c2': { dx: 21.5, dy: -96.8 },
  'zone-r1-c3': { dx: 22.1, dy: -96.5 },
  'zone-r2-c1': { dx: 10.6, dy: -93.1 },
  'zone-r2-c2': { dx: 9.9, dy: -93.5 },
  'zone-r2-c3': { dx: 22.2, dy: -96.4 },
  'zone-r3-c1': { dx: 10.9, dy: -93.1 },
  'zone-r3-c2': { dx: 9.5, dy: -94.6 },
  'zone-r3-c3': { dx: 21.6, dy: -96.3 },
};

const DEFAULT_KNUCKLE_OFFSET = { dx: 10.0, dy: -96.0 };

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

/** Pink knuckle tip in normalized screen coords. */
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
