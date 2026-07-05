import type { ArmChain, BoxerSkeletonPose, GloveTarget, GloveTransform, Vec2 } from './types';
import { GUARD_LEFT, GUARD_RIGHT } from './types';

export const UPPER_ARM_LEN = 0.105;
export const FOREARM_LEN = 0.1;
export const MAX_ARM_REACH = UPPER_ARM_LEN + FOREARM_LEN - 0.005;
export const MIN_ARM_REACH = Math.abs(UPPER_ARM_LEN - FOREARM_LEN) + 0.01;

const SHOULDER_WIDTH = 0.135;
const PELVIS_Y = 0.88;
const CHEST_Y = 0.74;
const NECK_Y = 0.62;
const HEAD_Y = 0.52;
const STANCE_WIDTH = 0.09;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeAngle(a: number) {
  let v = a;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return v;
}

function constrainHandFromTorso(hand: Vec2, chest: Vec2): Vec2 {
  const cx = chest.x;
  const cy = chest.y + 0.04;
  const rx = 0.11;
  const ry = 0.14;
  const dx = hand.x - cx;
  const dy = hand.y - cy;
  const norm = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  if (norm >= 1) return hand;
  const angle = Math.atan2(dy, dx);
  return { x: cx + Math.cos(angle) * rx * 1.02, y: cy + Math.sin(angle) * ry * 1.02 };
}

export function solveArmIK(
  shoulder: Vec2,
  target: Vec2,
  upperLen: number,
  foreLen: number,
  bendSign: 1 | -1
): ArmChain {
  let hand = target;
  const dx = hand.x - shoulder.x;
  const dy = hand.y - shoulder.y;
  let d = Math.hypot(dx, dy);
  let atMaxReach = false;

  if (d > MAX_ARM_REACH) {
    const s = MAX_ARM_REACH / (d || 1);
    hand = { x: shoulder.x + dx * s, y: shoulder.y + dy * s };
    d = MAX_ARM_REACH;
    atMaxReach = true;
  } else if (d < MIN_ARM_REACH) {
    const s = MIN_ARM_REACH / (d || 1);
    hand = { x: shoulder.x + dx * s, y: shoulder.y + dy * s };
  }

  const dir = Math.atan2(hand.y - shoulder.y, hand.x - shoulder.x);
  const cosA = (upperLen * upperLen + d * d - foreLen * foreLen) / (2 * upperLen * d || 1);
  const joint = Math.acos(clamp(cosA, -1, 1));
  const upperDir = dir - bendSign * joint;

  const elbow = {
    x: shoulder.x + Math.cos(upperDir) * upperLen,
    y: shoulder.y + Math.sin(upperDir) * upperLen,
  };

  return { shoulder, elbow, hand, atMaxReach };
}

function extensionFromGuard(hand: Vec2, guard: Vec2): number {
  return (guard.y - hand.y) * 0.7 + (guard.x - 0.5) * (hand.x < 0.5 ? -0.15 : 0.15);
}

