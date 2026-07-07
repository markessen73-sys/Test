import type { NormRect } from './types';

/** Map a top-left image-normalized rect onto a sprite plane (metres, origin at plane centre). */
export function spriteNormRectToLocal(
  rect: NormRect,
  spriteWidth: number,
  spriteHeight: number
): { center: [number, number, number]; size: [number, number] } {
  const [x0, y0, x1, y1] = rect;
  const cx = ((x0 + x1) / 2 - 0.5) * spriteWidth;
  const cy = (0.5 - (y0 + y1) / 2) * spriteHeight;
  const fw = (x1 - x0) * spriteWidth;
  const fh = (y1 - y0) * spriteHeight;
  return { center: [cx, cy, 0.03], size: [fw, fh] };
}
