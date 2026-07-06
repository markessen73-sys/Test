import type { AnatomicalGhostMesh, ArmChain, BoxerSkeletonPose, LegChain, Vec2 } from './types';
import { BODY_SCALE, HEAD_WIDTH } from './types';

const M = BODY_SCALE.muscleScale;

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function offset(from: Vec2, to: Vec2, dist: number, side: 1 | -1): Vec2 {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  const p = a + (Math.PI / 2) * side;
  return { x: from.x + Math.cos(p) * dist, y: from.y + Math.sin(p) * dist };
}

/** Smooth closed curve through points — no sharp joint corners */
function smoothClosedPath(points: Vec2[]): string {
  const n = points.length;
  if (n < 3) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d + ' Z';
}

function armOuterContour(arm: ArmChain, side: 'left' | 'right'): Vec2[] {
  const out = side === 'left' ? -1 : 1;
  const { shoulder: s, elbow: e, wrist: wr, hand: hd } = arm;
  return [
    offset(s, e, 0.062 * M, out as 1 | -1),
    offset(lerp(s, e, 0.45), e, 0.056 * M, out as 1 | -1),
    offset(e, wr, 0.048 * M, out as 1 | -1),
    offset(lerp(e, wr, 0.5), wr, 0.042 * M, out as 1 | -1),
    offset(wr, hd, 0.036 * M, out as 1 | -1),
    { x: hd.x + out * 0.024 * M, y: hd.y + 0.006 },
    { x: hd.x + out * 0.012 * M, y: hd.y + 0.012 },
  ];
}

function legOuterContour(leg: LegChain, side: 'left' | 'right'): Vec2[] {
  const out = side === 'left' ? -1 : 1;
  return [
    offset(leg.hip, leg.knee, 0.068 * M, out as 1 | -1),
    offset(lerp(leg.hip, leg.knee, 0.45), leg.knee, 0.062 * M, out as 1 | -1),
    offset(leg.knee, leg.ankle, 0.05 * M, out as 1 | -1),
    offset(lerp(leg.knee, leg.ankle, 0.45), leg.ankle, 0.044 * M, out as 1 | -1),
    offset(leg.ankle, leg.foot, 0.04 * M, out as 1 | -1),
    { x: leg.foot.x + out * 0.04 * M, y: leg.foot.y - 0.006 },
    { x: leg.foot.x + out * 0.018 * M, y: leg.foot.y },
    { x: leg.foot.x, y: leg.foot.y },
  ];
}

export function buildAnatomicalGhostMesh(pose: BoxerSkeletonPose): AnatomicalGhostMesh {
  const { head, neck, chest, pelvis, spineTwist, leftArm, rightArm, leftLeg, rightLeg } = pose;
  const cx = chest.x;

  const leftArmOut = armOuterContour(leftArm, 'left');
  const rightArmOut = armOuterContour(rightArm, 'right');
  const leftLegOut = legOuterContour(leftLeg, 'left');
  const rightLegOut = legOuterContour(rightLeg, 'right');

  const trapL: Vec2 = { x: leftArm.shoulder.x - 0.042 * M, y: neck.y - 0.012 };
  const trapR: Vec2 = { x: rightArm.shoulder.x + 0.042 * M, y: neck.y - 0.012 };
  const latL: Vec2 = { x: cx - 0.22 * M + spineTwist * 0.1, y: chest.y + 0.035 };
  const latR: Vec2 = { x: cx + 0.22 * M + spineTwist * 0.1, y: chest.y + 0.035 };
  const waistL: Vec2 = { x: pelvis.x - 0.09 * M, y: BODY_SCALE.waistY };
  const waistR: Vec2 = { x: pelvis.x + 0.09 * M, y: BODY_SCALE.waistY };

  const headTop: Vec2 = { x: head.x, y: BODY_SCALE.headTop };
  const headL: Vec2 = { x: head.x - HEAD_WIDTH * 0.48, y: head.y + 0.008 };
  const headR: Vec2 = { x: head.x + HEAD_WIDTH * 0.48, y: head.y + 0.008 };

  const groundMid: Vec2 = { x: (leftLeg.foot.x + rightLeg.foot.x) / 2, y: BODY_SCALE.footY - 0.002 };

  const outline: Vec2[] = [
    headTop,
    headL,
    trapL,
    { x: leftArm.shoulder.x - 0.02 * M, y: leftArm.shoulder.y },
    ...leftArmOut,
    latL,
    waistL,
    { x: leftLeg.hip.x - 0.02 * M, y: leftLeg.hip.y },
    ...leftLegOut,
    groundMid,
    ...[...rightLegOut].reverse(),
    { x: rightLeg.hip.x + 0.02 * M, y: rightLeg.hip.y },
    waistR,
    latR,
    ...[...rightArmOut].reverse(),
    { x: rightArm.shoulder.x + 0.02 * M, y: rightArm.shoulder.y },
    trapR,
    headR,
  ];

  const silhouette = smoothClosedPath(outline);

  // Shorts sub-region for subtle shading (filled separately on canvas)
  const shortsRegion = [
    { x: pelvis.x - 0.11 * M, y: pelvis.y - 0.006 },
    { x: pelvis.x + 0.11 * M, y: pelvis.y - 0.006 },
    { x: pelvis.x + 0.1 * M, y: BODY_SCALE.shortsY + 0.01 },
    { x: pelvis.x - 0.1 * M, y: BODY_SCALE.shortsY + 0.01 },
  ];
  const muscleDetail = smoothClosedPath(shortsRegion);

  return { silhouette, muscleDetail, wisps: '' };
}
