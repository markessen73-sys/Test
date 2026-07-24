import { assetUrl } from '../../assetUrl';
import type { FaceDamageId } from './faceDamage';

/**
 * Undamaged male face used as the damage baseline.
 * Injury refs are compared to THIS image (not the live target face) so we
 * transfer the *change* onto any caricature.
 */
export const FACE_DAMAGE_BASELINE_SRC = assetUrl('/faces/test-template-face-male.png');

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
      cy: 0.635,
      rx: 0.18,
      ry: 0.08,
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
