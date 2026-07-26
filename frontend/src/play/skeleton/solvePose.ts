import type { ArmChain, BoxerSkeletonPose, GloveTarget, GloveTransform, LegChain, Vec2 } from './types';
import { BODY_SCALE, GUARD_LEFT, GUARD_RIGHT } from './types';

const S = BODY_SCALE.muscleScale;
export const UPPER_ARM_LEN = 0.135 * S;
export const FOREARM_LEN = 0.125 * S;
export const MAX_ARM_REACH = UPPER_ARM_LEN + FOREARM_LEN - 0.006;
export const MIN_ARM_REACH = Math.abs(UPPER_ARM_LEN - FOREARM_LEN) + 0.012;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function normalizeAngle(a: number) {
  let v = a;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return v;
}

function constrainHandFromTorso(hand: Vec2, chest: Vec2): Vec2 {
  const cx = chest.x;
  const cy = chest.y + 0.03 * S;
  const rx = 0.15 * S;
  const ry = 0.17 * S;
  const dx = hand.x - cx;
  const dy = hand.y - cy;
  const norm = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  if (norm >= 1) return hand;
  const angle = Math.atan2(dy, dx);
  return { x: cx + Math.cos(angle) * rx * 1.03, y: cy + Math.sin(angle) * ry * 1.03 };
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

  const wrist = lerp(elbow, hand, 0.92);

  return { shoulder, elbow, wrist, hand, atMaxReach };
}

function extensionFromGuard(hand: Vec2, guard: Vec2): number {
  return (guard.y - hand.y) * 0.9 + Math.abs(hand.x - guard.x) * 0.38;
}

function solveLeg(
  hip: Vec2,
  foot: Vec2,
  punchDrive: number,
  side: 'left' | 'right',
  weightOnSide: number
): LegChain {
  const baseBend = 0.045;
  const punchBend = clamp(punchDrive * 0.14, 0, 0.07);
  const weightBend = weightOnSide > 0 ? weightOnSide * 0.025 : 0;
  const kneeT = 0.56 - baseBend - punchBend - weightBend;
  const forward = BODY_SCALE.forwardLean + clamp(punchDrive * 0.05, 0, 0.03);
  const kneeBase = lerp(hip, foot, kneeT);
  const out = side === 'left' ? -1 : 1;

  const knee: Vec2 = {
    x: kneeBase.x + out * 0.022 * S,
    y: kneeBase.y - forward * S,
  };
  const ankle = lerp(knee, foot, 0.5);

  return { hip, knee, ankle, foot };
}

