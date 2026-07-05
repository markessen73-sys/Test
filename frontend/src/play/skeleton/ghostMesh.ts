import type { AnatomicalGhostMesh, ArmChain, BoxerSkeletonPose, LegChain, Vec2 } from './types';
import { BODY_SCALE } from './types';

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function pt(from: Vec2, to: Vec2, width: number, side: 1 | -1): Vec2 {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  const p = a + (Math.PI / 2) * side;
  return { x: from.x + Math.cos(p) * width, y: from.y + Math.sin(p) * width };
}

function armOuterEdge(arm: ArmChain, side: 'left' | 'right'): Vec2[] {
  const out = side === 'left' ? -1 : 1;
  const s = arm.shoulder;
  const e = arm.elbow;
  const w = arm.wrist;
  const upperMid = lerp(s, e, 0.42);
  const foreMid = lerp(e, w, 0.45);
  return [
    pt(s, e, 0.072, out as 1 | -1),
    pt(upperMid, e, 0.065, out as 1 | -1),
    pt(e, w, 0.048, out as 1 | -1),
    pt(foreMid, w, 0.04, out as 1 | -1),
    pt(e, w, 0.032, out as 1 | -1),
  ];
}

function legOuterEdge(leg: LegChain, side: 'left' | 'right'): Vec2[] {
  const out = side === 'left' ? -1 : 1;
  const thighMid = lerp(leg.hip, leg.knee, 0.45);
  const calfMid = lerp(leg.knee, leg.foot, 0.45);
  return [
    pt(leg.hip, leg.knee, 0.068, out as 1 | -1),
    pt(thighMid, leg.knee, 0.062, out as 1 | -1),
    pt(leg.knee, leg.foot, 0.05, out as 1 | -1),
    pt(calfMid, leg.foot, 0.042, out as 1 | -1),
    { x: leg.foot.x + out * 0.028, y: leg.foot.y },
  ];
}

function pathFromPoints(points: Vec2[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];
    const mx = (prev.x + p.x) / 2;
    const my = (prev.y + p.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function buildAnatomicalGhostMesh(pose: BoxerSkeletonPose): AnatomicalGhostMesh {
  const { head, neck, chest, pelvis, spineTwist, leftArm, rightArm, leftLeg, rightLeg } = pose;
  const cx = chest.x;

  const leftArmOut = armOuterEdge(leftArm, 'left');
  const rightArmOut = armOuterEdge(rightArm, 'right');
  const leftLegOut = legOuterEdge(leftLeg, 'left');
  const rightLegOut = legOuterEdge(rightLeg, 'right');

  // Wide trap peaks — muscular upper back
  const trapL: Vec2 = { x: leftArm.shoulder.x - 0.035, y: neck.y - 0.01 };
  const trapR: Vec2 = { x: rightArm.shoulder.x + 0.035, y: neck.y - 0.01 };
  const latL: Vec2 = { x: cx - 0.24 + spineTwist * 0.12, y: chest.y + 0.04 };
  const latR: Vec2 = { x: cx + 0.24 + spineTwist * 0.12, y: chest.y + 0.04 };
  const waistL: Vec2 = { x: pelvis.x - 0.12, y: BODY_SCALE.waistY };
  const waistR: Vec2 = { x: pelvis.x + 0.12, y: BODY_SCALE.waistY };

  const headTop: Vec2 = { x: head.x, y: BODY_SCALE.headTop };
  const headL: Vec2 = { x: head.x - 0.07, y: head.y + 0.01 };
  const headR: Vec2 = { x: head.x + 0.07, y: head.y + 0.01 };

  const outline: Vec2[] = [
    headTop,
    headL,
    trapL,
    leftArm.shoulder,
    ...leftArmOut,
    latL,
    waistL,
    leftLeg.hip,
    ...leftLegOut,
    { x: (leftLeg.foot.x + rightLeg.foot.x) / 2, y: BODY_SCALE.footY },
    ...[...rightLegOut].reverse(),
    rightLeg.hip,
    waistR,
    latR,
    ...[...rightArmOut].reverse(),
    rightArm.shoulder,
    trapR,
    headR,
    headTop,
  ];

  const silhouette = pathFromPoints(outline) + ' Z';

  const muscleDetail = [
    `M ${neck.x - 0.045} ${neck.y} L ${trapL.x - 0.01} ${trapL.y + 0.02}`,
    `M ${neck.x + 0.045} ${neck.y} L ${trapR.x + 0.01} ${trapR.y + 0.02}`,
    `M ${neck.x} ${neck.y + 0.01} L ${cx + spineTwist * 0.05} ${pelvis.y - 0.04}`,
    `M ${latL.x} ${latL.y} Q ${cx - 0.1} ${chest.y + 0.12} ${waistL.x} ${waistL.y}`,
    `M ${latR.x} ${latR.y} Q ${cx + 0.1} ${chest.y + 0.12} ${waistR.x} ${waistR.y}`,
    `M ${leftArm.shoulder.x} ${leftArm.shoulder.y} Q ${leftArmOut[0].x} ${leftArmOut[0].y} ${leftArm.elbow.x} ${leftArm.elbow.y}`,
    `M ${rightArm.shoulder.x} ${rightArm.shoulder.y} Q ${rightArmOut[0].x} ${rightArmOut[0].y} ${rightArm.elbow.x} ${rightArm.elbow.y}`,
    `M ${pelvis.x - 0.13} ${pelvis.y} Q ${pelvis.x} ${pelvis.y + 0.02} ${pelvis.x + 0.13} ${pelvis.y}`,
    `M ${leftLeg.knee.x} ${leftLeg.knee.y} L ${leftLeg.foot.x} ${leftLeg.foot.y - 0.008}`,
    `M ${rightLeg.knee.x} ${rightLeg.knee.y} L ${rightLeg.foot.x} ${rightLeg.foot.y - 0.008}`,
  ].join(' ');

  const wisps = [
    `M ${cx - 0.08} ${chest.y} Q ${cx} ${chest.y + 0.1} ${cx + 0.08} ${chest.y}`,
    `M ${cx - 0.05} ${chest.y + 0.12} Q ${cx} ${pelvis.y - 0.08} ${cx + 0.05} ${chest.y + 0.12}`,
  ].join(' ');

  return { silhouette, muscleDetail, wisps };
}
