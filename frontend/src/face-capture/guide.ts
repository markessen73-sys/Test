import { assetUrl } from '../assetUrl';

export type NormRect = readonly [number, number, number, number];

/** Match faces/guide/face-guide.json — yellow wireframe from default boxer guide art. */
export const FACE_GUIDE_SIZE = 1024;

export const FACE_GUIDE_OVAL: NormRect = [0.0938, 0.0586, 0.9023, 0.9258];

export const FACE_GUIDE_OUTLINE_SRC = assetUrl('faces/guide/face-guide-outline.png');
export const FACE_GUIDE_MASK_SRC = assetUrl('faces/guide/face-guide-mask.png');