export function solveBoxerPose(
  leftHand: GloveTarget,
  rightHand: GloveTarget,
  timeMs: number
): BoxerSkeletonPose {
  const t = timeMs * 0.001;
  const breath = Math.sin(t * 2.1) * 0.004;
  const sway = Math.sin(t * 1.35) * 0.003;
  const weightShift = Math.sin(t * 0.85) * 0.012;

  const leftExt = extensionFromGuard(leftHand, GUARD_LEFT);
  const rightExt = extensionFromGuard(rightHand, GUARD_RIGHT);
  const extDiff = rightExt - leftExt;

  const spineTwist = clamp(extDiff * 0.22, -0.09, 0.09);
  const hipRotation = clamp(extDiff * 0.1, -0.045, 0.045);
  const chestRotation = clamp(extDiff * 0.14, -0.06, 0.06);

  const pelvis: Vec2 = { x: 0.5 + sway + hipRotation * 0.4, y: PELVIS_Y + breath * 0.5 };
  const chest: Vec2 = { x: pelvis.x + hipRotation * 0.6 + spineTwist * 0.25, y: CHEST_Y + breath };
  const neck: Vec2 = { x: chest.x + spineTwist * 0.15, y: NECK_Y + breath * 1.2 };
  const head: Vec2 = { x: neck.x + spineTwist * 0.08, y: HEAD_Y + breath * 1.4 };

  const leftHip: Vec2 = { x: pelvis.x - STANCE_WIDTH - weightShift, y: pelvis.y };
  const rightHip: Vec2 = { x: pelvis.x + STANCE_WIDTH + weightShift, y: pelvis.y };
  const leftFoot: Vec2 = { x: leftHip.x - 0.01, y: 0.97 };
  const rightFoot: Vec2 = { x: rightHip.x + 0.01, y: 0.97 };

  const leftShoulderBase: Vec2 = {
    x: chest.x - SHOULDER_WIDTH + spineTwist * 0.35,
    y: chest.y - 0.02 - leftExt * 0.04,
  };
  const rightShoulderBase: Vec2 = {
    x: chest.x + SHOULDER_WIDTH + spineTwist * 0.35,
    y: chest.y - 0.02 - rightExt * 0.04,
  };

  const leftClavicle = clamp(leftExt * 0.12, -0.04, 0.04);
  const rightClavicle = clamp(rightExt * 0.12, -0.04, 0.04);

  const leftShoulder: Vec2 = {
    x: leftShoulderBase.x + leftClavicle,
    y: leftShoulderBase.y - Math.abs(leftClavicle) * 0.5,
  };
  const rightShoulder: Vec2 = {
    x: rightShoulderBase.x + rightClavicle,
    y: rightShoulderBase.y - Math.abs(rightClavicle) * 0.5,
  };

  const leftArm = solveArmIK(
    leftShoulder,
    constrainHandFromTorso(leftHand, chest),
    UPPER_ARM_LEN,
    FOREARM_LEN,
    -1
  );
  const rightArm = solveArmIK(
    rightShoulder,
    constrainHandFromTorso(rightHand, chest),
    UPPER_ARM_LEN,
    FOREARM_LEN,
    1
  );

  return {
    time: timeMs,
    pelvis,
    chest,
    neck,
    head,
    leftFoot,
    rightFoot,
    leftHip,
    rightHip,
    spineTwist,
    hipRotation,
    chestRotation,
    headRotation: chestRotation * 0.35 + spineTwist * 0.2,
    breath,
    leftArm,
    rightArm,
  };
}

export function constrainGloveTarget(
  side: 'left' | 'right',
  target: GloveTarget,
  otherHand: GloveTarget,
  timeMs: number
): GloveTarget {
  const left = side === 'left' ? target : otherHand;
  const right = side === 'right' ? target : otherHand;
  const pose = solveBoxerPose(left, right, timeMs);
  const arm = side === 'left' ? pose.leftArm : pose.rightArm;
  return { x: arm.hand.x, y: arm.hand.y };
}

export function getGloveTransform(arm: ArmChain, side: 'left' | 'right'): GloveTransform {
  const fx = arm.hand.x - arm.elbow.x;
  const fy = arm.hand.y - arm.elbow.y;
  const ux = arm.elbow.x - arm.shoulder.x;
  const uy = arm.elbow.y - arm.shoulder.y;
  const forearmAngle = Math.atan2(fy, fx);
  const bend = normalizeAngle(forearmAngle - Math.atan2(uy, ux));
  const baseRotate = (forearmAngle * 180) / Math.PI + 90;
  const guardBias = side === 'left' ? -6 : 6;
  const bendSkew = clamp(bend * 28, -22, 22);
  const reachT = clamp((arm.shoulder.y - arm.hand.y) / MAX_ARM_REACH, -0.2, 1);

  return {
    rotate: baseRotate + guardBias,
    scale: 1 + reachT * 0.1,
    scaleX: side === 'right' ? -1 : 1,
    skewX: bendSkew * (side === 'left' ? 1 : -1),
    originY: '68%',
  };
}

export function computeIdleGloveOffset(timeMs: number): { left: Vec2; right: Vec2 } {
  const t = timeMs * 0.001;
  const bob = Math.sin(t * 2.5) * 0.0025;
  const sway = Math.sin(t * 1.4) * 0.002;
  return {
    left: { x: GUARD_LEFT.x + sway, y: GUARD_LEFT.y + bob },
    right: { x: GUARD_RIGHT.x - sway, y: GUARD_RIGHT.y + bob * 0.9 },
  };
}

export function lerpV(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
