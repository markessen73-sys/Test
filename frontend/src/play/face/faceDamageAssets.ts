import { assetUrl } from '../../assetUrl';
import type { FaceDamageId } from './faceDamage';

/**
 * Undamaged male face used as the damage baseline.
 * Injury refs are compared to THIS image (not the live target face) so we
 * transfer the *change* onto any caricature.
 */
export const FACE_DAMAGE_BASELINE_SRC = assetUrl('/faces/test-template-face-male.png');

/** Image-normalized landmarks (top-left origin). Image-left = subject's right. */
export type DamageLandmarkId =
  | 'leftEye'
  | 'rightEye'
  | 'nose'
  | 'mouth'
  | 'chin'
  | 'leftEar'
  | 'rightEar'
  | 'forehead'
  | 'bottomLip';

export const MALE_DAMAGE_LANDMARKS: Record<DamageLandmarkId, readonly [number, number]> = {
  leftEye: [0.35, 0.34],
  rightEye: [0.65, 0.34],
  nose: [0.5, 0.45],
  mouth: [0.5, 0.6],
  chin: [0.5, 0.82],
  leftEar: [0.13, 0.42],
  rightEar: [0.87, 0.42],
  forehead: [0.5, 0.2],
  bottomLip: [0.5, 0.66],
};

/**
 * Landmarks on the current live template (`test-template-face.png` = female).
 * Measured on the actual asset — not the older male-era template map.
 */
export const TARGET_DAMAGE_LANDMARKS: Record<DamageLandmarkId, readonly [number, number]> = {
  leftEye: [0.375, 0.449],
  rightEye: [0.625, 0.449],
  nose: [0.5, 0.563],
  mouth: [0.5, 0.7],
  chin: [0.5, 0.94],
  leftEar: [0.188, 0.531],
  rightEar: [0.812, 0.531],
  forehead: [0.5, 0.25],
  bottomLip: [0.5, 0.81],
};

/** Anatomical side: subject's left = image right, subject's right = image left. */
export type FaceSide = 'left' | 'right';

/** Soft elliptical region in normalized face-image coordinates (0–1). */
export type DamageRegion = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  diffThreshold?: number;
  preferDarker?: boolean;
  preferRedder?: boolean;
  allowGrow?: boolean;
};

export type FaceDamageAsset = {
  src: string;
  /** Where this injury should sit on the live face. */
  anchor: DamageLandmarkId;
  nativeSide?: FaceSide;
  targetSide?: FaceSide;
  region: DamageRegion;
};

/**
 * Damaged versions of the male baseline face.
 * Each injury is extracted as a patch around `region`, then stamped on `anchor`.
 */
export const FACE_DAMAGE_ASSETS: Partial<Record<FaceDamageId, FaceDamageAsset>> = {
  // Subject's left ear = image right after mirror.
  cauliflowerLeftEar: {
    src: assetUrl('/faces/damage/cauliflower-ear.png'),
    anchor: 'rightEar',
    nativeSide: 'right',
    targetSide: 'left',
    region: {
      cx: 0.13,
      cy: 0.42,
      rx: 0.16,
      ry: 0.22,
      preferRedder: true,
      allowGrow: true,
      diffThreshold: 18,
    },
  },
  cauliflowerRightEar: {
    src: assetUrl('/faces/damage/cauliflower-ear.png'),
    anchor: 'leftEar',
    nativeSide: 'right',
    targetSide: 'right',
    region: {
      cx: 0.13,
      cy: 0.42,
      rx: 0.16,
      ry: 0.22,
      preferRedder: true,
      allowGrow: true,
      diffThreshold: 18,
    },
  },
  // Subject's left eye = image right.
  blackLeftEye: {
    src: assetUrl('/faces/damage/black-right-eye.png'),
    anchor: 'rightEye',
    nativeSide: 'right',
    targetSide: 'left',
    region: { cx: 0.35, cy: 0.34, rx: 0.13, ry: 0.12, preferRedder: true, diffThreshold: 24 },
  },
  // Subject's right eye = image left.
  swollenRightEye: {
    src: assetUrl('/faces/damage/swollen-left-eye.png'),
    anchor: 'leftEye',
    nativeSide: 'left',
    targetSide: 'right',
    region: { cx: 0.65, cy: 0.34, rx: 0.13, ry: 0.13, preferRedder: true, diffThreshold: 24 },
  },
  brokenNose: {
    src: assetUrl('/faces/damage/broken-nose.png'),
    anchor: 'nose',
    region: { cx: 0.5, cy: 0.45, rx: 0.12, ry: 0.14, preferRedder: true, diffThreshold: 28 },
  },
  missingTooth: {
    src: assetUrl('/faces/damage/missing-tooth.png'),
    anchor: 'mouth',
    region: {
      cx: 0.545,
      cy: 0.575,
      rx: 0.07,
      ry: 0.045,
      preferDarker: true,
      diffThreshold: 22,
    },
  },
  foreheadBandage: {
    src: assetUrl('/faces/damage/forehead-bandage.png'),
    anchor: 'forehead',
    region: { cx: 0.5, cy: 0.2, rx: 0.38, ry: 0.12, allowGrow: true, diffThreshold: 22 },
  },
  swollenBottomLip: {
    src: assetUrl('/faces/damage/swollen-lip.png'),
    anchor: 'bottomLip',
    region: {
      cx: 0.5,
      cy: 0.66,
      rx: 0.2,
      ry: 0.1,
      preferRedder: true,
      allowGrow: true,
      diffThreshold: 16,
    },
  },
};

/** Unique image URLs for damage refs + male baseline. */
export function faceDamageAssetSrcs(): string[] {
  const set = new Set<string>([FACE_DAMAGE_BASELINE_SRC]);
  for (const asset of Object.values(FACE_DAMAGE_ASSETS)) {
    if (asset) set.add(asset.src);
  }
  return [...set];
}
