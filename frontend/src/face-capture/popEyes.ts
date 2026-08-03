/**
 * Comedy pop-out eyes that zoom forward (scale 0.5 → 1) off the face.
 * Used live on punch; not baked into the ooh PNG.
 */
import type { FaceFeatureMark } from './customFace';

export type Rgb = { r: number; g: number; b: number };

function hash01(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function sampleRgb(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
): Rgb | null {
  const xi = Math.min(w - 1, Math.max(0, Math.round(x)));
  const yi = Math.min(h - 1, Math.max(0, Math.round(y)));
  const i = (yi * w + xi) * 4;
  const a = data[i + 3] ?? 0;
  if (a < 40) return null;
  return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]! };
}

/** Average skin near the eye marks (call once per face load). */
export function sampleSkinNearEyes(
  imageData: ImageData,
  left: FaceFeatureMark,
  right: FaceFeatureMark,
): Rgb {
  const { width: w, height: h, data } = imageData;
  const samples: Rgb[] = [];
  for (const eye of [left, right]) {
    const offsets = [
      { x: 0, y: -eye.ry * h * 1.6 },
      { x: -eye.rx * w * 1.3, y: 0 },
      { x: eye.rx * w * 1.3, y: 0 },
      { x: 0, y: eye.ry * h * 1.5 },
    ];
    for (const o of offsets) {
      const s = sampleRgb(data, w, h, eye.cx * w + o.x, eye.cy * h + o.y);
      if (s) samples.push(s);
    }
  }
  if (!samples.length) return { r: 180, g: 140, b: 120 };
  let r = 0;
  let g = 0;
  let b = 0;
  for (const s of samples) {
    r += s.r;
    g += s.g;
    b += s.b;
  }
  const n = samples.length;
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

/**
 * Ease-out for a snappy pop (0→1).
 */
export function easeOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 3);
}

/**
 * Scale of the popped eye for a hit-reaction window.
 * 0.5 at start → 1 at end of zoom; null when the ooh window is over.
 */
export function popEyeScaleForHit(ageMs: number, oohMs: number): number | null {
  if (ageMs < 0 || ageMs >= oohMs) return null;
  // Zoom occupies the first ~70% of the ooh window, then hold at full size
  const zoomMs = oohMs * 0.7;
  if (ageMs >= zoomMs) return 1;
  const t = easeOutCubic(ageMs / zoomMs);
  return 0.5 + 0.5 * t;
}

/**
 * Shared circular radius for both eyes: round (max axis per eye), then the
 * larger of the two so left and right always match.
 */
export function sharedPopEyeRadiusPx(
  left: FaceFeatureMark,
  right: FaceFeatureMark,
  w: number,
  h: number,
): number {
  const leftR = Math.max(left.rx * w, left.ry * h);
  const rightR = Math.max(right.rx * w, right.ry * h);
  // 1.5 × prior 2×-highlighter bulge, floored so tiny marks still read
  return Math.max(14, Math.max(leftR, rightR) * 2 * 1.5);
}

/**
 * Draw both pop eyes at `scale` (0.5 = half present size, 1 = full present size),
 * centred on highlighter marks. Eyes are always round and equal size.
 */
