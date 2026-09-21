export interface Vec2 {
  x: number;
  y: number;
}

export interface ArmChain {
  shoulder: Vec2;
  elbow: Vec2;
  wrist: Vec2;
  hand: Vec2;
  atMaxReach: boolean;
}

export interface LegChain {
  hip: Vec2;
  knee: Vec2;
  ankle: Vec2;
  foot: Vec2;
}

export interface BoxerSkeletonPose {
  time: number;
  pelvis: Vec2;
  chest: Vec2;
  neck: Vec2;
  head: Vec2;
  spineTwist: number;
  hipRotation: number;
  chestRotation: number;
  headRotation: number;
  breath: number;
  punchDrive: number;
  leftArm: ArmChain;
  rightArm: ArmChain;
  leftLeg: LegChain;
  rightLeg: LegChain;
}

export interface GloveTransform {
  rotate: number;
  scale: number;
  scaleX: number;
  skewX: number;
  originY: string;
}

export type GloveId = 'left' | 'right';

export interface GloveTarget {
  x: number;
  y: number;
}

/** Viewport: boxer occupies bottom ~60% (y 0.40–1.0), scaled ~30% larger */
export const BODY_SCALE = {
  viewTop: 0.4,
  headTop: 0.4,
  shoulderY: 0.5,
  chestY: 0.6,
  waistY: 0.74,
  pelvisY: 0.82,
  shortsY: 0.88,
  footY: 0.995,
  /** Shoulders ≈ 2.5 head-widths across */
  shoulderHalfWidth: 0.179,
  stanceHalfWidth: 0.13,
  muscleScale: 1.3,
  forwardLean: 0.016,
} as const;

export const HEAD_WIDTH = 0.11 * BODY_SCALE.muscleScale;

/** Classic high guard — elbows tucked, gloves protecting head */
export const GUARD_LEFT: GloveTarget = { x: 0.24, y: 0.42 };
export const GUARD_RIGHT: GloveTarget = { x: 0.76, y: 0.42 };

export interface AnatomicalGhostMesh {
  silhouette: string;
  muscleDetail: string;
  wisps: string;
}
