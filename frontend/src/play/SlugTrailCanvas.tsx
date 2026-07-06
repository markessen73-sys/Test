import { useEffect, useRef } from 'react';
import type { GloveState } from '../types/game';

interface SlugTrailCanvasProps {
  left: GloveState;
  right: GloveState;
}

const DEFAULT_TRAIL_WIDTH_NORM = 0.14;

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
        if (pts.length < 1) return;

        const now = performance.now();

        const tip = pts[pts.length - 1];
        const tipAge = (now - tip.t) / 520;
        const tipAlpha = Math.max(0, 1 - tipAge);
        if (tipAlpha > 0) {
          const tipW = (tip.width ?? DEFAULT_TRAIL_WIDTH_NORM) * w * tipAlpha;
          const tipRad = ((tip.angle ?? 0) * Math.PI) / 180;
          ctx.save();
          ctx.fillStyle = tip.isPunch ? 'rgba(255, 250, 235, 0.55)' : 'rgba(220, 235, 255, 0.4)';
          ctx.globalAlpha = tipAlpha * 0.6;
          ctx.shadowColor = 'rgba(200, 225, 255, 0.5)';
          ctx.shadowBlur = tip.isPunch ? 18 : 12;
          ctx.beginPath();
          ctx.ellipse(tip.x * w, tip.y * h, tipW * 0.5, tipW * 0.22, tipRad, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        if (pts.length < 2) return;

        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          const age = (now - b.t) / 520;
          const alpha = Math.max(0, 1 - age);
          if (alpha <= 0) continue;

          const isImpact = b.isPunch || a.isPunch;
          const segW = ((a.width ?? DEFAULT_TRAIL_WIDTH_NORM) + (b.width ?? DEFAULT_TRAIL_WIDTH_NORM)) * 0.5 * w * alpha;

          ctx.save();
          ctx.strokeStyle = isImpact ? 'rgba(255, 245, 230, 0.55)' : 'rgba(210, 225, 240, 0.36)';
          ctx.globalAlpha = alpha * (isImpact ? 0.75 : 0.48);
          ctx.lineWidth = Math.max(6, segW);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.shadowColor = isImpact ? 'rgba(255, 255, 255, 0.65)' : 'rgba(200, 220, 255, 0.4)';
          ctx.shadowBlur = isImpact ? 16 : 10;
          ctx.beginPath();
          ctx.moveTo(a.x * w, a.y * h);
          ctx.lineTo(b.x * w, b.y * h);
          ctx.stroke();
          ctx.restore();
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
