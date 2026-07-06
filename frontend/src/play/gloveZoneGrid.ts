import type { GlovePosition } from '../types/game';
import { halfGloveWidthNorm } from './gloveGeometry';
import { hitZoneOutline, isKnuckleInHitZone, type HitZoneCorners } from './targetZone';

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

const REF_SCREEN_W = 1080;
const halfGloveNorm = halfGloveWidthNorm(REF_SCREEN_W);

/**
 * Cuff limits — extend past screen centre so the knuckle (offset inward on the art)
 * can reach the bag hit zone symmetrically for both hands.
 */
export const LEFT_GLOVE_MAX_X = SCREEN_MID_X + halfGloveNorm * 0.9;
export const RIGHT_GLOVE_MIN_X = SCREEN_MID_X - halfGloveNorm * 0.9;

/** Looser separation when dragging a glove toward the bag past the other idle hand. */
export const GLOVE_BAG_REACH_SEPARATION = 0.085;

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
 * Heavy bag hit zone traced from user annotation
 * (57a20c7f-157d-4457-bfdc-4ad5b25a8732.png — green outline).
 * Trapezoid corners: top-left → top-right → bottom-right → bottom-left.
 */
export const BAG_HIT_CORNERS: HitZoneCorners = [
  { x: 0.305, y: 0.18 }, // top left
  { x: 0.685, y: 0.18 }, // top right
  { x: 0.695, y: 0.46 }, // bottom right
  { x: 0.295, y: 0.46 }, // bottom left
];

/** True when the pink knuckle tip lies inside the green bag outline. */
export function isGloveTopOnPunchBag(
  knuckle: GlovePosition,
  zoneOffset: GlovePosition = { x: 0, y: 0 }
): boolean {
  return isKnuckleInHitZone(knuckle, BAG_HIT_CORNERS, zoneOffset);
}

/** Normalized polygon tracing the bag hit outline (for debug overlay). */
export function bagHitZoneOutline(zoneOffset: GlovePosition = { x: 0, y: 0 }): GlovePosition[] {
  return hitZoneOutline(BAG_HIT_CORNERS, zoneOffset);
}
