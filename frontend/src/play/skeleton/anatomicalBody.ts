import type { BoxerSkeletonPose } from './types';
import { BODY_SCALE } from './types';
import { buildAnatomicalGhostMesh } from './ghostMesh';

/**
 * Single unified ghost silhouette — IK shapes the mesh internally, never drawn.
 */
export function drawFullGhostBoxer(
  ctx: CanvasRenderingContext2D,
  pose: BoxerSkeletonPose,
  width: number,
  height: number
) {
  const mesh = buildAnatomicalGhostMesh(pose);
  const body = new Path2D(mesh.silhouette);
  const shorts = new Path2D(mesh.muscleDetail);

  ctx.save();
  ctx.scale(width, height);

  // Outer glow
  ctx.shadowColor = 'rgba(210, 240, 255, 0.75)';
  ctx.shadowBlur = 0.024;
  ctx.fillStyle = 'rgba(190, 225, 255, 0.1)';
  ctx.fill(body);
  ctx.shadowBlur = 0;

  // Pale-blue translucent fill
  const grad = ctx.createLinearGradient(0, BODY_SCALE.viewTop, 0, 1);
  grad.addColorStop(0, 'rgba(205, 235, 255, 0.38)');
  grad.addColorStop(0.4, 'rgba(175, 215, 245, 0.36)');
  grad.addColorStop(1, 'rgba(150, 195, 235, 0.32)');
  ctx.fillStyle = grad;
  ctx.fill(body);

  // Shoulder/back depth shading (gradient only — no lines)
  ctx.save();
  ctx.clip(body);
  const cx = pose.chest.x;
  const cy = pose.chest.y;
  const depth = ctx.createRadialGradient(cx, cy - 0.05, 0, cx, cy, 0.28);
  depth.addColorStop(0, 'rgba(225, 245, 255, 0.14)');
  depth.addColorStop(0.6, 'rgba(180, 220, 250, 0.06)');
  depth.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = depth;
  ctx.fillRect(0, BODY_SCALE.viewTop, 1, 1 - BODY_SCALE.viewTop);
  ctx.restore();

  // Boxing shorts
  ctx.fillStyle = 'rgba(155, 195, 230, 0.44)';
  ctx.fill(shorts);

  // Soft white outline on body edge only
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 0.0038;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.45)';
  ctx.shadowBlur = 0.009;
  ctx.stroke(body);
  ctx.shadowBlur = 0;

  ctx.restore();
}

export const drawGhostBody = drawFullGhostBoxer;
export const drawGhostArms = drawFullGhostBoxer;
export const drawAnatomicalGhost = drawFullGhostBoxer;
