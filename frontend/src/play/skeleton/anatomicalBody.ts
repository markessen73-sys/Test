import type { ArmChain, BoxerSkeletonPose, LegChain, Vec2 } from './types';
import { BODY_SCALE, HEAD_WIDTH } from './types';

const M = BODY_SCALE.muscleScale;
const FILL = 0.35;
const FILL_BODY = 0.32;
const GLOW = 'rgba(200, 230, 255, 0.55)';

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function px(p: Vec2, w: number, h: number): Vec2 {
  return { x: p.x * w, y: p.y * h };
}

/** Pale blue translucent fill — no construction strokes */
function fillRegion(ctx: CanvasRenderingContext2D, w: number, alpha = FILL) {
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, `rgba(170, 210, 245, ${alpha * 0.88})`);
  grad.addColorStop(0.5, `rgba(205, 232, 255, ${alpha})`);
  grad.addColorStop(1, `rgba(170, 210, 245, ${alpha * 0.88})`);
  ctx.fillStyle = grad;
  ctx.shadowColor = GLOW;
  ctx.shadowBlur = w * 0.008;
  ctx.fill();
  ctx.shadowBlur = 0;
}

/**
 * Organic limb volume between two IK points.
 * Filled hull only — joints are never drawn as circles or pivot marks.
 */
function fillLimbVolume(
  ctx: CanvasRenderingContext2D,
  a: Vec2,
  b: Vec2,
  radiusA: number,
  radiusB: number,
  w: number,
  h: number,
  outerSide: 1 | -1,
  bulge = 1.1
) {
  const p0 = px(a, w, h);
  const p1 = px(b, w, h);
  const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const perp = ang + (Math.PI / 2) * outerSide;
  const r0 = radiusA * w;
  const r1 = radiusB * w;
  const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const bulgePt = {
    x: mid.x + Math.cos(perp) * ((r0 + r1) / 2) * bulge * 0.48,
    y: mid.y + Math.sin(perp) * ((r0 + r1) / 2) * bulge * 0.48,
  };

  const outer0 = { x: p0.x + Math.cos(perp) * r0, y: p0.y + Math.sin(perp) * r0 };
  const outer1 = { x: p1.x + Math.cos(perp) * r1, y: p1.y + Math.sin(perp) * r1 };
  const inner0 = { x: p0.x - Math.cos(perp) * r0 * 0.68, y: p0.y - Math.sin(perp) * r0 * 0.68 };
  const inner1 = { x: p1.x - Math.cos(perp) * r1 * 0.68, y: p1.y - Math.sin(perp) * r1 * 0.68 };

  ctx.beginPath();
  ctx.moveTo(outer0.x, outer0.y);
  ctx.quadraticCurveTo(bulgePt.x, bulgePt.y, outer1.x, outer1.y);
  ctx.quadraticCurveTo((outer1.x + inner1.x) / 2, (outer1.y + inner1.y) / 2, inner1.x, inner1.y);
  ctx.quadraticCurveTo(mid.x - Math.cos(perp) * r0 * 0.15, mid.y - Math.sin(perp) * r0 * 0.15, inner0.x, inner0.y);
  ctx.quadraticCurveTo((outer0.x + inner0.x) / 2, (outer0.y + inner0.y) / 2, outer0.x, outer0.y);
  ctx.closePath();
  fillRegion(ctx, w);
}

function fillBlob(
  ctx: CanvasRenderingContext2D,
  center: Vec2,
  rx: number,
  ry: number,
  w: number,
  h: number,
  rotation = 0,
  alpha = FILL
) {
  const c = px(center, w, h);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx * w, ry * h, rotation, 0, Math.PI * 2);
  fillRegion(ctx, w, alpha);
}

