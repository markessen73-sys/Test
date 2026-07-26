import { CANVAS_HEIGHT, CANVAS_WIDTH, type LayerKey } from './constants';

export function drawPlaceholderLayer(
  ctx: CanvasRenderingContext2D,
  layer: LayerKey,
  variantIndex: number
): void {
  const w = CANVAS_WIDTH;
  const h = CANVAS_HEIGHT;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const seed = variantIndex || 1;

  ctx.save();

  switch (layer) {
    case 'head':
      drawHead(ctx, cx, cy);
      break;
    case 'skin':
      drawSkin(ctx, cx, cy, seed);
      break;
    case 'ears':
      drawEars(ctx, cx, cy, seed);
      break;
    case 'eyes':
      drawEyes(ctx, cx, cy, seed);
      break;
    case 'eyebrows':
      drawEyebrows(ctx, cx, cy, seed);
      break;
    case 'nose':
      drawNose(ctx, cx, cy, seed);
      break;
    case 'mouth':
      drawMouth(ctx, cx, cy, seed);
      break;
    case 'hair':
      drawHair(ctx, cx, cy, seed);
      break;
    case 'beard':
      drawBeard(ctx, cx, cy, seed);
      break;
    case 'glasses':
      drawGlasses(ctx, cx, cy);
      break;
    case 'accessories':
      drawAccessory(ctx, cx, cy, seed);
      break;
  }

  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.beginPath();
  ctx.ellipse(cx, cy - 10, 148, 178, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#e8c4a0';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1a1a1a';
  ctx.stroke();
}

function drawSkin(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number) {
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 8, 130, 155, 0, 0, Math.PI * 2);
  ctx.fillStyle = tint('#f0c9a6', seed);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawEars(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number) {
  const earY = cy - 20;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * 138, earY, 22 + (seed % 3) * 2, 34, side * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#e0b896';
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawEyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number) {
  const eyeY = cy - 42;
  const eyeW = 36 + (seed % 4) * 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * 52, eyeY, eyeW, 26, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + side * 52, eyeY, 10 + (seed % 3), 0, Math.PI * 2);
    ctx.fillStyle = '#2244aa';
    ctx.fill();
  }
}

function drawEyebrows(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number) {
  ctx.lineWidth = 5 + (seed % 3);
  ctx.strokeStyle = '#3d2314';
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 30, cy - 78);
    ctx.quadraticCurveTo(cx + side * 58, cy - 92 - (seed % 2) * 4, cx + side * 86, cy - 74);
    ctx.stroke();
  }
}

function drawNose(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - 18);
  ctx.quadraticCurveTo(cx + 8 + (seed % 3) * 2, cy + 18, cx, cy + 42);
  ctx.quadraticCurveTo(cx - 12, cy + 20, cx, cy - 18);
  ctx.fillStyle = '#d9a882';
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawMouth(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number) {
  if (seed % 3 === 0) {
    ctx.beginPath();
    ctx.ellipse(cx, cy + 72, 34 + (seed % 4) * 2, 28, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#6a2020';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(cx - 40, cy + 68);
  ctx.quadraticCurveTo(cx, cy + 88 + (seed % 2) * 4, cx + 40, cy + 68);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawHair(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number) {
  ctx.beginPath();
  ctx.ellipse(cx, cy - 100, 155 + (seed % 5) * 4, 90 + (seed % 4) * 3, 0, Math.PI, Math.PI * 2);
  ctx.fillStyle = tint('#2a1810', seed);
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawBeard(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number) {
  ctx.beginPath();
  ctx.ellipse(cx, cy + 100, 90 + (seed % 3) * 5, 70, 0, 0, Math.PI);
  ctx.fillStyle = tint('#4a3020', seed);
  ctx.fill();
}

function drawGlasses(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#222';
  for (const side of [-1, 1]) {
    ctx.strokeRect(cx + side * 88 - 42, cy - 68, 84, 52);
  }
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy - 42);
  ctx.lineTo(cx + 4, cy - 42);
  ctx.stroke();
}

function drawAccessory(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number) {
  ctx.beginPath();
  ctx.arc(cx, cy - 130, 14 + (seed % 3) * 2, 0, Math.PI * 2);
  ctx.fillStyle = tint('#ffd700', seed);
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function tint(hex: string, seed: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const shift = ((seed % 7) - 3) * 6;
  const clamp = (n: number) => Math.max(0, Math.min(255, n + shift));
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}
