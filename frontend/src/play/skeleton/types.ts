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

/** High guard — wide stance, shoulders span ~64% of screen */
export const GUARD_LEFT: GloveTarget = { x: 0.22, y: 0.38 };
export const GUARD_RIGHT: GloveTarget = { x: 0.78, y: 0.38 };

/** Body occupies bottom ~60% of screen (y 0.36 → 1.0) */
export const BODY_SCALE = {
  headTop: 0.36,
  shoulderY: 0.46,
  chestY: 0.56,
  waistY: 0.7,
  pelvisY: 0.78,
  shortsY: 0.86,
  footY: 0.995,
  shoulderHalfWidth: 0.34,
  stanceHalfWidth: 0.11,
} as const;

export interface AnatomicalGhostMesh {
  /** Single unified outer silhouette — entire body */
  silhouette: string;
  /** Interior muscle definition strokes */
  muscleDetail: string;
  /** Soft wispy overlay paths */
  wisps: string;
}
