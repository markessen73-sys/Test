import type { GloveId, GlovePosition } from '../types/game';

/** Display size for zone glove art (matches ScreenGlove). */
export const ZONE_GLOVE_W = 130;
export const ZONE_GLOVE_H = 155;

export const CUFF_ANCHOR_X_FRAC = 0.5;
export const CUFF_ANCHOR_Y_FRAC = 0.68;

/** Fixed pink-tip position on glove image (fraction of glove box). */
export const KNUCKLE_X_FRAC = 0.515;
export const KNUCKLE_Y_FRAC = 0.05;

const BOTTOM_Y_FRAC = 1;
const BOTTOM_DIST_PX = (BOTTOM_Y_FRAC - CUFF_ANCHOR_Y_FRAC) * ZONE_GLOVE_H;

const KNUCKLE_LOCAL_DX = (KNUCKLE_X_FRAC - CUFF_ANCHOR_X_FRAC) * ZONE_GLOVE_W;
const KNUCKLE_LOCAL_DY = (KNUCKLE_Y_FRAC - CUFF_ANCHOR_Y_FRAC) * ZONE_GLOVE_H;

/**
 * Apply the same transform stack as ScreenGlove zone art:
 * rotate(deg) scale(s) [scaleX(-1) for left].
 */
export function applyGloveImageTransform(
  localDx: number,
  localDy: number,
  rotateDeg: number,
  scale: number,
  mirror: boolean
): { px: number; py: number } {
  let x = localDx;
  let y = localDy;
  if (mirror) x = -x;
  x *= scale;
  y *= scale;
  const rad = (rotateDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    px: x * cos + y * sin,
    py: -x * sin + y * cos,
  };
}

/** Pink knuckle tip in normalized screen coords (fixed on glove art). */
export function gloveKnuckleNorm(
  cuffPos: GlovePosition,
  rotateDeg: number,
  scale: number,
  screenW: number,
  screenH: number,
  side: GloveId
): GlovePosition {
  // Zone art is a right-hand photo. Left is mirrored in the view; right needs its
  // knuckle offset flipped so both hands register contact on the inner edge toward the bag.
  const localDx = side === 'right' ? -KNUCKLE_LOCAL_DX : KNUCKLE_LOCAL_DX;
  const mirror = side === 'left';
  const { px, py } = applyGloveImageTransform(localDx, KNUCKLE_LOCAL_DY, rotateDeg, scale, mirror);
  return {
    x: cuffPos.x + px / screenW,
    y: cuffPos.y + py / screenH,
  };
}

/** Bottom of glove in normalized screen coords (vapour trail anchor). */
export function gloveBottomNorm(
  cuffPos: GlovePosition,
  rotateDeg: number,
  scale: number,
  screenW: number,
  screenH: number,
  side: GloveId
): GlovePosition {
  const mirror = side === 'left';
  const { px, py } = applyGloveImageTransform(0, BOTTOM_DIST_PX, rotateDeg, scale, mirror);
  return {
    x: cuffPos.x + px / screenW,
    y: cuffPos.y + py / screenH,
  };
}

/** Half glove width as normalized screen fraction. */
export function halfGloveWidthNorm(screenW: number): number {
  return ZONE_GLOVE_W / 2 / screenW;
}
