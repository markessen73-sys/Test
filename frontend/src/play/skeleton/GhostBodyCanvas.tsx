import { useEffect, useRef } from 'react';
import type { BoxerSkeletonPose } from './types';
import { drawGhostBody, drawGhostArms } from './anatomicalBody';

function useGhostCanvas(pose: BoxerSkeletonPose, draw: typeof drawGhostBody) {
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
      draw(ctx, p, width, height);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  return canvasRef;
}

export function GhostBodyCanvas({ pose }: { pose: BoxerSkeletonPose }) {
  const ref = useGhostCanvas(pose, drawGhostBody);
  return <canvas ref={ref} className="ghost-body-canvas" aria-hidden />;
}

export function GhostArmsCanvas({ pose }: { pose: BoxerSkeletonPose }) {
  const ref = useGhostCanvas(pose, drawGhostArms);
  return <canvas ref={ref} className="ghost-arms-canvas" aria-hidden />;
}
