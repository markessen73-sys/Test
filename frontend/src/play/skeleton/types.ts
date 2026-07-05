export interface Vec2 {
  x: number;
  y: number;
}

export interface ArmChain {
  shoulder: Vec2;
  elbow: Vec2;
  hand: Vec2;
  atMaxReach: boolean;
}

export interface BoxerSkeletonPose {
  time: number;
  pelvis: Vec2;
  chest: Vec2;
  neck: Vec2;
  head: Vec2;
  leftFoot: Vec2;
  rightFoot: Vec2;
  leftHip: Vec2;
  rightHip: Vec2;
  spineTwist: number;
  hipRotation: number;
  chestRotation: number;
  headRotation: number;
  breath: number;
  leftArm: ArmChain;
  rightArm: ArmChain;
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

export const GUARD_LEFT: GloveTarget = { x: 0.31, y: 0.44 };
export const GUARD_RIGHT: GloveTarget = { x: 0.69, y: 0.44 };
