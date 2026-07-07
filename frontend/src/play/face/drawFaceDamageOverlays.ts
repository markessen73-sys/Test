import { FACE_CONTAIN_PAD } from './composeFaceTexture';
import { FACE_SOURCE_SIZE } from './faceTemplate';
import type { FaceDamageId } from './faceDamage';

const [IMAGE_W, IMAGE_H] = FACE_SOURCE_SIZE;

/** Template-normalized landmark → canvas pixel (matches drawFullFaceOnCanvas). */
function toCanvas(
  lx: number,
  ly: number,
  canvasW: number,
  canvasH: number
): [number, number] {
  const contain = Math.min(canvasW / IMAGE_W, canvasH / IMAGE_H) * FACE_CONTAIN_PAD;
  const drawW = IMAGE_W * contain;
  const drawH = IMAGE_H * contain;
  return [canvasW / 2 + (lx - 0.5) * drawW, canvasH / 2 + (ly - 0.5) * drawH];
}

/** Pixel width of the drawn face on canvas (matches drawFullFaceOnCanvas). */
function faceDrawWidth(canvasW: number, canvasH: number): number {
  const contain = Math.min(canvasW / IMAGE_W, canvasH / IMAGE_H) * FACE_CONTAIN_PAD;
  return IMAGE_W * contain;
}

function drawCauliflowerEar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, side: -1 | 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#8b6f5c';
  ctx.strokeStyle = '#5c4030';
  ctx.lineWidth = s * 0.08;
  for (let i = 0; i < 6; i++) {
    const a = side * (0.4 + i * 0.18);
    const bx = Math.cos(a) * s * 0.55;
    const by = Math.sin(a) * s * 0.45;
    ctx.beginPath();
    ctx.ellipse(bx, by, s * 0.28, s * 0.32, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawBlackEye(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, s * 0.55);
  g.addColorStop(0, '#1a0a18');
  g.addColorStop(0.45, '#3d1838');
  g.addColorStop(0.75, 'rgba(80,30,70,0.45)');
  g.addColorStop(1, 'rgba(80,30,70,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.05, s * 0.5, s * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSwollenEye(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(220, 80, 70, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.62, s * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 40, 40, 0.5)';
  ctx.lineWidth = s * 0.06;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 200, 190, 0.25)';
  ctx.beginPath();
  ctx.ellipse(x - s * 0.12, y - s * 0.1, s * 0.22, s * 0.15, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawForeheadBandage(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.08);
  ctx.fillStyle = '#f2ebe0';
  ctx.strokeStyle = '#c8bfb0';
  ctx.lineWidth = s * 0.05;
  roundRect(ctx, -s * 0.95, -s * 0.18, s * 1.9, s * 0.36, s * 0.06);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(180,170,155,0.7)';
  ctx.lineWidth = s * 0.03;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s * 0.22, -s * 0.14);
    ctx.lineTo(i * s * 0.22, s * 0.14);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBrokenNose(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(180, 60, 55, 0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.38, s * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6a2020';
  ctx.lineWidth = s * 0.07;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.12, y - s * 0.35);
  ctx.lineTo(x + s * 0.18, y + s * 0.42);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.ellipse(x + s * 0.05, y - s * 0.05, s * 0.12, s * 0.08, 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawSwollenLip(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(210, 70, 75, 0.55)';
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.12, s * 0.42, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140, 30, 35, 0.6)';
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.38, y + s * 0.08);
  ctx.quadraticCurveTo(x, y + s * 0.32, x + s * 0.38, y + s * 0.08);
  ctx.stroke();
}

/** Paint accumulated injuries on top of the base face texture. */
export function drawFaceDamageOverlays(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  damages: readonly FaceDamageId[]
) {
  if (!damages.length) return;

  const s = faceDrawWidth(canvasW, canvasH) * 0.22;
  const [lx, ly] = toCanvas(0.3493, 0.3464, canvasW, canvasH);
  const [rx, ry] = toCanvas(0.6487, 0.3464, canvasW, canvasH);
  const [nx, ny] = toCanvas(0.499, 0.456, canvasW, canvasH);
  const [mx, my] = toCanvas(0.499, 0.597, canvasW, canvasH);
  const [leftEarX, leftEarY] = toCanvas(0.17, 0.44, canvasW, canvasH);
  const [rightEarX, rightEarY] = toCanvas(0.83, 0.44, canvasW, canvasH);
  const [foreheadX, foreheadY] = toCanvas(0.5, 0.2, canvasW, canvasH);

  for (const d of damages) {
    switch (d) {
      case 'cauliflowerLeftEar':
        drawCauliflowerEar(ctx, leftEarX, leftEarY, s * 1.15, -1);
        break;
      case 'cauliflowerRightEar':
        drawCauliflowerEar(ctx, rightEarX, rightEarY, s * 1.15, 1);
        break;
      case 'blackLeftEye':
        drawBlackEye(ctx, lx, ly, s);
        break;
      case 'swollenRightEye':
        drawSwollenEye(ctx, rx, ry, s);
        break;
      case 'foreheadBandage':
        drawForeheadBandage(ctx, foreheadX, foreheadY, s);
        break;
      case 'brokenNose':
        drawBrokenNose(ctx, nx, ny, s);
        break;
      case 'swollenBottomLip':
        drawSwollenLip(ctx, mx, my, s);
        break;
    }
  }
}
