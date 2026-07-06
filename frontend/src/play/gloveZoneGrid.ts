import type { GlovePosition } from '../types/game';

/** Play area split 4×4 below the heavy bag top. */
export const GRID_COLS = 4;
export const GRID_ROWS = 4;

/**
 * Normalized screen Y of heavy bag top (from 3D camera projection).
 * Grid row 0 starts here; gloves cannot go above.
 */
export const GRID_TOP_Y = 0.23;

export const GRID_BOTTOM_Y = 1;

export const PLAYABLE_HEIGHT = GRID_BOTTOM_Y - GRID_TOP_Y;

/** Screen midpoint — touch left half controls left glove, right half controls right. */
export const SCREEN_MID_X = 0.5;

/** Right glove centre stays in right half (columns 2–3). */
export const RIGHT_GLOVE_MIN_X = SCREEN_MID_X;

/** Left glove centre stays in left half (columns 0–1). */
export const LEFT_GLOVE_MAX_X = SCREEN_MID_X;

export interface GridCell {
  row: number;
  col: number;
}

/** Map screen position to grid cell within playable area (bag top → bottom). */
export function positionToGridCell(pos: GlovePosition): GridCell {
  const col = Math.min(GRID_COLS - 1, Math.max(0, Math.floor(pos.x * GRID_COLS)));
  const relY = (pos.y - GRID_TOP_Y) / PLAYABLE_HEIGHT;
  const row = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor(relY * GRID_ROWS)));
  return { row, col };
}

/** Zone art covers screen columns 1–3 (remaining 12 squares). */
export function rightGloveZoneSrc(pos: GlovePosition): string {
  const { row, col } = positionToGridCell(pos);
  const zoneCol = Math.max(1, Math.min(3, col));
  return `/gloves/right-zones/zone-r${row}-c${zoneCol}.png`;
}

/** Left glove reuses right zone art, mirrored horizontally (col 0→c3, col 2→c1). */
export function leftGloveZoneSrc(pos: GlovePosition): string {
  const { row, col } = positionToGridCell(pos);
  const zoneCol = Math.max(1, Math.min(3, 3 - col));
  return `/gloves/right-zones/zone-r${row}-c${zoneCol}.png`;
}

function clampY(y: number): number {
  return Math.max(GRID_TOP_Y, Math.min(GRID_BOTTOM_Y, y));
}

export function clampRightGlovePosition(pos: GlovePosition): GlovePosition {
  return {
    x: Math.max(RIGHT_GLOVE_MIN_X, Math.min(1, pos.x)),
    y: clampY(pos.y),
  };
}

export function clampLeftGlovePosition(pos: GlovePosition): GlovePosition {
  return {
    x: Math.max(0, Math.min(LEFT_GLOVE_MAX_X, pos.x)),
    y: clampY(pos.y),
  };
}

export function gloveFromScreenX(x: number): 'left' | 'right' {
  return x < SCREEN_MID_X ? 'left' : 'right';
}

export function clampGlovePosition(side: 'left' | 'right', pos: GlovePosition): GlovePosition {
  return side === 'right' ? clampRightGlovePosition(pos) : clampLeftGlovePosition(pos);
}

/** Default elastic rest point — centre of playable grid. */
export function defaultAnchorY(): number {
  return GRID_TOP_Y + PLAYABLE_HEIGHT * 0.5;
}

/**
 * Tight screen-normalized zone over the visible heavy bag face.
 * Glove knuckle (top) must land inside this box to score a hit.
 */
export const BAG_HIT_ZONE = {
  minX: 0.34,
  maxX: 0.66,
  minY: GRID_TOP_Y,
  maxY: 0.34,
} as const;

/** True when the glove top/knuckle point overlaps the bag on screen. */
export function isGloveTopOnPunchBag(top: GlovePosition): boolean {
  return (
    top.x >= BAG_HIT_ZONE.minX &&
    top.x <= BAG_HIT_ZONE.maxX &&
    top.y >= BAG_HIT_ZONE.minY &&
    top.y <= BAG_HIT_ZONE.maxY
  );
}
