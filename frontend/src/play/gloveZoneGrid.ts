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

/** Right glove centre cannot enter column 0 (x < 0.25). */
export const RIGHT_GLOVE_MIN_X = 0.25;

/** Left glove centre stays in columns 0–2. */
export const LEFT_GLOVE_MAX_X = 0.75;

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

export function clampGlovePosition(side: 'left' | 'right', pos: GlovePosition): GlovePosition {
  return side === 'right' ? clampRightGlovePosition(pos) : clampLeftGlovePosition(pos);
}

/** Default elastic rest point — centre of playable grid. */
export function defaultAnchorY(): number {
  return GRID_TOP_Y + PLAYABLE_HEIGHT * 0.5;
}
