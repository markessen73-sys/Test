import type { NormRect } from './types';

export type SpriteRectAnchor = 'center' | 'top-right' | 'bottom-left';

export interface SpritePlacement {
  center: [number, number, number];
  size: [number, number];
}

/** Map a top-left image-normalized rect onto a sprite plane (metres, origin at plane centre). */
export function spriteNormRectToLocal(
  rect: NormRect,
  spriteWidth: number,
  spriteHeight: number,
  options?: { scale?: number; anchor?: SpriteRectAnchor }
): SpritePlacement {
  const [x0, y0, x1, y1] = rect;
  let cx = ((x0 + x1) / 2 - 0.5) * spriteWidth;
  let cy = (0.5 - (y0 + y1) / 2) * spriteHeight;
  let fw = (x1 - x0) * spriteWidth;
  let fh = (y1 - y0) * spriteHeight;

  const scale = options?.scale ?? 1;
  if (scale !== 1) {
    return scalePlacement({ center: [cx, cy, 0.03], size: [fw, fh] }, scale, options?.anchor ?? 'center');
  }

  return { center: [cx, cy, 0.03], size: [fw, fh] };
}

/** Scale a placement while pinning a corner (growth goes toward opposite directions). */
export function scalePlacement(
  placement: SpritePlacement,
  scale: number,
  anchor: SpriteRectAnchor = 'center'
): SpritePlacement {
  if (scale === 1) return placement;

  const [cx, cy, cz] = placement.center;
  const [fw, fh] = placement.size;

  if (anchor === 'center') {
    return { center: [cx, cy, cz], size: [fw * scale, fh * scale] };
  }

  if (anchor === 'top-right') {
    const topRightX = cx + fw / 2;
    const topRightY = cy + fh / 2;
    const newFw = fw * scale;
    const newFh = fh * scale;
    return {
      center: [topRightX - newFw / 2, topRightY - newFh / 2, cz],
      size: [newFw, newFh],
    };
  }

  // bottom-left — extra size goes right and up
  const bottomLeftX = cx - fw / 2;
  const bottomLeftY = cy - fh / 2;
  const newFw = fw * scale;
  const newFh = fh * scale;
  return {
    center: [bottomLeftX + newFw / 2, bottomLeftY + newFh / 2, cz],
    size: [newFw, newFh],
  };
}
