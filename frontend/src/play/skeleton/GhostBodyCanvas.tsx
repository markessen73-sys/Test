import { useEffect, useRef } from 'react';
import type { BoxerSkeletonPose } from './types';
import { BODY_SCALE } from './types';
import { drawAnatomicalGhost } from './anatomicalBody';

interface GhostBodyCanvasProps {
  pose: BoxerSkeletonPose;
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

      // Smoky blue backdrop behind the figure
      const smoke = ctx.createLinearGradient(0, height * BODY_SCALE.viewTop, 0, height);
      smoke.addColorStop(0, 'rgba(100, 180, 240, 0.04)');
      smoke.addColorStop(0.5, 'rgba(80, 160, 230, 0.07)');
      smoke.addColorStop(1, 'rgba(60, 140, 210, 0.1)');
      ctx.fillStyle = smoke;
      ctx.fillRect(0, height * BODY_SCALE.viewTop, width, height * (1 - BODY_SCALE.viewTop));

      drawAnatomicalGhost(ctx, p, width, height);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="ghost-body-canvas" aria-hidden />;
}
