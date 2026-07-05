import type { ArmChain, BoxerSkeletonPose, LegChain, Vec2 } from './types';
import { BODY_SCALE, HEAD_WIDTH } from './types';

const M = BODY_SCALE.muscleScale;

function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function px(p: Vec2, w: number, h: number): Vec2 {
  return { x: p.x * w, y: p.y * h };
}

/** Stack soft elliptical muscle volumes along a bone segment. */
function drawMuscleAlongBone(
  ctx: CanvasRenderingContext2D,
  a: Vec2,
  b: Vec2,
  w: number,
  h: number,
  radiusNorm: number,
  stretch: number,
  samples: number,
  alpha: number,
  glow: number
) {
  const p0 = px(a, w, h);
  const p1 = px(b, w, h);
  const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const rx = radiusNorm * w;
  const ry = radiusNorm * h * stretch;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = p0.x + (p1.x - p0.x) * t;
    const y = p0.y + (p1.y - p0.y) * t;
    const bulge = 1 + Math.sin(t * Math.PI) * 0.22;
    ctx.beginPath();
    ctx.ellipse(x, y, rx * bulge, ry * bulge, angle, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rx * bulge);
    grad.addColorStop(0, `rgba(220, 245, 255, ${alpha})`);
    grad.addColorStop(0.55, `rgba(170, 220, 255, ${alpha * 0.75})`);
    grad.addColorStop(1, `rgba(120, 190, 240, ${alpha * 0.15})`);
    ctx.fillStyle = grad;
    ctx.shadowColor = `rgba(130, 210, 255, ${glow})`;
    ctx.shadowBlur = w * 0.014;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

/** Muscular capsule between two bones — bicep/tricep bulge on outer edge. */
function drawMuscleCapsule(
  ctx: CanvasRenderingContext2D,
  a: Vec2,
  b: Vec2,
  wStart: number,
  wEnd: number,
  w: number,
  h: number,
  outerSide: 1 | -1,
  bulge = 1.15
) {
  const p0 = px(a, w, h);
  const p1 = px(b, w, h);
  const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const perp = angle + (Math.PI / 2) * outerSide;
  const ws = wStart * w;
  const we = wEnd * w;
  const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const bulgePt = {
    x: mid.x + Math.cos(perp) * ws * bulge * 0.55,
    y: mid.y + Math.sin(perp) * ws * bulge * 0.55,
  };

  const o0a = { x: p0.x + Math.cos(perp) * ws, y: p0.y + Math.sin(perp) * ws };
  const o0b = { x: p0.x - Math.cos(perp) * ws * 0.75, y: p0.y - Math.sin(perp) * ws * 0.75 };
  const o1a = { x: p1.x + Math.cos(perp) * we, y: p1.y + Math.sin(perp) * we };
  const o1b = { x: p1.x - Math.cos(perp) * we * 0.75, y: p1.y - Math.sin(perp) * we * 0.75 };

  ctx.beginPath();
  ctx.moveTo(o0a.x, o0a.y);
  ctx.quadraticCurveTo(bulgePt.x, bulgePt.y, o1a.x, o1a.y);
  ctx.lineTo(o1b.x, o1b.y);
  ctx.quadraticCurveTo(mid.x - Math.cos(perp) * ws * 0.2, mid.y - Math.sin(perp) * ws * 0.2, o0b.x, o0b.y);
  ctx.closePath();
}

function fillVolume(ctx: CanvasRenderingContext2D, alpha: number, glow: number, w: number) {
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, `rgba(180, 225, 255, ${alpha * 0.85})`);
  grad.addColorStop(0.5, `rgba(220, 245, 255, ${alpha})`);
  grad.addColorStop(1, `rgba(180, 225, 255, ${alpha * 0.85})`);
  ctx.fillStyle = grad;
  ctx.shadowColor = `rgba(120, 200, 255, ${glow})`;
  ctx.shadowBlur = w * 0.02;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function strokeDetail(ctx: CanvasRenderingContext2D, w: number, alpha = 0.28) {
  ctx.strokeStyle = `rgba(200, 235, 255, ${alpha})`;
  ctx.lineWidth = Math.max(1, w * 0.002);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function drawFoot(ctx: CanvasRenderingContext2D, foot: Vec2, side: 'left' | 'right', w: number, h: number) {
  const sign = side === 'left' ? -1 : 1;
  const f = px(foot, w, h);
  ctx.beginPath();
  ctx.ellipse(f.x, f.y - h * 0.008, w * 0.04, h * 0.015, sign * 0.15, 0, Math.PI * 2);
  fillVolume(ctx, 0.24, 0.32, w);
  ctx.beginPath();
  ctx.ellipse(f.x - sign * w * 0.014, f.y - h * 0.012, w * 0.016, h * 0.011, 0, 0, Math.PI * 2);
  fillVolume(ctx, 0.2, 0.28, w);
}

function drawArm(ctx: CanvasRenderingContext2D, arm: ArmChain, side: 'left' | 'right', w: number, h: number) {
  const out = side === 'left' ? -1 : 1;
  const { shoulder: s, elbow: e, wrist: wr, hand: hd } = arm;

  // Bicep peek on inner upper arm (visible bulk from behind at guard)
  const biMid = lerp(s, e, 0.38);
  const bm = px(biMid, w, h);
  const biAngle = Math.atan2(e.y - s.y, e.x - s.x);
  ctx.beginPath();
  ctx.ellipse(
    bm.x - out * w * 0.014,
    bm.y + h * 0.003,
    w * 0.028 * M,
    h * 0.02 * M,
    biAngle,
    0,
    Math.PI * 2
  );
  fillVolume(ctx, 0.3, 0.4, w);

  // Deltoid — rounded cap
  const delt = px(s, w, h);
  ctx.beginPath();
  ctx.ellipse(delt.x + out * w * 0.01, delt.y + h * 0.005, w * 0.052, h * 0.036, out * 0.25, 0, Math.PI * 2);
  fillVolume(ctx, 0.34, 0.46, w);

  // Upper arm — tricep horseshoe (visible from behind) + bicep bulk
  drawMuscleAlongBone(ctx, s, e, w, h, 0.048, 1.35, 5, 0.28, 0.38);
  drawMuscleCapsule(ctx, s, e, 0.056, 0.048, w, h, out as 1 | -1, 1.3);
  fillVolume(ctx, 0.36, 0.5, w);

  // Forearm — brachioradialis bulk
  drawMuscleAlongBone(ctx, e, wr, w, h, 0.036, 1.25, 4, 0.26, 0.36);
  drawMuscleCapsule(ctx, e, wr, 0.042, 0.034, w, h, out as 1 | -1, 1.14);
  fillVolume(ctx, 0.34, 0.44, w);

  // Wrist → glove cuff (solid connector — never floating)
  drawMuscleCapsule(ctx, wr, hd, 0.032, 0.026, w, h, out as 1 | -1, 1.05);
  fillVolume(ctx, 0.42, 0.55, w);

  const cuff = px(hd, w, h);
  const cuffAngle = Math.atan2(hd.y - wr.y, hd.x - wr.x);
  ctx.beginPath();
  ctx.ellipse(cuff.x, cuff.y, w * 0.028, h * 0.014, cuffAngle, 0, Math.PI * 2);
  fillVolume(ctx, 0.45, 0.58, w);
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  leg: LegChain,
  side: 'left' | 'right',
  w: number,
  h: number
) {
  const out = side === 'left' ? -1 : 1;

  drawMuscleAlongBone(ctx, leg.hip, leg.knee, w, h, 0.058, 1.4, 5, 0.26, 0.38);
  drawMuscleCapsule(ctx, leg.hip, leg.knee, 0.068, 0.054, w, h, out as 1 | -1, 1.2);
  fillVolume(ctx, 0.32, 0.42, w);

  const hamMid = lerp(leg.hip, leg.knee, 0.45);
  const hm = px(hamMid, w, h);
  const hk = px(leg.knee, w, h);
  ctx.beginPath();
  ctx.moveTo(hm.x - out * w * 0.01, hm.y);
  ctx.quadraticCurveTo(hk.x - out * w * 0.018, hk.y - h * 0.016, hk.x, hk.y);
  strokeDetail(ctx, w, 0.18);

  drawMuscleAlongBone(ctx, leg.knee, leg.foot, w, h, 0.04, 1.3, 4, 0.24, 0.34);
  drawMuscleCapsule(ctx, leg.knee, leg.foot, 0.048, 0.036, w, h, out as 1 | -1, 1.12);
  fillVolume(ctx, 0.3, 0.4, w);

  const k = px(leg.knee, w, h);
  const f = px(leg.foot, w, h);
  ctx.beginPath();
  ctx.moveTo(k.x + out * w * 0.014, k.y);
  ctx.lineTo(f.x + out * w * 0.012, f.y - h * 0.014);
  strokeDetail(ctx, w, 0.22);

  drawFoot(ctx, leg.foot, side, w, h);
}

function drawSmokeWisps(
  ctx: CanvasRenderingContext2D,
  chest: Vec2,
  timeMs: number,
  w: number,
  h: number
) {
  const t = timeMs * 0.0004;
  const c = px(chest, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let i = 0; i < 8; i++) {
    const phase = t + i * 1.1;
    const angle = phase * 0.7 + i * 1.05;
    const radius = w * (0.16 + (i % 3) * 0.07);
    const x = c.x + Math.cos(angle) * radius;
    const y = c.y + h * (0.06 + i * 0.065) + Math.sin(phase * 1.3) * h * 0.025;
    const r = w * (0.07 + Math.sin(phase) * 0.025);

    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(160, 225, 255, ${0.06 + Math.sin(phase) * 0.02})`);
    grad.addColorStop(0.45, 'rgba(110, 200, 255, 0.03)');
    grad.addColorStop(1, 'rgba(70, 150, 220, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.65, angle * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawAnatomicalGhost(
  ctx: CanvasRenderingContext2D,
  pose: BoxerSkeletonPose,
  width: number,
  height: number
) {
  const w = width;
  const h = height;
  const { head, neck, chest, pelvis, spineTwist, leftArm, rightArm, leftLeg, rightLeg, time } = pose;
  const cx = chest.x;
  const shL = px(leftArm.shoulder, w, h);
  const shR = px(rightArm.shoulder, w, h);

  // ── Legs ──
  drawLeg(ctx, leftLeg, 'left', w, h);
  drawLeg(ctx, rightLeg, 'right', w, h);

  // ── Glutes ──
  const gluteL = px({ x: pelvis.x - 0.1 * M, y: pelvis.y + 0.012 }, w, h);
  const gluteR = px({ x: pelvis.x + 0.1 * M, y: pelvis.y + 0.012 }, w, h);
  const gluteC = px({ x: pelvis.x, y: pelvis.y + 0.058 * M }, w, h);
  const pelTop = px({ x: pelvis.x, y: pelvis.y - 0.006 }, w, h);

  ctx.beginPath();
  ctx.moveTo(gluteL.x, gluteL.y);
  ctx.quadraticCurveTo(gluteC.x - w * 0.028, gluteC.y + h * 0.022, gluteC.x, gluteC.y);
  ctx.quadraticCurveTo(gluteC.x + w * 0.028, gluteC.y + h * 0.022, gluteR.x, gluteR.y);
  ctx.quadraticCurveTo(pelTop.x + w * 0.045, pelTop.y, pelTop.x - w * 0.045, pelTop.y);
  ctx.closePath();
  fillVolume(ctx, 0.28, 0.36, w);

  // ── Lats — wide V-torso ──
  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? -1 : 1;
    const sh = side === 'left' ? leftArm.shoulder : rightArm.shoulder;
    const latOuter = { x: cx + sign * 0.26 * M + spineTwist * sign * 0.08, y: chest.y + 0.035 };
    const waist = { x: pelvis.x + sign * 0.08 * M, y: BODY_SCALE.waistY };
    const pSh = px(sh, w, h);
    const pLat = px(latOuter, w, h);
    const pWaist = px(waist, w, h);
    const pInner = px({ x: cx + sign * 0.05, y: chest.y + 0.13 }, w, h);

    ctx.beginPath();
    ctx.moveTo(pSh.x, pSh.y);
    ctx.bezierCurveTo(
      pLat.x, pLat.y - h * 0.02,
      pLat.x, pLat.y + h * 0.04,
      pWaist.x, pWaist.y
    );
    ctx.quadraticCurveTo(pInner.x, pInner.y, pSh.x + sign * w * -0.03, pSh.y + h * 0.028);
    ctx.closePath();
    fillVolume(ctx, 0.3, 0.4, w);
  }

  // ── Upper / lower back (erector spinae) ──
  const n = px(neck, w, h);
  const c = px(chest, w, h);
  const pel = px(pelvis, w, h);
  ctx.beginPath();
  ctx.moveTo(n.x - w * 0.034, n.y + h * 0.014);
  ctx.quadraticCurveTo(c.x - w * 0.048, c.y - h * 0.01, c.x - w * 0.038, c.y + h * 0.07);
  ctx.lineTo(pel.x - w * 0.024, pel.y - h * 0.028);
  ctx.lineTo(pel.x + w * 0.024, pel.y - h * 0.028);
  ctx.lineTo(c.x + w * 0.038, c.y + h * 0.07);
  ctx.quadraticCurveTo(c.x + w * 0.048, c.y - h * 0.01, n.x + w * 0.034, n.y + h * 0.014);
  ctx.closePath();
  fillVolume(ctx, 0.26, 0.34, w);

  ctx.beginPath();
  ctx.moveTo(n.x, n.y + h * 0.02);
  ctx.lineTo(pel.x + spineTwist * w * 0.05, pel.y - h * 0.038);
  strokeDetail(ctx, w, 0.32);

  // ── Traps — broad, flowing to neck ──
  const trapL = px({ x: leftArm.shoulder.x - 0.05, y: neck.y - 0.014 }, w, h);
  const trapR = px({ x: rightArm.shoulder.x + 0.05, y: neck.y - 0.014 }, w, h);
  const trapTop = px({ x: neck.x, y: neck.y - 0.032 }, w, h);
  ctx.beginPath();
  ctx.moveTo(trapL.x, trapL.y);
  ctx.bezierCurveTo(trapTop.x - w * 0.06, trapTop.y - h * 0.01, trapTop.x - w * 0.02, trapTop.y + h * 0.01, trapTop.x, trapTop.y + h * 0.02);
  ctx.bezierCurveTo(trapTop.x + w * 0.02, trapTop.y + h * 0.01, trapTop.x + w * 0.06, trapTop.y - h * 0.01, trapR.x, trapR.y);
  ctx.quadraticCurveTo(shR.x, shR.y, shL.x, shL.y);
  ctx.closePath();
  fillVolume(ctx, 0.34, 0.46, w);

  // ── Narrow waist contour ──
  const waistL = px({ x: pelvis.x - 0.072, y: BODY_SCALE.waistY }, w, h);
  const waistR = px({ x: pelvis.x + 0.072, y: BODY_SCALE.waistY }, w, h);
  ctx.beginPath();
  ctx.moveTo(waistL.x, waistL.y);
  ctx.quadraticCurveTo(pel.x, waistL.y + h * 0.018, waistR.x, waistR.y);
  strokeDetail(ctx, w, 0.22);

  // ── Neck ──
  const neckBase = px({ x: neck.x, y: neck.y + 0.03 }, w, h);
  ctx.beginPath();
  ctx.ellipse(neckBase.x, neckBase.y, w * 0.032, h * 0.022, 0, 0, Math.PI * 2);
  fillVolume(ctx, 0.28, 0.38, w);

  // ── Head (back of skull) ──
  const hp = px(head, w, h);
  const headTop = px({ x: head.x, y: BODY_SCALE.headTop }, w, h);
  ctx.beginPath();
  ctx.ellipse(hp.x, (hp.y + headTop.y) / 2, w * HEAD_WIDTH * 0.56, h * 0.046, 0, 0, Math.PI * 2);
  fillVolume(ctx, 0.32, 0.42, w);
  ctx.beginPath();
  ctx.ellipse(hp.x, hp.y - h * 0.01, w * 0.03, h * 0.024, 0, 0, Math.PI * 2);
  fillVolume(ctx, 0.24, 0.32, w);

  // ── Arms (shoulder → glove cuff) ──
  drawArm(ctx, leftArm, 'left', w, h);
  drawArm(ctx, rightArm, 'right', w, h);

  // ── Anatomical detail strokes ──
  ctx.beginPath();
  ctx.moveTo(n.x - w * 0.03, n.y);
  ctx.lineTo(trapL.x, trapL.y);
  ctx.moveTo(n.x + w * 0.03, n.y);
  ctx.lineTo(trapR.x, trapR.y);

  for (const side of [-1, 1] as const) {
    const latY = px({ x: cx + side * 0.2, y: chest.y + 0.1 }, w, h);
    const waistP = px({ x: pelvis.x + side * 0.07, y: BODY_SCALE.waistY }, w, h);
    const midLat = px({ x: cx + side * 0.12, y: chest.y + 0.16 }, w, h);
    ctx.moveTo(latY.x, latY.y);
    ctx.quadraticCurveTo(midLat.x, midLat.y, waistP.x, waistP.y);
  }

  for (const arm of [leftArm, rightArm]) {
    const mid = lerp(arm.shoulder, arm.elbow, 0.5);
    const m = px(mid, w, h);
    const e = px(arm.elbow, w, h);
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(e.x, e.y);
  }

  ctx.moveTo(shL.x + w * 0.012, shL.y + h * 0.022);
  ctx.lineTo(px({ x: chest.x - 0.045, y: chest.y + 0.045 }, w, h).x, px({ x: chest.x - 0.045, y: chest.y + 0.045 }, w, h).y);
  ctx.moveTo(shR.x - w * 0.012, shR.y + h * 0.022);
  ctx.lineTo(px({ x: chest.x + 0.045, y: chest.y + 0.045 }, w, h).x, px({ x: chest.x + 0.045, y: chest.y + 0.045 }, w, h).y);
  strokeDetail(ctx, w, 0.24);

  drawSmokeWisps(ctx, chest, time, w, h);

  // ── Unified outer silhouette (readable human form) ──
  ctx.beginPath();
  ctx.moveTo(shL.x, shL.y);
  ctx.lineTo(px(leftLeg.foot, w, h).x - w * 0.04 * M, px(leftLeg.foot, w, h).y);
  ctx.lineTo(px(rightLeg.foot, w, h).x + w * 0.04 * M, px(rightLeg.foot, w, h).y);
  ctx.lineTo(shR.x, shR.y);
  ctx.quadraticCurveTo(px(head, w, h).x + w * 0.06 * M, px(head, w, h).y, px(head, w, h).x - w * 0.06 * M, px(head, w, h).y);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(190, 230, 255, 0.12)';
  ctx.lineWidth = Math.max(1.5, w * 0.003);
  ctx.stroke();

  // ── Full-figure halo ──
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, w * 0.46);
  glow.addColorStop(0, 'rgba(180, 230, 255, 0.12)');
  glow.addColorStop(0.55, 'rgba(130, 210, 255, 0.05)');
  glow.addColorStop(1, 'rgba(90, 170, 230, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, h * BODY_SCALE.viewTop, w, h * (1 - BODY_SCALE.viewTop));
  ctx.restore();
}
