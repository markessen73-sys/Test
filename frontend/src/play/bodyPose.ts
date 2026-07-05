import type { GloveId, GlovePosition } from '../types/game';

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

/** Resting guard — hands constrained to this reach envelope. */
export const GHOST_GUARD_LEFT: GlovePosition = { x: 0.34, y: 0.62 };
export const GHOST_GUARD_RIGHT: GlovePosition = { x: 0.66, y: 0.62 };

const BASE = {
  neck: { x: 0.5, y: 0.54 },
  chest: { x: 0.5, y: 0.64 },
  navel: { x: 0.5, y: 0.76 },
  waist: { x: 0.5, y: 0.86 },
  leftShoulder: { x: 0.355, y: 0.58 },
  rightShoulder: { x: 0.645, y: 0.58 },
} as const;

const UPPER_ARM = 0.105;
const FOREARM = 0.1;
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

/** Two-bone IK in screen space; bendSign picks elbow-out for natural boxing pose. */
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

/** Shoulder shifts forward/up slightly when reaching; torso leans toward active extension. */
function dynamicShoulders(leftTarget: Vec2, rightTarget: Vec2): {
  leftShoulder: Vec2;
  rightShoulder: Vec2;
  torsoLean: number;
} {
  const ls0 = BASE.leftShoulder;
  const rs0 = BASE.rightShoulder;
  const lg0 = GHOST_GUARD_LEFT;
  const rg0 = GHOST_GUARD_RIGHT;

  const leftReach = dist(lg0, leftTarget);
  const rightReach = dist(rg0, rightTarget);
  const leftShift = clamp(leftReach / MAX_REACH, 0, 1) * 0.028;
  const rightShift = clamp(rightReach / MAX_REACH, 0, 1) * 0.028;

  const leftDir = { x: leftTarget.x - ls0.x, y: leftTarget.y - ls0.y };
  const rightDir = { x: rightTarget.x - rs0.x, y: rightTarget.y - rs0.y };
  const ln = Math.hypot(leftDir.x, leftDir.y) || 1;
  const rn = Math.hypot(rightDir.x, rightDir.y) || 1;

  const leftShoulder = {
    x: ls0.x + (leftDir.x / ln) * leftShift * 0.35,
    y: ls0.y + (leftDir.y / ln) * leftShift - leftShift * 0.25,
  };
  const rightShoulder = {
    x: rs0.x + (rightDir.x / rn) * rightShift * 0.35,
    y: rs0.y + (rightDir.y / rn) * rightShift - rightShift * 0.25,
  };

  const torsoLean = clamp((rightReach - leftReach) * 0.12, -0.035, 0.035);

  return { leftShoulder, rightShoulder, torsoLean };
}

export function computeBodyPose(leftHand: GlovePosition, rightHand: GlovePosition): BodyPose {
  const { leftShoulder, rightShoulder, torsoLean } = dynamicShoulders(leftHand, rightHand);

  const left = solveArmIK(leftShoulder, leftHand, UPPER_ARM, FOREARM, -1);
  const right = solveArmIK(rightShoulder, rightHand, UPPER_ARM, FOREARM, 1);

  return { torsoLean, left, right };
}

/** Clamp a dragged glove target to arm reach from current pose. */
export function constrainGloveTarget(side: GloveId, target: GlovePosition, otherHand: GlovePosition): GlovePosition {
  const leftTarget = side === 'left' ? target : otherHand;
  const rightTarget = side === 'right' ? target : otherHand;
  const pose = computeBodyPose(leftTarget, rightTarget);
  const arm = side === 'left' ? pose.left : pose.right;
  return { x: arm.hand.x, y: arm.hand.y };
}

export function getDefaultGuard(): { left: GlovePosition; right: GlovePosition } {
  return { left: { ...GHOST_GUARD_LEFT }, right: { ...GHOST_GUARD_RIGHT } };
}

