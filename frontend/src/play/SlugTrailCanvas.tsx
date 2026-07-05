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

      const drawTrail = (glove: GloveState, baseColor: string, punchColor: string) => {
        const pts = glove.trail;
        if (pts.length < 2) return;

        const now = performance.now();
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          const age = (now - b.t) / 600;
          const alpha = Math.max(0, 1 - age);
          if (alpha <= 0) continue;

          const isPunch = b.isPunch || a.isPunch;
          const width = (isPunch ? 28 : 14) * alpha;
          const blur = isPunch ? 12 : 6;

          ctx.save();
          ctx.strokeStyle = isPunch ? punchColor : baseColor;
          ctx.globalAlpha = alpha * (isPunch ? 0.7 : 0.4);
          ctx.lineWidth = width;
          ctx.lineCap = 'round';
          ctx.shadowColor = isPunch ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.4)';
          ctx.shadowBlur = blur;
          ctx.beginPath();
          ctx.moveTo(a.x * w, a.y * h);
          ctx.lineTo(b.x * w, b.y * h);
          ctx.stroke();
          ctx.restore();

          // Slug blob at punch points
          if (isPunch) {
            ctx.save();
            ctx.fillStyle = 'rgba(20, 10, 5, 0.55)';
            ctx.globalAlpha = alpha * 0.6;
            ctx.beginPath();
            ctx.ellipse(b.x * w, b.y * h, width * 0.8, width * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      };

      drawTrail(left, 'rgba(80, 40, 20, 0.5)', 'rgba(30, 15, 5, 0.85)');
      drawTrail(right, 'rgba(80, 40, 20, 0.5)', 'rgba(30, 15, 5, 0.85)');

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
