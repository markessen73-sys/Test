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
 * Landmarks on the current live template (`test-template-face.png` = flat 2D caricature).
 * Landmarks for the flat 2D playable face — procedural damage stamps use these anchors.
 */
export const TARGET_DAMAGE_LANDMARKS: Record<DamageLandmarkId, readonly [number, number]> = {
  leftEye: [0.35, 0.36],
  rightEye: [0.65, 0.36],
  nose: [0.5, 0.48],
  /** Upper teeth / gap — slightly above mouth mid for missing-tooth stamp. */
  mouth: [0.5, 0.64],
  chin: [0.5, 0.88],
  leftEar: [0.14, 0.45],
  rightEar: [0.86, 0.45],
  /** Mid forehead below hairline — where the bandage wrap sits. */
  forehead: [0.5, 0.22],
  bottomLip: [0.5, 0.72],
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
  /** Prefer lighter deltas (white bandage cloth). */
  preferLighter?: boolean;
  allowGrow?: boolean;
};

export type FaceDamageAsset = {
  src: string;
  /** Where this injury should sit on the live face. */
  anchor: DamageLandmarkId;
  nativeSide?: FaceSide;
  targetSide?: FaceSide;
  region: DamageRegion;
  /** Extra stamp size vs inter-ocular scale (ears need to read bigger). */
  patchScale?: number;
  /** Amplify RGB delta when applying (missing tooth gap). */
  strength?: number;
  /** 0–1 blend toward absolute damaged color (bandage cloth). */
  absoluteBlend?: number;
  /** Fraction of strongest region candidates to keep. */
  keepFrac?: number;
};

/**
 * Photo-ref injury patches (legacy). HUD damage now uses simple procedural
 * bruises/cuts — this map is intentionally empty.
 */
export const FACE_DAMAGE_ASSETS: Partial<Record<FaceDamageId, FaceDamageAsset>> = {};

/** Unique image URLs for damage refs + male baseline. */
export function faceDamageAssetSrcs(): string[] {
  const set = new Set<string>([FACE_DAMAGE_BASELINE_SRC]);
  for (const asset of Object.values(FACE_DAMAGE_ASSETS)) {
    if (asset) set.add(asset.src);
  }
  return [...set];
}
