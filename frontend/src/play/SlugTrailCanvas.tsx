import { useEffect, useRef } from 'react';
import type { GloveState } from '../types/game';

interface SlugTrailCanvasProps {
  left: GloveState;
  right: GloveState;
}

export function SlugTrailCanvas({ left, right }: SlugTrailCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let frame: number;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const drawTrail = (glove: GloveState) => {
        const pts = glove.trail;
        if (pts.length < 2) return;

        const now = performance.now();
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          const age = (now - b.t) / 520;
          const alpha = Math.max(0, 1 - age);
          if (alpha <= 0) continue;

          const isImpact = b.isPunch || a.isPunch;
          const width = (isImpact ? 18 : 8) * alpha;

          ctx.save();
          ctx.strokeStyle = isImpact ? 'rgba(255, 245, 230, 0.55)' : 'rgba(210, 225, 240, 0.38)';
          ctx.globalAlpha = alpha * (isImpact ? 0.75 : 0.5);
          ctx.lineWidth = width;
          ctx.lineCap = 'round';
          ctx.shadowColor = isImpact ? 'rgba(255, 255, 255, 0.65)' : 'rgba(200, 220, 255, 0.45)';
          ctx.shadowBlur = isImpact ? 16 : 10;
          ctx.beginPath();
          ctx.moveTo(a.x * w, a.y * h);
          ctx.lineTo(b.x * w, b.y * h);
          ctx.stroke();
          ctx.restore();

          if (!isImpact) {
            ctx.save();
            ctx.fillStyle = 'rgba(235, 245, 255, 0.28)';
            ctx.globalAlpha = alpha * 0.35;
            ctx.beginPath();
            ctx.arc(b.x * w, b.y * h, width * 0.55, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 250, 240, 0.45)';
            ctx.globalAlpha = alpha * 0.5;
            ctx.beginPath();
            ctx.arc(b.x * w, b.y * h, width * 0.9, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      };

      drawTrail(left);
      drawTrail(right);

      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [left.trail, right.trail]);

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas?.parentElement) return;
      const { width, height } = canvas.parentElement.getBoundingClientRect();
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return <canvas ref={canvasRef} className="slug-trail-canvas" />;
}