/** Muscular male torso outline paths (normalized coords). */
export function buildMuscularTorsoPaths(lean: number): { fill: string; outline: string; detail: string } {
  const c = BASE.chest;
  const w = BASE.waist;
  const n = BASE.neck;
  const ls = { x: BASE.leftShoulder.x + lean, y: BASE.leftShoulder.y };
  const rs = { x: BASE.rightShoulder.x + lean, y: BASE.rightShoulder.y };

  const fill = [
    `M ${ls.x} ${ls.y}`,
    `C ${ls.x - 0.02} ${c.y - 0.04}, ${c.x - 0.16} ${c.y - 0.06}, ${c.x - 0.13} ${c.y}`,
    `C ${c.x - 0.15} ${c.y + 0.05}, ${c.x - 0.12} ${w.y - 0.04}, ${c.x - 0.09} ${w.y}`,
    `Q ${c.x} ${w.y + 0.03} ${c.x + 0.09} ${w.y}`,
    `C ${c.x + 0.12} ${w.y - 0.04}, ${c.x + 0.15} ${c.y + 0.05}, ${c.x + 0.13} ${c.y}`,
    `C ${c.x + 0.16} ${c.y - 0.06}, ${rs.x + 0.02} ${c.y - 0.04}, ${rs.x} ${rs.y}`,
    `Q ${c.x} ${c.y - 0.1} ${ls.x} ${ls.y}`,
    'Z',
  ].join(' ');

  const outline = fill;

  const detail = [
    // Pecs
    `M ${c.x - 0.11} ${c.y - 0.02} Q ${c.x - 0.05} ${c.y + 0.04} ${c.x - 0.01} ${c.y + 0.01}`,
    `M ${c.x + 0.11} ${c.y - 0.02} Q ${c.x + 0.05} ${c.y + 0.04} ${c.x + 0.01} ${c.y + 0.01}`,
    // Abs
    `M ${c.x - 0.04} ${c.y + 0.08} L ${c.x - 0.03} ${w.y - 0.02}`,
    `M ${c.x + 0.04} ${c.y + 0.08} L ${c.x + 0.03} ${w.y - 0.02}`,
    `M ${c.x} ${c.y + 0.07} L ${c.x} ${w.y - 0.01}`,
    // Obliques
    `M ${c.x - 0.1} ${c.y + 0.06} Q ${c.x - 0.07} ${w.y - 0.05} ${c.x - 0.05} ${w.y}`,
    `M ${c.x + 0.1} ${c.y + 0.06} Q ${c.x + 0.07} ${w.y - 0.05} ${c.x + 0.05} ${w.y}`,
    // Traps / neck
    `M ${n.x - 0.05} ${n.y} L ${ls.x + 0.02} ${ls.y - 0.01}`,
    `M ${n.x + 0.05} ${n.y} L ${rs.x - 0.02} ${rs.y - 0.01}`,
  ].join(' ');

  return { fill, outline, detail };
}

/** Tapered arm shape through shoulder → elbow → hand for muscular look. */
export function buildArmPath(arm: ArmPose, side: GloveId): string {
  const { shoulder: s, elbow: e, hand: h } = arm;
  const out = side === 'left' ? -1 : 1;

  const upperMid = lerp(s, e, 0.45);
  const bicepBulge = {
    x: upperMid.x + out * 0.018,
    y: upperMid.y - 0.008,
  };

  const shoulderW = 0.028;
  const elbowW = 0.022;
  const wristW = 0.018;

  const uDir = Math.atan2(e.y - s.y, e.x - s.x);
  const uPerp = uDir + Math.PI / 2;
  const fDir = Math.atan2(h.y - e.y, h.x - e.x);
  const fPerp = fDir + Math.PI / 2;

  const pt = (p: Vec2, w: number, perp: number, sign: number) => ({
    x: p.x + Math.cos(perp) * w * sign,
    y: p.y + Math.sin(perp) * w * sign,
  });

  const s1 = pt(s, shoulderW, uPerp, 1);
  const s2 = pt(s, shoulderW, uPerp, -1);
  const b1 = pt(bicepBulge, shoulderW * 1.15, uPerp, out);
  const e1 = pt(e, elbowW, fPerp, 1);
  const e2 = pt(e, elbowW, fPerp, -1);
  const h1 = pt(h, wristW, fPerp, 1);
  const h2 = pt(h, wristW, fPerp, -1);

  return [
    `M ${s1.x} ${s1.y}`,
    `Q ${b1.x} ${b1.y} ${e1.x} ${e1.y}`,
    `L ${h1.x} ${h1.y}`,
    `L ${h2.x} ${h2.y}`,
    `Q ${e2.x} ${e2.y} ${s2.x} ${s2.y}`,
    'Z',
  ].join(' ');
}

export function buildHeadPath(lean: number): string {
  const h = { x: BASE.neck.x + lean, y: 0.46 };
  return [
    `M ${h.x - 0.055} ${h.y + 0.02}`,
    `Q ${h.x - 0.07} ${h.y - 0.04} ${h.x} ${h.y - 0.055}`,
    `Q ${h.x + 0.07} ${h.y - 0.04} ${h.x + 0.055} ${h.y + 0.02}`,
    `Q ${h.x} ${h.y + 0.06} ${h.x - 0.055} ${h.y + 0.02}`,
    'Z',
  ].join(' ');
}

export function buildNeckPath(lean: number): string {
  const n = { x: BASE.neck.x + lean, y: BASE.neck.y };
  return `M ${n.x - 0.028} ${n.y} L ${n.x + 0.028} ${n.y} L ${n.x + 0.022} ${n.y + 0.035} L ${n.x - 0.022} ${n.y + 0.035} Z`;
}

/** Max reach from guard — useful for debug/UI */
export function getArmReach(): number {
  return MAX_REACH;
}
