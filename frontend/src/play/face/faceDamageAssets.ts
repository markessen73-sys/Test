import { assetUrl } from '../../assetUrl';
import type { FaceDamageId } from './faceDamage';

/**
 * Undamaged male face used as the damage baseline.
 * Injury refs are compared to THIS image (not the live target face) so we
 * transfer the *change* onto any caricature.
 */
export const FACE_DAMAGE_BASELINE_SRC = assetUrl('/faces/test-template-face-male.png');

/**
 * Landmarks on the male baseline (image-normalized, top-left origin).
 * Used to warp injury pixels onto the live template's landmarks.
 * Image-left = subject's right.
 */
export const MALE_DAMAGE_LANDMARKS = {
  leftEye: [0.35, 0.34] as const,
  rightEye: [0.65, 0.34] as const,
  nose: [0.5, 0.45] as const,
  mouth: [0.5, 0.6] as const,
  chin: [0.5, 0.82] as const,
  leftEar: [0.13, 0.42] as const,
  rightEar: [0.87, 0.42] as const,
  forehead: [0.5, 0.2] as const,
} as const;

/**
 * Landmarks on the *current* live template face (`test-template-face.png`).
 * Measured on the female test face — template-map landmarks still reflect the
 * older male layout and must not be used for damage placement.
 */
export const TARGET_DAMAGE_LANDMARKS = {
  leftEye: [0.375, 0.449] as const,
  rightEye: [0.625, 0.449] as const,
  nose: [0.5, 0.563] as const,
  mouth: [0.5, 0.7] as const,
  chin: [0.5, 0.94] as const,
  leftEar: [0.188, 0.531] as const,
  rightEar: [0.812, 0.531] as const,
  forehead: [0.5, 0.22] as const,
} as const;

/** Anatomical side: subject's left = image right, subject's right = image left. */
export type FaceSide = 'left' | 'right';

/** Soft elliptical region in normalized face-image coordinates (0–1). */
export type DamageRegion = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Min |damaged−baseline| RGB sum to count as a change. */
  diffThreshold?: number;
  /** Prefer darker deltas (missing tooth gap). */
  preferDarker?: boolean;
  /** Prefer warmer/redder or strong structural deltas (bruises, swelling). */
  preferRedder?: boolean;
  /** Allow deltas where the baseline was backdrop (grown ear / bandage edge). */
  allowGrow?: boolean;
};

export type FaceDamageAsset = {
  src: string;
  nativeSide?: FaceSide;
  targetSide?: FaceSide;
  region: DamageRegion;
};

/**
 * Damaged versions of the male baseline face.
 * Runtime transfers (damaged − baseline) onto the live target face.
 */
export const FACE_DAMAGE_ASSETS: Partial<Record<FaceDamageId, FaceDamageAsset>> = {
  cauliflowerLeftEar: {
    src: assetUrl('/faces/damage/cauliflower-ear.png'),
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
  blackLeftEye: {
    src: assetUrl('/faces/damage/black-right-eye.png'),
    nativeSide: 'right',
    targetSide: 'left',
    region: { cx: 0.35, cy: 0.34, rx: 0.13, ry: 0.12, preferRedder: true, diffThreshold: 24 },
  },
  swollenRightEye: {
    src: assetUrl('/faces/damage/swollen-left-eye.png'),
    nativeSide: 'left',
    targetSide: 'right',
    region: { cx: 0.65, cy: 0.34, rx: 0.13, ry: 0.13, preferRedder: true, diffThreshold: 24 },
  },
  brokenNose: {
    src: assetUrl('/faces/damage/broken-nose.png'),
    region: { cx: 0.5, cy: 0.45, rx: 0.12, ry: 0.14, preferRedder: true, diffThreshold: 28 },
  },
  missingTooth: {
    src: assetUrl('/faces/damage/missing-tooth.png'),
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
    region: { cx: 0.5, cy: 0.2, rx: 0.38, ry: 0.12, allowGrow: true, diffThreshold: 22 },
  },
  swollenBottomLip: {
    src: assetUrl('/faces/damage/swollen-lip.png'),
    region: {
      cx: 0.5,
      cy: 0.68,
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
