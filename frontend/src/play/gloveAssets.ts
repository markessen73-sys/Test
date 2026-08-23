import { assetUrl } from '../assetUrl';
import type { GloveId } from '../types/game';

const GLOVE_SVG: Record<GloveId, string> = {
  left: assetUrl('/gloves/boxing-glove-left.svg'),
  right: assetUrl('/gloves/boxing-glove-right.svg'),
};

/** Prefer user-provided PNG/WebP in public/gloves/, fall back to built-in SVG. */
export function gloveImageSrc(side: GloveId): string {
  return GLOVE_SVG[side];
}

export function gloveImageCandidates(side: GloveId): string[] {
  const shared = [assetUrl('/gloves/boxing-glove.webp'), assetUrl('/gloves/boxing-glove.png')];
  const specific =
    side === 'left'
      ? [assetUrl('/gloves/boxing-glove-left.webp'), assetUrl('/gloves/boxing-glove-left.png')]
      : [assetUrl('/gloves/boxing-glove-right.webp'), assetUrl('/gloves/boxing-glove-right.png')];
  return [...specific, ...shared, GLOVE_SVG[side]];
}
