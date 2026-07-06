import type { ArmChain, BoxerSkeletonPose, LegChain, Vec2 } from './types';
import { BODY_SCALE, HEAD_WIDTH } from './types';

const M = BODY_SCALE.muscleScale;
const FILL = 0.35;
const FILL_SOFT = 0.28;
const OUTLINE = 0.72;
const MUSCLE_LINE = 0.38;

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function px(p: Vec2, w: number, h: number): Vec2 {
  return { x: p.x * w, y: p.y * h };
}

function fillGhost(ctx: CanvasRenderingContext2D, w: number, alpha = FILL) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, `rgba(175, 215, 245, ${alpha * 0.9})`);
  g.addColorStop(0.5, `rgba(210, 235, 255, ${alpha})`);
  g.addColorStop(1, `rgba(175, 215, 245, ${alpha * 0.9})`);
  ctx.fillStyle = g;
  ctx.fill();
}

function strokeGhost(ctx: CanvasRenderingContext2D, w: number, alpha = MUSCLE_LINE, widthMul = 1) {
  ctx.strokeStyle = `rgba(235, 248, 255, ${alpha})`;
  ctx.lineWidth = Math.max(1, w * 0.0018 * widthMul);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function strokeOutline(ctx: CanvasRenderingContext2D, w: number) {
  ctx.strokeStyle = `rgba(255, 255, 255, ${OUTLINE})`;
  ctx.lineWidth = Math.max(1.5, w * 0.0028);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(200, 235, 255, 0.85)';
  ctx.shadowBlur = w * 0.012;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function muscleCapsule(
  ctx: CanvasRenderingContext2D,
  a: Vec2,
  b: Vec2,
  wStart: number,
  wEnd: number,
  w: number,
  h: number,
  side: 1 | -1,
  bulge = 1.12
) {
  const p0 = px(a, w, h);
  const p1 = px(b, w, h);
  const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const perp = ang + (Math.PI / 2) * side;
  const ws = wStart * w;
  const we = wEnd * w;
  const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const bulgePt = {
    x: mid.x + Math.cos(perp) * ws * bulge * 0.5,
    y: mid.y + Math.sin(perp) * ws * bulge * 0.5,
  };
  const o0a = { x: p0.x + Math.cos(perp) * ws, y: p0.y + Math.sin(perp) * ws };
  const o0b = { x: p0.x - Math.cos(perp) * ws * 0.72, y: p0.y - Math.sin(perp) * ws * 0.72 };
  const o1a = { x: p1.x + Math.cos(perp) * we, y: p1.y + Math.sin(perp) * we };
  const o1b = { x: p1.x - Math.cos(perp) * we * 0.72, y: p1.y - Math.sin(perp) * we * 0.72 };
  ctx.beginPath();
  ctx.moveTo(o0a.x, o0a.y);
  ctx.quadraticCurveTo(bulgePt.x, bulgePt.y, o1a.x, o1a.y);
  ctx.lineTo(o1b.x, o1b.y);
  ctx.quadraticCurveTo(mid.x, mid.y, o0b.x, o0b.y);
  ctx.closePath();
}

function drawKnee(ctx: CanvasRenderingContext2D, knee: Vec2, side: 'left' | 'right', w: number, h: number) {
  const k = px(knee, w, h);
  const sign = side === 'left' ? -1 : 1;
  ctx.beginPath();
  ctx.ellipse(k.x + sign * w * 0.006, k.y, w * 0.022 * M, h * 0.016 * M, 0, 0, Math.PI * 2);
  fillGhost(ctx, w, FILL_SOFT);
  strokeGhost(ctx, w, 0.3, 0.8);
}

function drawAnkle(ctx: CanvasRenderingContext2D, ankle: Vec2, side: 'left' | 'right', w: number, h: number) {
  const a = px(ankle, w, h);
  const sign = side === 'left' ? -1 : 1;
  ctx.beginPath();
  ctx.ellipse(a.x + sign * w * 0.004, a.y, w * 0.018 * M, h * 0.012 * M, sign * 0.2, 0, Math.PI * 2);
  fillGhost(ctx, w, FILL_SOFT);
}

function drawBoxingBoot(
  ctx: CanvasRenderingContext2D,
  ankle: Vec2,
  foot: Vec2,
  side: 'left' | 'right',
  w: number,
  h: number
) {
  const sign = side === 'left' ? -1 : 1;
  const f = px(foot, w, h);

  // Boot shaft
  muscleCapsule(ctx, ankle, foot, 0.034, 0.04, w, h, sign as 1 | -1, 1.05);
  fillGhost(ctx, w, FILL + 0.04);

  // Boot sole
  ctx.beginPath();
  ctx.ellipse(f.x, f.y - h * 0.006, w * 0.044 * M, h * 0.016 * M, sign * 0.12, 0, Math.PI * 2);
  fillGhost(ctx, w, FILL + 0.06);

  // Heel block
  ctx.beginPath();
  ctx.ellipse(f.x - sign * w * 0.016, f.y - h * 0.014, w * 0.018 * M, h * 0.012 * M, 0, 0, Math.PI * 2);
  fillGhost(ctx, w, FILL_SOFT);
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
  ctx.quadraticCurveTo(hem.x, hem.y + h * 0.012, lLeg.x, hem.y);
  ctx.closePath();
  fillGhost(ctx, w, FILL + 0.05);

  // Waistband
  ctx.beginPath();
  ctx.moveTo(lHip.x, top.y);
  ctx.lineTo(rHip.x, top.y);
  strokeGhost(ctx, w, 0.45, 1.2);

  // Leg openings
  ctx.beginPath();
  ctx.moveTo(lLeg.x, hem.y);
  ctx.quadraticCurveTo(lHip.x, hem.y - h * 0.008, lHip.x, top.y);
  ctx.moveTo(rLeg.x, hem.y);
  ctx.quadraticCurveTo(rHip.x, hem.y - h * 0.008, rHip.x, top.y);
  strokeGhost(ctx, w, 0.32, 0.9);
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  leg: LegChain,
  side: 'left' | 'right',
  w: number,
  h: number
) {
  const sign = side === 'left' ? -1 : 1;

  // Thigh
  muscleCapsule(ctx, leg.hip, leg.knee, 0.064, 0.052, w, h, sign as 1 | -1, 1.18);
  fillGhost(ctx, w);
  const hamMid = lerp(leg.hip, leg.knee, 0.42);
  ctx.beginPath();
  ctx.moveTo(px(hamMid, w, h).x - sign * w * 0.008, px(hamMid, w, h).y);
  ctx.quadraticCurveTo(px(leg.knee, w, h).x, px(leg.knee, w, h).y - h * 0.014, px(leg.knee, w, h).x, px(leg.knee, w, h).y);
  strokeGhost(ctx, w, 0.28);

  drawKnee(ctx, leg.knee, side, w, h);

  // Calf
  muscleCapsule(ctx, leg.knee, leg.ankle, 0.046, 0.036, w, h, sign as 1 | -1, 1.1);
  fillGhost(ctx, w, FILL);
  ctx.beginPath();
  ctx.moveTo(px(leg.knee, w, h).x + sign * w * 0.012, px(leg.knee, w, h).y);
  ctx.lineTo(px(leg.ankle, w, h).x + sign * w * 0.01, px(leg.ankle, w, h).y - h * 0.01);
  strokeGhost(ctx, w, 0.3);

  drawAnkle(ctx, leg.ankle, side, w, h);
  drawBoxingBoot(ctx, leg.ankle, leg.foot, side, w, h);
}

function drawShoulderCap(
  ctx: CanvasRenderingContext2D,
  shoulder: Vec2,
  side: 'left' | 'right',
  w: number,
  h: number
) {
  const sign = side === 'left' ? -1 : 1;
  const s = px(shoulder, w, h);
  ctx.beginPath();
  ctx.ellipse(s.x + sign * w * 0.01, s.y + h * 0.004, w * 0.05 * M, h * 0.034 * M, sign * 0.22, 0, Math.PI * 2);
  fillGhost(ctx, w, FILL);
}

/** Full body without arms — head through boots */
export function drawGhostBody(
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

  // ── Legs (full length: thigh → knee → calf → ankle → boot) ──
  drawLeg(ctx, leftLeg, 'left', w, h);
  drawLeg(ctx, rightLeg, 'right', w, h);

  // ── Glutes / hips ──
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
  fillGhost(ctx, w, FILL);

  // ── Boxing shorts ──
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
    fillGhost(ctx, w);
  }

  // ── Back muscles (erector spinae + rhomboids) ──
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
  fillGhost(ctx, w, FILL_SOFT);

  ctx.beginPath();
  ctx.moveTo(n.x, n.y + h * 0.018);
  ctx.lineTo(pel.x + spineTwist * w * 0.048, pel.y - h * 0.036);
  strokeGhost(ctx, w, 0.35);

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
  fillGhost(ctx, w, FILL + 0.02);

  // ── Waist ──
  const waistL = px({ x: pelvis.x - 0.07, y: BODY_SCALE.waistY }, w, h);
  const waistR = px({ x: pelvis.x + 0.07, y: BODY_SCALE.waistY }, w, h);
  ctx.beginPath();
  ctx.moveTo(waistL.x, waistL.y);
  ctx.quadraticCurveTo(pel.x, waistL.y + h * 0.016, waistR.x, waistR.y);
  strokeGhost(ctx, w, 0.32);

  // ── Neck ──
  const neckBase = px({ x: neck.x, y: neck.y + 0.028 }, w, h);
  ctx.beginPath();
  ctx.ellipse(neckBase.x, neckBase.y, w * 0.03 * M, h * 0.02 * M, 0, 0, Math.PI * 2);
  fillGhost(ctx, w, FILL);

  // ── Head (back, no face) ──
  const hp = px(head, w, h);
  const headTop = px({ x: head.x, y: BODY_SCALE.headTop }, w, h);
  ctx.beginPath();
  ctx.ellipse(hp.x, (hp.y + headTop.y) / 2, w * HEAD_WIDTH * 0.55, h * 0.044 * M, 0, 0, Math.PI * 2);
  fillGhost(ctx, w, FILL);
  ctx.beginPath();
  ctx.ellipse(hp.x, hp.y - h * 0.01, w * 0.028 * M, h * 0.022 * M, 0, 0, Math.PI * 2);
  fillGhost(ctx, w, FILL_SOFT);

  // ── Shoulder caps (deltoids, no arm segments) ──
  drawShoulderCap(ctx, leftArm.shoulder, 'left', w, h);
  drawShoulderCap(ctx, rightArm.shoulder, 'right', w, h);

  // ── Muscle contour lines ──
  ctx.beginPath();
  ctx.moveTo(n.x - w * 0.028, n.y);
  ctx.lineTo(trapL.x, trapL.y);
  ctx.moveTo(n.x + w * 0.028, n.y);
  ctx.lineTo(trapR.x, trapR.y);
  for (const side of [-1, 1] as const) {
    const latY = px({ x: cx + side * 0.19, y: chest.y + 0.09 }, w, h);
    const waistP = px({ x: pelvis.x + side * 0.068, y: BODY_SCALE.waistY }, w, h);
    const midLat = px({ x: cx + side * 0.11, y: chest.y + 0.15 }, w, h);
    ctx.moveTo(latY.x, latY.y);
    ctx.quadraticCurveTo(midLat.x, midLat.y, waistP.x, waistP.y);
  }
  strokeGhost(ctx, w, 0.28);

  // ── Full-body white glowing outline ──
  const lf = px(leftLeg.foot, w, h);
  const rf = px(rightLeg.foot, w, h);
  const hd = px(head, w, h);
  ctx.beginPath();
  ctx.moveTo(shL.x, shL.y);
  ctx.lineTo(lf.x - w * 0.038 * M, lf.y);
  ctx.lineTo(rf.x + w * 0.038 * M, rf.y);
  ctx.lineTo(shR.x, shR.y);
  ctx.quadraticCurveTo(hd.x + w * 0.058 * M, hd.y, hd.x - w * 0.058 * M, hd.y);
  ctx.closePath();
  strokeOutline(ctx, w);
}

function drawArmSegment(
  ctx: CanvasRenderingContext2D,
  arm: ArmChain,
  side: 'left' | 'right',
  w: number,
  h: number
) {
  const sign = side === 'left' ? -1 : 1;
  const { shoulder: s, elbow: e, wrist: wr, hand: hd } = arm;

  // Bicep (inner bulk)
  const biMid = lerp(s, e, 0.4);
  const bm = px(biMid, w, h);
  const biAng = Math.atan2(e.y - s.y, e.x - s.x);
  ctx.beginPath();
  ctx.ellipse(bm.x - sign * w * 0.013, bm.y + h * 0.002, w * 0.026 * M, h * 0.019 * M, biAng, 0, Math.PI * 2);
  fillGhost(ctx, w, FILL);

  // Tricep (outer — visible from behind)
  muscleCapsule(ctx, s, e, 0.054, 0.046, w, h, sign as 1 | -1, 1.26);
  fillGhost(ctx, w, FILL + 0.02);

  // Forearm
  muscleCapsule(ctx, e, wr, 0.04, 0.032, w, h, sign as 1 | -1, 1.12);
  fillGhost(ctx, w, FILL);

  // Wrist → glove cuff connector (IK hand target)
  muscleCapsule(ctx, wr, hd, 0.028, 0.022, w, h, sign as 1 | -1, 1);
  fillGhost(ctx, w, FILL + 0.04);

  // Arm outline
  ctx.beginPath();
  const pts = [s, e, wr, hd].map((p) => px(p, w, h));
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  strokeOutline(ctx, w);
}

/** Arms layer — upper arm, forearm, wrist; sits above body, below gloves */
export function drawGhostArms(
  ctx: CanvasRenderingContext2D,
  pose: BoxerSkeletonPose,
  width: number,
  height: number
) {
  drawArmSegment(ctx, pose.leftArm, 'left', width, height);
  drawArmSegment(ctx, pose.rightArm, 'right', width, height);
}

/** @deprecated Use drawGhostBody + drawGhostArms */
export function drawAnatomicalGhost(
  ctx: CanvasRenderingContext2D,
  pose: BoxerSkeletonPose,
  width: number,
  height: number
) {
  drawGhostBody(ctx, pose, width, height);
  drawGhostArms(ctx, pose, width, height);
}