export function drawPopEyesZoom(
  ctx: CanvasRenderingContext2D,
  left: FaceFeatureMark,
  right: FaceFeatureMark,
  w: number,
  h: number,
  scale: number,
  skin: Rgb,
) {
  const s = Math.min(1.5, Math.max(0.35, scale));
  const skinDark = {
    r: Math.max(0, skin.r - 55),
    g: Math.max(0, skin.g - 60),
    b: Math.max(0, skin.b - 55),
  };

  const fullR = sharedPopEyeRadiusPx(left, right, w, h);
  const popR = fullR * s;
  const sockR = Math.max(8, fullR * 0.32);

  const paintOne = (eye: FaceFeatureMark, outward: number) => {
    const cx = eye.cx * w;
    const cy = eye.cy * h;
    const lift = fullR * 0.22 * s;
    const ex = cx;
    const ey = cy - lift;

    // Cast shadow grows with scale (flat oval under a round ball is fine)
    ctx.fillStyle = `rgba(0, 0, 0, ${0.18 + 0.16 * s})`;
    ctx.beginPath();
    ctx.ellipse(
      cx + popR * 0.1,
      cy + popR * 0.45,
      popR * (0.9 + 0.15 * s),
      popR * 0.48,
      0.12,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Socket hollow (face recess) — circular
    ctx.fillStyle = `rgb(${skin.r}, ${skin.g}, ${skin.b})`;
    ctx.beginPath();
    ctx.arc(cx, cy, sockR * 1.4, 0, Math.PI * 2);
    ctx.fill();
    const socketGrad = ctx.createRadialGradient(
      cx,
      cy - sockR * 0.2,
      0,
      cx,
      cy,
      sockR * 1.2,
    );
    socketGrad.addColorStop(0, `rgba(${skinDark.r}, ${skinDark.g}, ${skinDark.b}, 0.95)`);
    socketGrad.addColorStop(0.55, `rgba(${skinDark.r}, ${skinDark.g}, ${skinDark.b}, 0.72)`);
    socketGrad.addColorStop(1, `rgba(${skin.r}, ${skin.g}, ${skin.b}, 0)`);
    ctx.fillStyle = socketGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, sockR * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(18, 8, 10, 0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, sockR * 0.75, 0, Math.PI * 2);
    ctx.fill();

    // Springs stretch as the eye moves forward
    ctx.save();
    ctx.strokeStyle = 'rgba(90, 55, 58, 0.8)';
    ctx.lineWidth = Math.max(1.4, popR * 0.05);
    ctx.lineCap = 'round';
    const coils = 5;
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.moveTo(cx + side * sockR * 0.3, cy);
      for (let i = 1; i <= coils; i++) {
        const t = i / coils;
        const wx = Math.sin(t * Math.PI * coils) * sockR * 0.25 * side;
        ctx.lineTo(cx + (ex - cx) * t + wx + outward * popR * 0.03 * t, cy + (ey - cy) * t);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(120, 70, 75, 0.65)';
    ctx.lineWidth = Math.max(1.8, popR * 0.065);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + outward * popR * 0.08, (cy + ey) / 2, ex, ey);
    ctx.stroke();
    ctx.restore();

    // Contact shadow
    ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + 0.12 * s})`;
    ctx.beginPath();
    ctx.ellipse(ex, ey + popR * 0.55, popR * 0.88, popR * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sphere body — always circular
    const sphere = ctx.createRadialGradient(
      ex - popR * 0.38,
      ey - popR * 0.42,
      popR * 0.04,
      ex + popR * 0.12,
      ey + popR * 0.2,
      popR * 1.12,
    );
    sphere.addColorStop(0, '#ffffff');
    sphere.addColorStop(0.28, '#faf7f0');
    sphere.addColorStop(0.55, '#efe8dc');
    sphere.addColorStop(0.78, '#d9d0c2');
    sphere.addColorStop(1, '#9a9084');
    ctx.fillStyle = sphere;
    ctx.beginPath();
    ctx.arc(ex, ey, popR, 0, Math.PI * 2);
    ctx.fill();

    // Edge / rim shading
    const edgeShade = ctx.createRadialGradient(ex, ey, popR * 0.4, ex, ey, popR);
    edgeShade.addColorStop(0, 'rgba(0,0,0,0)');
    edgeShade.addColorStop(0.55, 'rgba(50, 35, 40, 0.1)');
    edgeShade.addColorStop(0.82, 'rgba(40, 28, 32, 0.4)');
    edgeShade.addColorStop(1, 'rgba(20, 12, 14, 0.75)');
    ctx.fillStyle = edgeShade;
    ctx.beginPath();
    ctx.arc(ex, ey, popR, 0, Math.PI * 2);
    ctx.fill();

    const rim = ctx.createRadialGradient(
      ex + popR * 0.4,
      ey + popR * 0.48,
      0,
      ex,
      ey,
      popR,
    );
    rim.addColorStop(0, 'rgba(35, 22, 28, 0.42)');
    rim.addColorStop(0.5, 'rgba(35, 22, 28, 0)');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(ex, ey, popR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(45, 32, 36, 0.5)';
    ctx.lineWidth = Math.max(1.2, popR * 0.035);
    ctx.beginPath();
    ctx.arc(ex, ey, popR, 0, Math.PI * 2);
    ctx.stroke();

    // Corpuscles / capillaries
    const irisR = popR * 0.4;
    const irisX = ex + outward * popR * 0.04;
    const irisY = ey + popR * 0.02;
    const seed = cx * 12.9898 + cy * 78.233 + outward * 91.7;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ex, ey, popR * 0.96, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(170, 45, 55, 0.45)';
    ctx.lineWidth = Math.max(0.7, popR * 0.012);
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a0 = hash01(seed + i * 3.1) * Math.PI * 2;
      const a1 = a0 + (hash01(seed + i * 5.7) - 0.5) * 0.9;
      const r0 = irisR * 1.15 + hash01(seed + i * 2.2) * (popR * 0.35);
      const r1 = popR * (0.78 + hash01(seed + i * 4.4) * 0.18);
      ctx.beginPath();
      ctx.moveTo(irisX + Math.cos(a0) * r0, irisY + Math.sin(a0) * r0);
      const mx =
        irisX +
        Math.cos((a0 + a1) / 2) * ((r0 + r1) / 2) +
        (hash01(seed + i) - 0.5) * popR * 0.08;
      const my =
        irisY +
        Math.sin((a0 + a1) / 2) * ((r0 + r1) / 2) +
        (hash01(seed + i + 1) - 0.5) * popR * 0.08;
      ctx.quadraticCurveTo(mx, my, irisX + Math.cos(a1) * r1, irisY + Math.sin(a1) * r1);
      ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const ang = hash01(seed + i * 7.3) * Math.PI * 2;
      const rad = irisR * 1.2 + hash01(seed + i * 9.1) * (popR * 0.55 - irisR * 0.2);
      const px = irisX + Math.cos(ang) * rad;
      const py = irisY + Math.sin(ang) * rad;
      if (Math.hypot(px - irisX, py - irisY) < irisR * 1.08) continue;
      const rr = Math.max(0.7, popR * (0.018 + hash01(seed + i * 11) * 0.022));
      ctx.fillStyle = `rgba(${150 + hash01(seed + i) * 50}, ${30 + hash01(seed + i * 2) * 25}, ${40 + hash01(seed + i * 3) * 20}, ${0.45 + hash01(seed + i * 4) * 0.4})`;
      ctx.beginPath();
      ctx.arc(px, py, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Iris + pupil
    const iris = ctx.createRadialGradient(
      irisX - irisR * 0.25,
      irisY - irisR * 0.3,
      irisR * 0.08,
      irisX,
      irisY,
      irisR,
    );
    iris.addColorStop(0, '#7ec4ef');
    iris.addColorStop(0.35, '#3a87c4');
    iris.addColorStop(0.75, '#1e4f7a');
    iris.addColorStop(1, '#0c2238');
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(irisX, irisY, irisR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#050508';
    ctx.beginPath();
    ctx.arc(irisX, irisY, irisR * 0.42, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.ellipse(ex - popR * 0.32, ey - popR * 0.38, popR * 0.16, popR * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(irisX + irisR * 0.2, irisY - irisR * 0.25, irisR * 0.15, 0, Math.PI * 2);
    ctx.fill();
  };

  paintOne(left, -1);
  paintOne(right, 1);
}
