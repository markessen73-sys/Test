/**
 * Cartoon KO stars orbiting around the head.
 * Used on live knockout faces (selfie + upload photo modes).
 */

/** 4-point cartoon star path centred at origin. */
function starPath(ctx: CanvasRenderingContext2D, outer: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export type KoStarStyle = {
  /** Orbit radius as fraction of min(w,h). Default ~0.42 */
  orbitFrac?: number;
  /** Star outer radius as fraction of min(w,h). Default ~0.055 */
  sizeFrac?: number;
  count?: number;
};

/**
 * Draw spinning yellow stars circling the head. `timeMs` drives orbit + twinkle.
 */
export function drawKoStars(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeMs: number,
  style: KoStarStyle = {},
) {
  const count = style.count ?? 6;
  const minDim = Math.min(w, h);
  const orbit = minDim * (style.orbitFrac ?? 0.42);
  const starR = minDim * (style.sizeFrac ?? 0.055);
  const cx = w * 0.5;
  const cy = h * 0.42;
  const spin = timeMs * 0.0018;

  for (let i = 0; i < count; i++) {
    const base = (i / count) * Math.PI * 2 + spin;
    // Slight elliptical orbit so stars sit around the head oval
    const ox = cx + Math.cos(base) * orbit * 1.05;
    const oy = cy + Math.sin(base) * orbit * 0.78;
    // Bob + independent twinkle spin
    const bob = Math.sin(timeMs * 0.006 + i * 1.7) * starR * 0.35;
    const twinkle = 0.75 + 0.25 * Math.sin(timeMs * 0.01 + i * 2.3);
    const rot = timeMs * 0.004 + i * 0.9;

    ctx.save();
    ctx.translate(ox, oy + bob);
    ctx.rotate(rot);
    ctx.scale(twinkle, twinkle);

    // Soft glow
    ctx.fillStyle = 'rgba(255, 220, 60, 0.35)';
    starPath(ctx, starR * 1.55, starR * 0.55);
    ctx.fill();

    // Body
    const grad = ctx.createRadialGradient(-starR * 0.2, -starR * 0.25, 0, 0, 0, starR);
    grad.addColorStop(0, '#fff9c4');
    grad.addColorStop(0.45, '#ffd600');
    grad.addColorStop(1, '#f9a825');
    ctx.fillStyle = grad;
    starPath(ctx, starR, starR * 0.38);
    ctx.fill();

    ctx.strokeStyle = 'rgba(180, 100, 0, 0.55)';
    ctx.lineWidth = Math.max(1, starR * 0.08);
    starPath(ctx, starR, starR * 0.38);
    ctx.stroke();

    ctx.restore();
  }
}
