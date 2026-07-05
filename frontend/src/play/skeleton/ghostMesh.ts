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

/** Muscular outer edge points along an arm chain. */
function armOuterEdge(arm: ArmChain, side: 'left' | 'right'): Vec2[] {
  const out = side === 'left' ? -1 : 1;
  const s = arm.shoulder;
  const e = arm.elbow;
  const w = arm.wrist;
  const upperMid = lerp(s, e, 0.42);
  const foreMid = lerp(e, w, 0.45);
  const deltoid = pt(s, e, 0.048, out as 1 | -1);
  const bicep = pt(upperMid, e, 0.042, out as 1 | -1);
  const elbowOut = pt(e, w, 0.032, out as 1 | -1);
  const foreOut = pt(foreMid, w, 0.028, out as 1 | -1);
  const wristOut = pt(e, w, 0.022, out as 1 | -1);
  return [deltoid, bicep, elbowOut, foreOut, wristOut];
}

function legOuterEdge(leg: LegChain, side: 'left' | 'right'): Vec2[] {
  const out = side === 'left' ? -1 : 1;
  const thighMid = lerp(leg.hip, leg.knee, 0.45);
  const calfMid = lerp(leg.knee, leg.foot, 0.45);
  return [
    pt(leg.hip, leg.knee, 0.052, out as 1 | -1),
    pt(thighMid, leg.knee, 0.048, out as 1 | -1),
    pt(leg.knee, leg.foot, 0.038, out as 1 | -1),
    pt(calfMid, leg.foot, 0.032, out as 1 | -1),
    { x: leg.foot.x + out * 0.02, y: leg.foot.y },
  ];
}

function pathFromPoints(points: Vec2[], smooth = true): string {
  if (points.length === 0) return '';
  if (!smooth || points.length < 3) {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' ';
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const c = points[i];
    const n = points[i + 1];
    d += ` Q ${c.x} ${c.y} ${(c.x + n.x) / 2} ${(c.y + n.y) / 2}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * Build ONE unified anatomical silhouette driven by the skeleton.
 * Gloves render separately on top of the wrists.
 */
export function buildAnatomicalGhostMesh(pose: BoxerSkeletonPose): AnatomicalGhostMesh {
  const { head, neck, chest, pelvis, spineTwist, leftArm, rightArm, leftLeg, rightLeg } = pose;
  const cx = chest.x;

  const leftArmOut = armOuterEdge(leftArm, 'left');
  const rightArmOut = armOuterEdge(rightArm, 'right');
  const leftLegOut = legOuterEdge(leftLeg, 'left');
  const rightLegOut = legOuterEdge(rightLeg, 'right');

  const trapL: Vec2 = { x: leftArm.shoulder.x - 0.02, y: neck.y + 0.01 };
  const trapR: Vec2 = { x: rightArm.shoulder.x + 0.02, y: neck.y + 0.01 };
  const latL: Vec2 = { x: cx - 0.2 + spineTwist * 0.15, y: chest.y + 0.06 };
  const latR: Vec2 = { x: cx + 0.2 + spineTwist * 0.15, y: chest.y + 0.06 };
  const waistL: Vec2 = { x: pelvis.x - 0.1, y: BODY_SCALE.waistY };
  const waistR: Vec2 = { x: pelvis.x + 0.1, y: BODY_SCALE.waistY };

  const headTop: Vec2 = { x: head.x, y: BODY_SCALE.headTop };
  const headL: Vec2 = { x: head.x - 0.06, y: head.y };
  const headR: Vec2 = { x: head.x + 0.06, y: head.y };

  // Clockwise unified silhouette from head top
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

  const silhouette = pathFromPoints(outline) + 'Z';

  const muscleDetail = [
    // Traps
    `M ${neck.x - 0.04} ${neck.y} L ${trapL.x} ${trapL.y}`,
    `M ${neck.x + 0.04} ${neck.y} L ${trapR.x} ${trapR.y}`,
    // Spine
    `M ${neck.x} ${neck.y + 0.01} L ${cx + spineTwist * 0.04} ${pelvis.y - 0.03}`,
    // Lat sweep
    `M ${latL.x} ${latL.y} Q ${cx - 0.08} ${chest.y + 0.1} ${waistL.x} ${waistL.y}`,
    `M ${latR.x} ${latR.y} Q ${cx + 0.08} ${chest.y + 0.1} ${waistR.x} ${waistR.y}`,
    // Rear delts
    `M ${leftArm.shoulder.x} ${leftArm.shoulder.y} Q ${leftArmOut[0].x} ${leftArmOut[0].y} ${leftArm.elbow.x} ${leftArm.elbow.y}`,
    `M ${rightArm.shoulder.x} ${rightArm.shoulder.y} Q ${rightArmOut[0].x} ${rightArmOut[0].y} ${rightArm.elbow.x} ${rightArm.elbow.y}`,
    // Shorts waistband
    `M ${pelvis.x - 0.11} ${pelvis.y} Q ${pelvis.x} ${pelvis.y + 0.015} ${pelvis.x + 0.11} ${pelvis.y}`,
    // Calf definition
    `M ${leftLeg.knee.x} ${leftLeg.knee.y} L ${leftLeg.foot.x} ${leftLeg.foot.y - 0.01}`,
    `M ${rightLeg.knee.x} ${rightLeg.knee.y} L ${rightLeg.foot.x} ${rightLeg.foot.y - 0.01}`,
  ].join(' ');

  // Wispy interior energy lines
  const wisps = [
    `M ${cx - 0.06} ${chest.y} Q ${cx} ${chest.y + 0.08} ${cx + 0.06} ${chest.y}`,
    `M ${cx - 0.04} ${chest.y + 0.1} Q ${cx + spineTwist * 0.02} ${pelvis.y - 0.06} ${cx + 0.04} ${chest.y + 0.1}`,
  ].join(' ');

  return { silhouette, muscleDetail, wisps };
}