function drawLeg(ctx: CanvasRenderingContext2D, leg: LegChain, side: 'left' | 'right', w: number, h: number) {
  const out = side === 'left' ? -1 : 1;
  fillLimbVolume(ctx, leg.hip, leg.knee, 0.064 * M, 0.052 * M, w, h, out as 1 | -1, 1.15);
  fillLimbVolume(ctx, leg.knee, leg.ankle, 0.048 * M, 0.038 * M, w, h, out as 1 | -1, 1.08);
  // Boot shaft + sole as solid volumes
  fillLimbVolume(ctx, leg.ankle, leg.foot, 0.034 * M, 0.042 * M, w, h, out as 1 | -1, 1.04);
  const f = px(leg.foot, w, h);
  ctx.beginPath();
  ctx.ellipse(f.x, f.y - h * 0.006, w * 0.044 * M, h * 0.015 * M, out * 0.12, 0, Math.PI * 2);
  fillRegion(ctx, w, FILL + 0.04);
}

function drawBoxingShorts(
  ctx: CanvasRenderingContext2D,
  pelvis: Vec2,
  leftHip: Vec2,
  rightHip: Vec2,
  w: number,
  h: number
) {
  const top = px({ x: pelvis.x, y: pelvis.y - 0.008 }, w, h);
  const hem = px({ x: pelvis.x, y: BODY_SCALE.shortsY }, w, h);
  const lHip = px(leftHip, w, h);
  const rHip = px(rightHip, w, h);
  const lLeg = px({ x: leftHip.x - 0.02 * M, y: BODY_SCALE.shortsY }, w, h);
  const rLeg = px({ x: rightHip.x + 0.02 * M, y: BODY_SCALE.shortsY }, w, h);

  ctx.beginPath();
  ctx.moveTo(lHip.x, top.y);
  ctx.lineTo(rHip.x, top.y);
  ctx.lineTo(rLeg.x, hem.y);
  ctx.quadraticCurveTo(hem.x, hem.y + h * 0.01, lLeg.x, hem.y);
  ctx.closePath();
  fillRegion(ctx, w, FILL + 0.06);
}

/** Arm as continuous organic volumes — IK joints drive shape but are never visible */
function drawArm(ctx: CanvasRenderingContext2D, arm: ArmChain, side: 'left' | 'right', w: number, h: number) {
  const out = side === 'left' ? -1 : 1;
  const { shoulder: s, elbow: e, wrist: wr, hand: hd } = arm;

  // Deltoid
  fillBlob(ctx, s, 0.05 * M, 0.034 * M, w, h, out * 0.22);

  // Upper arm (tricep from behind)
  fillLimbVolume(ctx, s, e, 0.054 * M, 0.046 * M, w, h, out as 1 | -1, 1.22);
  // Bicep bulk (inner)
  fillLimbVolume(ctx, lerp(s, e, 0.35), lerp(s, e, 0.65), 0.028 * M, 0.024 * M, w, h, (-out) as 1 | -1, 1.05);

  // Forearm — overlaps elbow to hide pivot
  fillLimbVolume(ctx, lerp(e, wr, 0.05), wr, 0.042 * M, 0.034 * M, w, h, out as 1 | -1, 1.1);

  // Wrist sleeve tapering into glove cuff
  fillLimbVolume(ctx, wr, hd, 0.03 * M, 0.024 * M, w, h, out as 1 | -1, 1);
  fillBlob(ctx, hd, 0.026 * M, 0.013 * M, w, h, Math.atan2(hd.y - wr.y, hd.x - wr.x), FILL + 0.05);
}

