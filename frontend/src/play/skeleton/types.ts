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

/** High guard — wide heavyweight stance */
export const GUARD_LEFT: GloveTarget = { x: 0.2, y: 0.36 };
export const GUARD_RIGHT: GloveTarget = { x: 0.8, y: 0.36 };

/** Shoulders ≈ 2.5 head-widths across (head width ~0.11) */
export const BODY_SCALE = {
  headTop: 0.34,
  shoulderY: 0.44,
  chestY: 0.54,
  waistY: 0.68,
  pelvisY: 0.76,
  shortsY: 0.84,
  footY: 0.995,
  shoulderHalfWidth: 0.138,
  stanceHalfWidth: 0.1,
} as const;

export interface AnatomicalGhostMesh {
  /** Single unified outer silhouette — entire body */
  silhouette: string;
  /** Interior muscle definition strokes */
  muscleDetail: string;
  /** Soft wispy overlay paths */
  wisps: string;
}
