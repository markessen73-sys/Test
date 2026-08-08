/**
 * Knockout face painter: sad/KO cutout + orbiting cartoon stars.
 */
import { drawFullFaceOnCanvas } from './composeFaceTexture';
import { drawKoStars } from '../../face-capture/koStars';

export function paintKnockoutFace(
  ctx: CanvasRenderingContext2D,
  canvasSize: number,
  koImg: HTMLImageElement,
  timeMs: number,
) {
  drawFullFaceOnCanvas(ctx, koImg, canvasSize, canvasSize);
  drawKoStars(ctx, canvasSize, canvasSize, timeMs);
}