/** Soft white outer rim — one smooth silhouette, no bone paths */
function drawOuterGlow(
  ctx: CanvasRenderingContext2D,
  pose: BoxerSkeletonPose,
  w: number,
  h: number
) {
  const { head, leftArm, rightArm, leftLeg, rightLeg } = pose;
  const shL = px(leftArm.shoulder, w, h);
  const shR = px(rightArm.shoulder, w, h);
  const hd = px(head, w, h);
  const lf = px(leftLeg.foot, w, h);
  const rf = px(rightLeg.foot, w, h);
  const lHand = px(leftArm.hand, w, h);
  const rHand = px(rightArm.hand, w, h);

  ctx.beginPath();
  ctx.moveTo(hd.x, hd.y - h * 0.04 * M);
  ctx.quadraticCurveTo(shL.x - w * 0.04 * M, shL.y, lHand.x - w * 0.03 * M, lHand.y);
  ctx.quadraticCurveTo(lf.x - w * 0.04 * M, lf.y - h * 0.02, lf.x, lf.y);
  ctx.lineTo(rf.x, rf.y);
  ctx.quadraticCurveTo(rf.x + w * 0.04 * M, rf.y - h * 0.02, rHand.x + w * 0.03 * M, rHand.y);
  ctx.quadraticCurveTo(shR.x + w * 0.04 * M, shR.y, hd.x, hd.y - h * 0.04 * M);
  ctx.closePath();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = Math.max(2, w * 0.003);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(220, 245, 255, 0.9)';
  ctx.shadowBlur = w * 0.014;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

/** Complete full-body ghost boxer — finished character, no rig visuals */
export function drawFullGhostBoxer(
  ctx: CanvasRenderingContext2D,
  pose: BoxerSkeletonPose,
  width: number,
  height: number
) {
  const w = width;
  const h = height;
  const { head, neck, chest, pelvis, spineTwist, leftArm, rightArm, leftLeg, rightLeg } = pose;
  const cx = chest.x;
  const shL = px(leftArm.shoulder, w, h);
  const shR = px(rightArm.shoulder, w, h);

  // ── Legs + boots ──
  drawLeg(ctx, leftLeg, 'left', w, h);
  drawLeg(ctx, rightLeg, 'right', w, h);

  // ── Hips / glutes ──
  const gluteL = px({ x: pelvis.x - 0.1 * M, y: pelvis.y + 0.01 }, w, h);
  const gluteR = px({ x: pelvis.x + 0.1 * M, y: pelvis.y + 0.01 }, w, h);
  const gluteC = px({ x: pelvis.x, y: pelvis.y + 0.055 * M }, w, h);
  const pelTop = px({ x: pelvis.x, y: pelvis.y - 0.008 }, w, h);
  ctx.beginPath();
  ctx.moveTo(gluteL.x, gluteL.y);
  ctx.quadraticCurveTo(gluteC.x - w * 0.026, gluteC.y + h * 0.02, gluteC.x, gluteC.y);
  ctx.quadraticCurveTo(gluteC.x + w * 0.026, gluteC.y + h * 0.02, gluteR.x, gluteR.y);
  ctx.quadraticCurveTo(pelTop.x + w * 0.042, pelTop.y, pelTop.x - w * 0.042, pelTop.y);
  ctx.closePath();
  fillRegion(ctx, w, FILL_BODY);

  drawBoxingShorts(ctx, pelvis, leftLeg.hip, rightLeg.hip, w, h);

  // ── Lats (V-torso) ──
  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? -1 : 1;
    const sh = side === 'left' ? leftArm.shoulder : rightArm.shoulder;
    const latOuter = { x: cx + sign * 0.25 * M + spineTwist * sign * 0.07, y: chest.y + 0.03 };
    const waist = { x: pelvis.x + sign * 0.078 * M, y: BODY_SCALE.waistY };
    const pSh = px(sh, w, h);
    const pLat = px(latOuter, w, h);
    const pWaist = px(waist, w, h);
    const pInner = px({ x: cx + sign * 0.048, y: chest.y + 0.12 }, w, h);
    ctx.beginPath();
    ctx.moveTo(pSh.x, pSh.y);
    ctx.bezierCurveTo(pLat.x, pLat.y - h * 0.018, pLat.x, pLat.y + h * 0.035, pWaist.x, pWaist.y);
    ctx.quadraticCurveTo(pInner.x, pInner.y, pSh.x + sign * w * -0.028, pSh.y + h * 0.024);
    ctx.closePath();
    fillRegion(ctx, w);
  }

  // ── Back / chest volume ──
  const n = px(neck, w, h);
  const c = px(chest, w, h);
  const pel = px(pelvis, w, h);
  ctx.beginPath();
  ctx.moveTo(n.x - w * 0.033, n.y + h * 0.012);
  ctx.quadraticCurveTo(c.x - w * 0.046, c.y - h * 0.012, c.x - w * 0.036, c.y + h * 0.068);
  ctx.lineTo(pel.x - w * 0.022, pel.y - h * 0.026);
  ctx.lineTo(pel.x + w * 0.022, pel.y - h * 0.026);
  ctx.lineTo(c.x + w * 0.036, c.y + h * 0.068);
  ctx.quadraticCurveTo(c.x + w * 0.046, c.y - h * 0.012, n.x + w * 0.033, n.y + h * 0.012);
  ctx.closePath();
  fillRegion(ctx, w, FILL_BODY);

  // ── Traps ──
  const trapL = px({ x: leftArm.shoulder.x - 0.048, y: neck.y - 0.012 }, w, h);
  const trapR = px({ x: rightArm.shoulder.x + 0.048, y: neck.y - 0.012 }, w, h);
  const trapTop = px({ x: neck.x, y: neck.y - 0.03 }, w, h);
  ctx.beginPath();
  ctx.moveTo(trapL.x, trapL.y);
  ctx.bezierCurveTo(trapTop.x - w * 0.058, trapTop.y - h * 0.008, trapTop.x - w * 0.018, trapTop.y + h * 0.01, trapTop.x, trapTop.y + h * 0.018);
  ctx.bezierCurveTo(trapTop.x + w * 0.018, trapTop.y + h * 0.01, trapTop.x + w * 0.058, trapTop.y - h * 0.008, trapR.x, trapR.y);
  ctx.quadraticCurveTo(shR.x, shR.y, shL.x, shL.y);
  ctx.closePath();
  fillRegion(ctx, w, FILL + 0.02);

  // ── Neck + head (back, no face) ──
  fillBlob(ctx, { x: neck.x, y: neck.y + 0.028 }, 0.03 * M, 0.02 * M, w, h);
  const hp = px(head, w, h);
  const headTop = px({ x: head.x, y: BODY_SCALE.headTop }, w, h);
  ctx.beginPath();
  ctx.ellipse(hp.x, (hp.y + headTop.y) / 2, w * HEAD_WIDTH * 0.55, h * 0.044 * M, 0, 0, Math.PI * 2);
  fillRegion(ctx, w);
  fillBlob(ctx, { x: head.x, y: head.y - 0.01 }, 0.028 * M, 0.022 * M, w, h, 0, FILL_BODY);

  // ── Arms (organic volumes, IK hidden) ──
  drawArm(ctx, leftArm, 'left', w, h);
  drawArm(ctx, rightArm, 'right', w, h);

  // ── Single outer glow silhouette ──
  drawOuterGlow(ctx, pose, w, h);
}

/** Body layer (torso + legs) for z-ordering under bag overlap areas */
export function drawGhostBody(
  ctx: CanvasRenderingContext2D,
  pose: BoxerSkeletonPose,
  width: number,
  height: number
) {
  drawFullGhostBoxer(ctx, pose, width, height);
}

/** Arms drawn on same pass — kept for API compat; identical to full draw */
export function drawGhostArms(
  ctx: CanvasRenderingContext2D,
  pose: BoxerSkeletonPose,
  width: number,
  height: number
) {
  // Arms are part of drawFullGhostBoxer; this layer stays empty to avoid double-draw rig artifacts
  void ctx;
  void pose;
  void width;
  void height;
}

export function drawAnatomicalGhost(
  ctx: CanvasRenderingContext2D,
  pose: BoxerSkeletonPose,
  width: number,
  height: number
) {
  drawFullGhostBoxer(ctx, pose, width, height);
}
