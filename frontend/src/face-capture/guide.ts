import { assetUrl } from '../assetUrl';

export type NormRect = readonly [number, number, number, number];

/** Match faces/guide/face-guide.json — proportions from the default boxer template. */
export const FACE_GUIDE_SIZE = 1024;

export const FACE_GUIDE_OVAL: NormRect = [0.1436, 0.0947, 0.8545, 0.8496];

export const FACE_GUIDE_OUTLINE_SRC = assetUrl('faces/guide/face-guide-outline.png');
export const FACE_GUIDE_MASK_SRC = assetUrl('faces/guide/face-guide-mask.png');
