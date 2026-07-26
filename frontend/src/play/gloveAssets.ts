import type { GloveId } from '../types/game';

const GLOVE_SVG: Record<GloveId, string> = {
  left: '/gloves/boxing-glove-left.svg',
  right: '/gloves/boxing-glove-right.svg',
};

/** Prefer user-provided PNG/WebP in public/gloves/, fall back to built-in SVG. */
export function gloveImageSrc(side: GloveId): string {
  return GLOVE_SVG[side];
}

export function gloveImageCandidates(side: GloveId): string[] {
  const shared = ['/gloves/boxing-glove.webp', '/gloves/boxing-glove.png'];
  const specific =
    side === 'left'
      ? ['/gloves/boxing-glove-left.webp', '/gloves/boxing-glove-left.png']
      : ['/gloves/boxing-glove-right.webp', '/gloves/boxing-glove-right.png'];
  return [...specific, ...shared, GLOVE_SVG[side]];
}