export function solveBoxerPose(
  leftHand: GloveTarget,
  rightHand: GloveTarget,
  timeMs: number
): BoxerSkeletonPose {
  const t = timeMs * 0.001;

  // Idle: breathing, shoulder roll, weight shift, head bob
  const breath = Math.sin(t * 2.1) * 0.009;
  const breathSlow = Math.sin(t * 1.35) * 0.005;
  const sway = Math.sin(t * 1.35) * 0.007;
  const shoulderRoll = Math.sin(t * 1.65) * 0.011;
  const weightShift = Math.sin(t * 0.85) * 0.024;
  const headBob = Math.sin(t * 1.9) * 0.005;

  const leftExt = extensionFromGuard(leftHand, GUARD_LEFT);
  const rightExt = extensionFromGuard(rightHand, GUARD_RIGHT);
  const extDiff = rightExt - leftExt;
  const punchDrive = clamp(Math.max(leftExt, rightExt), 0, 1);

  // Hip-first punch chain: hips lead, then spine, chest, shoulders, arms
  const hipRotation = clamp(extDiff * 0.24 + punchDrive * 0.07, -0.11, 0.11);
  const spineTwist = clamp(extDiff * 0.2 + hipRotation * 0.55 + punchDrive * 0.04, -0.16, 0.16);
  const chestRotation = clamp(extDiff * 0.16 + spineTwist * 0.5 + punchDrive * 0.05, -0.12, 0.12);

  const lean = BODY_SCALE.forwardLean + punchDrive * 0.012 + breathSlow * 0.3;

  const pelvis: Vec2 = {
    x: 0.5 + sway + hipRotation * 0.65,
    y: BODY_SCALE.pelvisY + breath * 0.35,
  };

  const chest: Vec2 = {
    x: pelvis.x + hipRotation * 0.9 + spineTwist * 0.35,
    y: BODY_SCALE.chestY + breath - lean * 0.8,
  };

  const neck: Vec2 = {
    x: chest.x + spineTwist * 0.22 + chestRotation * 0.08,
    y: BODY_SCALE.shoulderY - 0.018 + breath * 1.15 - lean * 0.4,
  };

  const head: Vec2 = {
    x: neck.x + spineTwist * 0.16 + chestRotation * 0.1 + headBob * 0.4,
    y: BODY_SCALE.headTop + 0.038 + breath * 1.4 + headBob - lean * 0.25,
  };

  const sw = BODY_SCALE.stanceHalfWidth;
  const leftHip: Vec2 = { x: pelvis.x - sw - weightShift, y: pelvis.y };
  const rightHip: Vec2 = { x: pelvis.x + sw + weightShift, y: pelvis.y };
  const leftFoot: Vec2 = { x: leftHip.x - 0.01 * S, y: BODY_SCALE.footY - 0.014 };
  const rightFoot: Vec2 = { x: rightHip.x + 0.024 * S, y: BODY_SCALE.footY };

  const shw = BODY_SCALE.shoulderHalfWidth;
  const leftShoulderBase: Vec2 = {
    x: chest.x - shw + spineTwist * 0.45 + shoulderRoll * 0.3,
    y: BODY_SCALE.shoulderY - leftExt * 0.06 - punchDrive * 0.014 - lean * 0.3,
  };
  const rightShoulderBase: Vec2 = {
    x: chest.x + shw + spineTwist * 0.45 - shoulderRoll * 0.3,
    y: BODY_SCALE.shoulderY - rightExt * 0.06 - punchDrive * 0.014 - lean * 0.3,
  };

  const leftClavicle = clamp(leftExt * 0.22, -0.07, 0.07);
  const rightClavicle = clamp(rightExt * 0.22, -0.07, 0.07);

  const leftShoulder: Vec2 = {
    x: leftShoulderBase.x + leftClavicle,
    y: leftShoulderBase.y - Math.abs(leftClavicle) * 0.95 - leftExt * 0.025,
  };
  const rightShoulder: Vec2 = {
    x: rightShoulderBase.x + rightClavicle,
    y: rightShoulderBase.y - Math.abs(rightClavicle) * 0.95 - rightExt * 0.025,
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

  const weightLeft = weightShift > 0 ? weightShift / 0.024 : 0;
  const weightRight = weightShift < 0 ? -weightShift / 0.024 : 0;
  const leftLeg = solveLeg(leftHip, leftFoot, punchDrive, 'left', weightLeft);
  const rightLeg = solveLeg(rightHip, rightFoot, punchDrive, 'right', weightRight);

  return {
    time: timeMs,
    pelvis,
    chest,
    neck,
    head,
    spineTwist,
    hipRotation,
    chestRotation,
    headRotation: chestRotation * 0.45 + spineTwist * 0.3 + headBob * 2,
    breath,
    punchDrive,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
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
  // Punch-Out style rhythmic bounce — light on feet, gloves bob with shoulders
  const bob = Math.sin(t * 2.5) * 0.006;
  const sway = Math.sin(t * 1.4) * 0.005;
  const microL = Math.sin(t * 3.2) * 0.0025;
  const microR = Math.sin(t * 3.6 + 0.8) * 0.0025;
  const shoulderSway = Math.sin(t * 1.65) * 0.0035;

  return {
    left: { x: GUARD_LEFT.x + sway + shoulderSway, y: GUARD_LEFT.y + bob + microL },
    right: { x: GUARD_RIGHT.x - sway - shoulderSway, y: GUARD_RIGHT.y + bob * 0.85 + microR },
  };
}

export function lerpV(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
