import type { ArmChain, BoxerSkeletonPose, Vec2 } from './types';

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function limbPath(from: Vec2, to: Vec2, w0: number, w1: number, bulge: Vec2 | null): string {
  const dir = Math.atan2(to.y - from.y, to.x - from.x);
  const perp = dir + Math.PI / 2;
  const pt = (p: Vec2, w: number, s: number) => ({
    x: p.x + Math.cos(perp) * w * s,
    y: p.y + Math.sin(perp) * w * s,
  });

  const a1 = pt(from, w0, 1);
  const a2 = pt(from, w0, -1);
  const b1 = pt(to, w1, 1);
  const b2 = pt(to, w1, -1);

  if (bulge) {
    const m1 = pt(lerp(from, bulge, 0.5), w0 * 1.12, 1);
    const m2 = pt(lerp(from, bulge, 0.5), w0 * 1.12, -1);
    return [`M ${a1.x} ${a1.y}`, `Q ${m1.x} ${m1.y} ${b1.x} ${b1.y}`, `L ${b2.x} ${b2.y}`, `Q ${m2.x} ${m2.y} ${a2.x} ${a2.y}`, 'Z'].join(' ');
  }
  return [`M ${a1.x} ${a1.y}`, `L ${b1.x} ${b1.y}`, `L ${b2.x} ${b2.y}`, `L ${a2.x} ${a2.y}`, 'Z'].join(' ');
}

function upperArmPath(arm: ArmChain, side: 'left' | 'right'): string {
  const out = side === 'left' ? -1 : 1;
  const mid = lerp(arm.shoulder, arm.elbow, 0.45);
  const bulge = { x: mid.x + out * 0.014, y: mid.y - 0.006 };
  return limbPath(arm.shoulder, arm.elbow, 0.034, 0.028, bulge);
}

function forearmPath(arm: ArmChain): string {
  return limbPath(arm.elbow, arm.hand, 0.026, 0.02, null);
}

export function buildGhostMesh(pose: BoxerSkeletonPose): {
  torso: string;
  head: string;
  shorts: string;
  leftThigh: string;
  rightThigh: string;
  leftCalf: string;
  rightCalf: string;
  leftUpperArm: string;
  rightUpperArm: string;
  leftForearm: string;
  rightForearm: string;
  muscleLines: string;
} {
  const { pelvis, chest, neck, head: headPos, leftHip, rightHip, leftFoot, rightFoot, spineTwist } = pose;
  const cx = chest.x;

  const torso = [
    `M ${chest.x - 0.13 + spineTwist * 0.3} ${chest.y - 0.02}`,
    `C ${cx - 0.2} ${chest.y + 0.02}, ${cx - 0.17} ${chest.y + 0.08}, ${cx - 0.12} ${chest.y + 0.12}`,
    `L ${pelvis.x - 0.09} ${pelvis.y - 0.02}`,
    `Q ${pelvis.x} ${pelvis.y + 0.02} ${pelvis.x + 0.09} ${pelvis.y - 0.02}`,
    `L ${cx + 0.12} ${chest.y + 0.12}`,
    `C ${cx + 0.17} ${chest.y + 0.08}, ${cx + 0.2} ${chest.y + 0.02}, ${chest.x + 0.13 + spineTwist * 0.3} ${chest.y - 0.02}`,
    `Q ${cx} ${chest.y - 0.08} ${chest.x - 0.13 + spineTwist * 0.3} ${chest.y - 0.02}`,
    'Z',
  ].join(' ');

  const headPath = [
    `M ${headPos.x - 0.05} ${headPos.y + 0.02}`,
    `Q ${headPos.x - 0.065} ${headPos.y - 0.035}, ${headPos.x} ${headPos.y - 0.05}`,
    `Q ${headPos.x + 0.065} ${headPos.y - 0.035}, ${headPos.x + 0.05} ${headPos.y + 0.02}`,
    `Q ${headPos.x} ${headPos.y + 0.055}, ${headPos.x - 0.05} ${headPos.y + 0.02}`,
    'Z',
  ].join(' ');

  const shorts = [
    `M ${pelvis.x - 0.1} ${pelvis.y}`,
    `L ${pelvis.x - 0.11} ${pelvis.y + 0.09}`,
    `Q ${pelvis.x - 0.07} ${pelvis.y + 0.11}, ${pelvis.x - 0.03} ${pelvis.y + 0.1}`,
    `L ${pelvis.x} ${pelvis.y + 0.095}`,
    `L ${pelvis.x + 0.03} ${pelvis.y + 0.1}`,
    `Q ${pelvis.x + 0.07} ${pelvis.y + 0.11}, ${pelvis.x + 0.11} ${pelvis.y + 0.09}`,
    `L ${pelvis.x + 0.1} ${pelvis.y}`,
    `Q ${pelvis.x} ${pelvis.y + 0.02}, ${pelvis.x - 0.1} ${pelvis.y}`,
    'Z',
  ].join(' ');

  const kneeL = lerp(leftHip, leftFoot, 0.55);
  const kneeR = lerp(rightHip, rightFoot, 0.55);

  const muscleLines = [
    `M ${neck.x - 0.035} ${neck.y} L ${chest.x - 0.11 + spineTwist * 0.2} ${chest.y}`,
    `M ${neck.x + 0.035} ${neck.y} L ${chest.x + 0.11 + spineTwist * 0.2} ${chest.y}`,
    `M ${cx} ${neck.y + 0.02} L ${cx + spineTwist * 0.05} ${pelvis.y - 0.04}`,
    `M ${chest.x - 0.1} ${chest.y + 0.06} Q ${chest.x - 0.13} ${chest.y + 0.1} ${chest.x - 0.08} ${chest.y + 0.14}`,
    `M ${chest.x + 0.1} ${chest.y + 0.06} Q ${chest.x + 0.13} ${chest.y + 0.1} ${chest.x + 0.08} ${chest.y + 0.14}`,
  ].join(' ');

  return {
    torso,
    head: headPath,
    shorts,
    leftThigh: limbPath(leftHip, kneeL, 0.038, 0.032, null),
    rightThigh: limbPath(rightHip, kneeR, 0.038, 0.032, null),
    leftCalf: limbPath(kneeL, leftFoot, 0.03, 0.024, null),
    rightCalf: limbPath(kneeR, rightFoot, 0.03, 0.024, null),
    leftUpperArm: upperArmPath(pose.leftArm, 'left'),
    rightUpperArm: upperArmPath(pose.rightArm, 'right'),
    leftForearm: forearmPath(pose.leftArm),
    rightForearm: forearmPath(pose.rightArm),
    muscleLines,
  };
}
