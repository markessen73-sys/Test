import type { PunchType } from '../types/game';

export interface FaceCanvasState {
  squashX: number;
  squashY: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  stars: boolean;
  spiral: boolean;
  redCheeks: boolean;
  blackEye: boolean;
  tongueOut: boolean;
}

const DEFAULT: FaceCanvasState = {
  squashX: 1,
  squashY: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  stars: false,
  spiral: false,
  redCheeks: false,
  blackEye: false,
  tongueOut: false,
};

export function reactionForPunch(punch: PunchType, combo: number): FaceCanvasState {
  const intensity = Math.min(1 + combo * 0.15, 2);

  switch (punch) {
    case 'jab':
      return {
        ...DEFAULT,
        squashX: 0.75,
        squashY: 1.1,
        offsetX: -0.08 * intensity,
        rotation: -0.15 * intensity,
        spiral: combo > 2,
      };
    case 'cross':
      return {
        ...DEFAULT,
        squashX: 0.65,
        squashY: 1.05,
        offsetX: 0.1 * intensity,
        rotation: 0.2 * intensity,
        blackEye: combo > 1,
        redCheeks: true,
      };
    case 'hook':
      return {
        ...DEFAULT,
        squashX: 0.5,
        squashY: 1.2,
        rotation: 0.45 * intensity,
        offsetX: 0.15 * intensity,
        stars: combo > 1,
        blackEye: true,
      };
    case 'uppercut':
      return {
        ...DEFAULT,
        squashX: 1.15,
        squashY: 0.55,
        offsetY: -0.12 * intensity,
        rotation: -0.08,
        stars: true,
        tongueOut: combo > 0,
        spiral: combo > 2,
      };
    case 'body':
      return {
        ...DEFAULT,
        squashX: 1.2,
        squashY: 0.7,
        offsetY: 0.1 * intensity,
        redCheeks: true,
        tongueOut: combo > 1,
      };
    default:
      return DEFAULT;
  }
}

export function lerpState(a: FaceCanvasState, b: FaceCanvasState, t: number): FaceCanvasState {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    squashX: lerp(a.squashX, b.squashX),
    squashY: lerp(a.squashY, b.squashY),
    rotation: lerp(a.rotation, b.rotation),
    offsetX: lerp(a.offsetX, b.offsetX),
    offsetY: lerp(a.offsetY, b.offsetY),
    stars: t > 0.5 ? b.stars : a.stars,
    spiral: t > 0.5 ? b.spiral : a.spiral,
    redCheeks: t > 0.5 ? b.redCheeks : a.redCheeks,
    blackEye: t > 0.5 ? b.blackEye : a.blackEye,
    tongueOut: t > 0.5 ? b.tongueOut : a.tongueOut,
  };
}

export function drawFaceOnCanvas(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  state: FaceCanvasState,
  size: number
) {
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2 + state.offsetX * size;
  const cy = size / 2 + state.offsetY * size;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(state.rotation);
  ctx.scale(state.squashX, state.squashY);

  const imgSize = size * 0.85;
  ctx.drawImage(image, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
  ctx.restore();

  if (state.redCheeks) {
    ctx.fillStyle = 'rgba(255, 80, 80, 0.45)';
    ctx.beginPath();
    ctx.ellipse(size * 0.3, size * 0.55, size * 0.08, size * 0.05, 0, 0, Math.PI * 2);
    ctx.ellipse(size * 0.7, size * 0.55, size * 0.08, size * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.blackEye) {
    ctx.fillStyle = 'rgba(40, 20, 60, 0.6)';
    ctx.beginPath();
    ctx.ellipse(size * 0.62, size * 0.38, size * 0.09, size * 0.07, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.stars) {
    drawStars(ctx, size);
  }

  if (state.spiral) {
    drawSpirals(ctx, size);
  }

  if (state.tongueOut) {
    ctx.fillStyle = '#ff6b8a';
    ctx.beginPath();
    ctx.ellipse(size * 0.5, size * 0.72, size * 0.06, size * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStars(ctx: CanvasRenderingContext2D, size: number) {
  const positions = [
    [0.2, 0.15],
    [0.8, 0.12],
    [0.85, 0.35],
    [0.15, 0.3],
  ];
  ctx.fillStyle = '#FFD700';
  ctx.strokeStyle = '#FFA500';
  ctx.lineWidth = 1;
  for (const [px, py] of positions) {
    drawStar(ctx, px * size, py * size, size * 0.04);
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](x + r * Math.cos(angle), y + r * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawSpirals(ctx: CanvasRenderingContext2D, size: number) {
  ctx.strokeStyle = 'rgba(100, 50, 200, 0.7)';
  ctx.lineWidth = 2;
  for (const [px, py] of [
    [0.25, 0.2],
    [0.75, 0.22],
  ]) {
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const angle = i * 0.5;
      const r = i * 0.003 * size;
      const x = px * size + r * Math.cos(angle);
      const y = py * size + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function createFaceTexture(
  image: HTMLImageElement,
  state: FaceCanvasState,
  size = 512
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  drawFaceOnCanvas(ctx, image, state, size);
  return canvas;
}
