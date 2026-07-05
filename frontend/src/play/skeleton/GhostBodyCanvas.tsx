import { useEffect, useRef } from 'react';
import type { BoxerSkeletonPose } from './types';
import { buildAnatomicalGhostMesh } from './ghostMesh';

interface GhostBodyCanvasProps {
  pose: BoxerSkeletonPose;
}

function drawSilhouettePath(ctx: CanvasRenderingContext2D, d: string) {
  const parts = d.match(/[MLQZ][^MLQZ]*/gi);
  if (!parts) return;
  ctx.beginPath();
  for (const part of parts) {
    const cmd = part[0];
    const nums = part
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => !Number.isNaN(n));
    if (cmd === 'M' && nums.length >= 2) ctx.moveTo(nums[0], nums[1]);
    if (cmd === 'L' && nums.length >= 2) ctx.lineTo(nums[0], nums[1]);
    if (cmd === 'Q' && nums.length >= 4) ctx.quadraticCurveTo(nums[0], nums[1], nums[2], nums[3]);
    if (cmd === 'Z') ctx.closePath();
  }
}

function drawMuscleStrokes(ctx: CanvasRenderingContext2D, d: string, w: number, h: number, alpha: number) {
  const strokes = d.split(/M\s/).filter(Boolean);
  ctx.strokeStyle = `rgba(210, 245, 255, ${alpha})`;
  ctx.lineWidth = Math.max(1.5, w * 0.002);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    const seg = 'M ' + s;
    drawSilhouettePath(ctx, seg.replace(/(\d+\.?\d*)\s+(\d+\.?\d*)/g, (_, x, y) => `${+x * w} ${+y * h}`));
    ctx.stroke();
  }
}

export function GhostBodyCanvas({ pose }: GhostBodyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef(pose);
  poseRef.current = pose;

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas?.parentElement) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const p = poseRef.current;
      const mesh = buildAnatomicalGhostMesh(p);
      const { width, height } = canvas.parentElement.getBoundingClientRect();
      const dpr = devicePixelRatio || 1;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const scaledPath = mesh.silhouette.replace(
        /(\d+\.?\d*)\s+(\d+\.?\d*)/g,
        (_, x, y) => `${+x * width} ${+y * height}`
      );

      // Outer spirit halo
      ctx.save();
      ctx.shadowColor = 'rgba(120, 200, 255, 0.9)';
      ctx.shadowBlur = width * 0.06;
      drawSilhouettePath(ctx, scaledPath);
      ctx.fillStyle = 'rgba(160, 220, 255, 0.12)';
      ctx.fill();
      ctx.restore();

      // Volumetric body fill
      ctx.save();
      ctx.shadowColor = 'rgba(180, 230, 255, 0.5)';
      ctx.shadowBlur = width * 0.025;
      drawSilhouettePath(ctx, scaledPath);
      const grad = ctx.createRadialGradient(
        width * p.chest.x,
        height * p.chest.y,
        0,
        width * p.chest.x,
        height * p.chest.y,
        width * 0.45
      );
      grad.addColorStop(0, 'rgba(230, 250, 255, 0.42)');
      grad.addColorStop(0.45, 'rgba(190, 230, 255, 0.22)');
      grad.addColorStop(1, 'rgba(140, 200, 240, 0.04)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      // Second fill — edge luminosity
      drawSilhouettePath(ctx, scaledPath);
      const edgeGrad = ctx.createLinearGradient(0, height * 0.35, 0, height);
      edgeGrad.addColorStop(0, 'rgba(240, 252, 255, 0.18)');
      edgeGrad.addColorStop(1, 'rgba(150, 210, 250, 0.08)');
      ctx.fillStyle = edgeGrad;
      ctx.globalCompositeOperation = 'screen';
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // Bright rim
      drawSilhouettePath(ctx, scaledPath);
      ctx.strokeStyle = `rgba(220, 248, 255, ${p.punchDrive > 0.1 ? 0.85 : 0.65})`;
      ctx.lineWidth = Math.max(2.5, width * 0.004);
      ctx.stroke();

      // Muscle detail
      drawMuscleStrokes(ctx, mesh.muscleDetail, width, height, 0.35);
      drawMuscleStrokes(ctx, mesh.wisps, width, height, 0.2);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="ghost-body-canvas" aria-hidden />;
}
