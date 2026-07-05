import type { GloveId, GlovePosition } from '../types/game';
import { getBackShoulderAnchors } from './ghostBodyShape';

export interface Vec2 {
  x: number;
  y: number;
}

export interface ArmPose {
  shoulder: Vec2;
  elbow: Vec2;
  hand: Vec2;
  atMaxReach: boolean;
}

export interface BodyPose {
  torsoLean: number;
  left: ArmPose;
  right: ArmPose;
}

export interface GloveTransform {
  rotate: number;
  scale: number;
  scaleX: number;
  skewX: number;
  originY: string;
}

/** High guard — from-behind boxing stance */
export const GHOST_GUARD_LEFT: GlovePosition = { x: 0.31, y: 0.44 };
export const GHOST_GUARD_RIGHT: GlovePosition = { x: 0.69, y: 0.44 };

const UPPER_ARM = 0.11;
const FOREARM = 0.105;
const MAX_REACH = UPPER_ARM + FOREARM - 0.004;
const MIN_REACH = Math.abs(UPPER_ARM - FOREARM) + 0.008;

function dist(a: Vec2, b: Vec2) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeAngle(a: number) {
  let v = a;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return v;
}

export function solveArmIK(
  shoulder: Vec2,
  target: Vec2,
  upperLen: number,
  foreLen: number,
  bendSign: 1 | -1
): ArmPose {
  const dx = target.x - shoulder.x;
  const dy = target.y - shoulder.y;
  let d = Math.hypot(dx, dy);

  let hand = target;
  let atMaxReach = false;

  if (d > MAX_REACH) {
    const scale = MAX_REACH / (d || 1);
    hand = { x: shoulder.x + dx * scale, y: shoulder.y + dy * scale };
    d = MAX_REACH;
    atMaxReach = true;
  } else if (d < MIN_REACH) {
    const scale = MIN_REACH / (d || 1);
    hand = { x: shoulder.x + dx * scale, y: shoulder.y + dy * scale };
    d = MIN_REACH;
  }

  const dir = Math.atan2(hand.y - shoulder.y, hand.x - shoulder.x);
  const cosAngle =
    (upperLen * upperLen + d * d - foreLen * foreLen) / (2 * upperLen * d || 1);
  const jointAngle = Math.acos(clamp(cosAngle, -1, 1));
  const upperDir = dir - bendSign * jointAngle;

  const elbow = {
    x: shoulder.x + Math.cos(upperDir) * upperLen,
    y: shoulder.y + Math.sin(upperDir) * upperLen,
  };

  return { shoulder, elbow, hand, atMaxReach };
}

function dynamicShoulders(leftTarget: Vec2, rightTarget: Vec2, torsoLean: number): {
  leftShoulder: Vec2;
  rightShoulder: Vec2;
} {
  const anchors = getBackShoulderAnchors(torsoLean);
  const ls0 = anchors.left;
  const rs0 = anchors.right;
  const lg0 = GHOST_GUARD_LEFT;
  const rg0 = GHOST_GUARD_RIGHT;

  const leftReach = dist(lg0, leftTarget);
  const rightReach = dist(rg0, rightTarget);
  const leftShift = clamp(leftReach / MAX_REACH, 0, 1) * 0.022;
  const rightShift = clamp(rightReach / MAX_REACH, 0, 1) * 0.022;

  const leftDir = { x: leftTarget.x - ls0.x, y: leftTarget.y - ls0.y };
  const rightDir = { x: rightTarget.x - rs0.x, y: rightTarget.y - rs0.y };
  const ln = Math.hypot(leftDir.x, leftDir.y) || 1;
  const rn = Math.hypot(rightDir.x, rightDir.y) || 1;

  const leftShoulder = {
    x: ls0.x + (leftDir.x / ln) * leftShift * 0.3,
    y: ls0.y + (leftDir.y / ln) * leftShift - leftShift * 0.2,
  };
  const rightShoulder = {
    x: rs0.x + (rightDir.x / rn) * rightShift * 0.3,
    y: rs0.y + (rightDir.y / rn) * rightShift - rightShift * 0.2,
  };

  return { leftShoulder, rightShoulder };
}

