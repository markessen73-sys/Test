import { useEffect, useRef } from 'react';
import type { BoxerSkeletonPose } from './types';
import { drawFullGhostBoxer } from './anatomicalBody';

export function GhostBoxerCanvas({ pose }: { pose: BoxerSkeletonPose }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef(pose);
  poseRef.current = pose;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas?.parentElement) {
        raf = requestAnimationFrame(loop);
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
      drawFullGhostBoxer(ctx, p, width, height);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="ghost-body-canvas" aria-hidden />;
}

/** @deprecated Use GhostBoxerCanvas */
export const GhostBodyCanvas = GhostBoxerCanvas;

/** @deprecated Arms are rendered in GhostBoxerCanvas — no separate layer */
export function GhostArmsCanvas(_props: { pose: BoxerSkeletonPose }) {
  return null;
}
