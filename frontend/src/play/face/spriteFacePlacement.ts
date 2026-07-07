import type { NormRect } from './types';

export type SpriteRectAnchor = 'center' | 'top-right';

/** Map a top-left image-normalized rect onto a sprite plane (metres, origin at plane centre). */
export function spriteNormRectToLocal(
  rect: NormRect,
  spriteWidth: number,
  spriteHeight: number,
  options?: { scale?: number; anchor?: SpriteRectAnchor }
): { center: [number, number, number]; size: [number, number] } {
  const [x0, y0, x1, y1] = rect;
  let cx = ((x0 + x1) / 2 - 0.5) * spriteWidth;
  let cy = (0.5 - (y0 + y1) / 2) * spriteHeight;
  let fw = (x1 - x0) * spriteWidth;
  let fh = (y1 - y0) * spriteHeight;

  const scale = options?.scale ?? 1;
  if (scale !== 1) {
    const anchor = options?.anchor ?? 'center';
    if (anchor === 'top-right') {
      const topRightX = cx + fw / 2;
      const topRightY = cy + fh / 2;
      fw *= scale;
      fh *= scale;
      cx = topRightX - fw / 2;
      cy = topRightY - fh / 2;
    } else {
      fw *= scale;
      fh *= scale;
    }
  }

  return { center: [cx, cy, 0.03], size: [fw, fh] };
}
