import { assetUrl } from '../assetUrl';

export type NormRect = readonly [number, number, number, number];

/** Match faces/guide/face-guide.json — yellow head outline (no ears/eyes/nose). */
export const FACE_GUIDE_SIZE = 1024;

export const FACE_GUIDE_OVAL: NormRect = [0.2402, 0.0586, 0.7617, 0.9258];

export const FACE_GUIDE_OUTLINE_SRC = assetUrl('faces/guide/face-guide-outline.png');
export const FACE_GUIDE_MASK_SRC = assetUrl('faces/guide/face-guide-mask.png');
