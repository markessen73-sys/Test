import type { FaceDamageId } from './faceDamage';

/** Anatomical side: subject's left = image right, subject's right = image left. */
export type FaceSide = 'left' | 'right';

export type FaceDamageAsset = {
  src: string;
  /**
   * Anatomical side where the damage appears in the reference PNG.
   * Omit (or set equal to targetSide) for centered features like the nose.
   */
  nativeSide?: FaceSide;
  /** Anatomical side this damage ID should appear on. */
  targetSide?: FaceSide;
};

/**
 * Pre-rendered damaged faces from the user.
 * Shared ear/eye assets are mirrored when nativeSide !== targetSide.
 */
export const FACE_DAMAGE_ASSETS: Partial<Record<FaceDamageId, FaceDamageAsset>> = {
  // One ear reference (damage on subject's right / viewer's left) — mirrored for left.
  cauliflowerLeftEar: {
    src: '/faces/damage/cauliflower-ear.png',
    nativeSide: 'right',
    targetSide: 'left',
  },
  cauliflowerRightEar: {
    src: '/faces/damage/cauliflower-ear.png',
    nativeSide: 'right',
    targetSide: 'right',
  },
  // Black-eye reference (on subject's right / viewer's left) — mirrored for left.
  blackLeftEye: {
    src: '/faces/damage/black-right-eye.png',
    nativeSide: 'right',
    targetSide: 'left',
  },
  // Swollen-shut eye reference (on subject's left / viewer's right) — mirrored for right.
  swollenRightEye: {
    src: '/faces/damage/swollen-left-eye.png',
    nativeSide: 'left',
    targetSide: 'right',
  },
  // Broken nose — centered, no mirroring.
  brokenNose: {
    src: '/faces/damage/broken-nose.png',
  },
  // Missing tooth — centered mouth gap, no mirroring.
  missingTooth: {
    src: '/faces/damage/missing-tooth.png',
  },
};

/** Unique image URLs needed for reference compositing. */
export function faceDamageAssetSrcs(): string[] {
  const set = new Set<string>();
  for (const asset of Object.values(FACE_DAMAGE_ASSETS)) {
    if (asset) set.add(asset.src);
  }
  return [...set];
}
