import { assetUrl } from '../../assetUrl';
import type { FaceDamageId } from './faceDamage';

/** Anatomical side: subject's left = image right, subject's right = image left. */
export type FaceSide = 'left' | 'right';

/** Soft elliptical region in normalized face-image coordinates (0–1). */
export type DamageRegion = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Min RGB sum delta to count as a change (default 24). */
  diffThreshold?: number;
  /**
   * Only keep pixels darker than the base — for missing-tooth gaps
   * so the rest of the smile is not replaced.
   */
  preferDarker?: boolean;
  /**
   * Prefer warmer/redder pixels (bruises, swollen tissue) but still allow
   * strong structural diffs inside the region.
   */
  preferRedder?: boolean;
  /**
   * Allow painting where the base is backdrop (black) — needed when the
   * injury grows beyond the original feature (cauliflower ear, puffy lip).
   */
  allowGrow?: boolean;
};

export type FaceDamageAsset = {
  src: string;
  /** Anatomical side where the damage appears in the reference PNG. */
  nativeSide?: FaceSide;
  /** Anatomical side this damage ID should appear on. */
  targetSide?: FaceSide;
  /** Localized region — only this area is sampled from the reference. */
  region: DamageRegion;
};

/**
 * Pre-rendered damaged faces from the user.
 * Only the localized injury delta is composited onto the live face
 * so the same effects can transfer to other caricatures.
 */
export const FACE_DAMAGE_ASSETS: Partial<Record<FaceDamageId, FaceDamageAsset>> = {
  // Ear damage on subject's right (viewer's left) — mirrored for left.
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
  // Black eye on subject's right (viewer's left) — mirrored for left.
  blackLeftEye: {
    src: assetUrl('/faces/damage/black-right-eye.png'),
    nativeSide: 'right',
    targetSide: 'left',
    region: { cx: 0.35, cy: 0.34, rx: 0.13, ry: 0.12, preferRedder: true, diffThreshold: 24 },
  },
  // Swollen eye on subject's left (viewer's right) — mirrored for right.
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
  // Upper-teeth gap only — do not replace the whole mouth.
  missingTooth: {
    src: assetUrl('/faces/damage/missing-tooth.png'),
    region: {
      cx: 0.545,
      cy: 0.575,
      rx: 0.055,
      ry: 0.035,
      preferDarker: true,
      diffThreshold: 40,
    },
  },
  foreheadBandage: {
    src: assetUrl('/faces/damage/forehead-bandage.png'),
    region: { cx: 0.5, cy: 0.2, rx: 0.38, ry: 0.12, allowGrow: true, diffThreshold: 22 },
  },
  // Lower lip swell — may grow slightly beyond original lip.
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

/** Unique image URLs needed for reference compositing. */
export function faceDamageAssetSrcs(): string[] {
  const set = new Set<string>();
  for (const asset of Object.values(FACE_DAMAGE_ASSETS)) {
    if (asset) set.add(asset.src);
  }
  return [...set];
}