export function computeBodyPose(leftHand: GlovePosition, rightHand: GlovePosition): BodyPose {
  const lg0 = GHOST_GUARD_LEFT;
  const rg0 = GHOST_GUARD_RIGHT;
  const leftReach = dist(lg0, leftHand);
  const rightReach = dist(rg0, rightHand);
  const torsoLean = clamp((rightReach - leftReach) * 0.1, -0.025, 0.025);

  const { leftShoulder, rightShoulder } = dynamicShoulders(leftHand, rightHand, torsoLean);

  const left = solveArmIK(leftShoulder, leftHand, UPPER_ARM, FOREARM, -1);
  const right = solveArmIK(rightShoulder, rightHand, UPPER_ARM, FOREARM, 1);

  return { torsoLean, left, right };
}

export function constrainGloveTarget(
  side: GloveId,
  target: GlovePosition,
  otherHand: GlovePosition
): GlovePosition {
  const leftTarget = side === 'left' ? target : otherHand;
  const rightTarget = side === 'right' ? target : otherHand;
  const pose = computeBodyPose(leftTarget, rightTarget);
  const arm = side === 'left' ? pose.left : pose.right;
  return { x: arm.hand.x, y: arm.hand.y };
}

/** Glove rotation/scale from forearm + elbow bend — back-view boxing pose. */
export function getGloveTransform(arm: ArmPose, side: GloveId): GloveTransform {
  const fx = arm.hand.x - arm.elbow.x;
  const fy = arm.hand.y - arm.elbow.y;
  const ux = arm.elbow.x - arm.shoulder.x;
  const uy = arm.elbow.y - arm.shoulder.y;

  const forearmAngle = Math.atan2(fy, fx);
  const upperAngle = Math.atan2(uy, ux);
  const bend = normalizeAngle(forearmAngle - upperAngle);

  // Sprite default: cuff down, knuckles toward screen-top (bag direction)
  const baseRotate = (forearmAngle * 180) / Math.PI + 90;
  const guardBias = side === 'left' ? -6 : 6;
  const bendSkew = clamp(bend * 28, -22, 22);

  const reachT = clamp((arm.shoulder.y - arm.hand.y) / MAX_REACH, -0.2, 1);
  const scale = 1 + reachT * 0.1;

  return {
    rotate: baseRotate + guardBias,
    scale,
    scaleX: side === 'right' ? -1 : 1,
    skewX: bendSkew * (side === 'left' ? 1 : -1),
    originY: '68%',
  };
}

function armSegmentPath(from: Vec2, to: Vec2, widthStart: number, widthEnd: number, bulge: Vec2 | null): string {
  const dir = Math.atan2(to.y - from.y, to.x - from.x);
  const perp = dir + Math.PI / 2;
  const pt = (p: Vec2, w: number, sign: number) => ({
    x: p.x + Math.cos(perp) * w * sign,
    y: p.y + Math.sin(perp) * w * sign,
  });

  const a1 = pt(from, widthStart, 1);
  const a2 = pt(from, widthStart, -1);
  const b1 = pt(to, widthEnd, 1);
  const b2 = pt(to, widthEnd, -1);

  if (bulge) {
    const m1 = pt(lerp(from, bulge, 0.5), widthStart * 1.1, 1);
    const m2 = pt(lerp(from, bulge, 0.5), widthStart * 1.1, -1);
    return [
      `M ${a1.x} ${a1.y}`,
      `Q ${m1.x} ${m1.y} ${b1.x} ${b1.y}`,
      `L ${b2.x} ${b2.y}`,
      `Q ${m2.x} ${m2.y} ${a2.x} ${a2.y}`,
      'Z',
    ].join(' ');
  }

  return [`M ${a1.x} ${a1.y}`, `L ${b1.x} ${b1.y}`, `L ${b2.x} ${b2.y}`, `L ${a2.x} ${a2.y}`, 'Z'].join(' ');
}

export function buildUpperArmPath(arm: ArmPose, side: GloveId): string {
  const out = side === 'left' ? -1 : 1;
  const mid = lerp(arm.shoulder, arm.elbow, 0.45);
  const bulge = { x: mid.x + out * 0.014, y: mid.y - 0.006 };
  return armSegmentPath(arm.shoulder, arm.elbow, 0.032, 0.026, bulge);
}

export function buildForearmPath(arm: ArmPose): string {
  return armSegmentPath(arm.elbow, arm.hand, 0.024, 0.018, null);
}

export function getArmReach(): number {
  return MAX_REACH;
}
