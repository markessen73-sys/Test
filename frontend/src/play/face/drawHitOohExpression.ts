import { FACE_CONTAIN_PAD } from './composeFaceTexture';
import { FACE_SOURCE_SIZE } from './faceTemplate';
import { TARGET_DAMAGE_LANDMARKS } from './faceDamageAssets';

const [IMAGE_W, IMAGE_H] = FACE_SOURCE_SIZE;

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

function faceUnit(canvasW: number, canvasH: number): number {
  const contain = Math.min(canvasW / IMAGE_W, canvasH / IMAGE_H) * FACE_CONTAIN_PAD;
  return IMAGE_W * contain * 0.2;
}

/**
 * Brief punch reaction: eyes bulge, mouth forms an "ooh!" — painted over the
 * live caricature without changing the accumulated damage HUD face.
 */
export function drawHitOohExpression(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  intensity = 1
) {
  const t = Math.max(0, Math.min(1, intensity));
  if (t <= 0.01) return;

  const u = faceUnit(canvasW, canvasH);
  const [lx, ly] = toCanvas(
    TARGET_DAMAGE_LANDMARKS.leftEye[0],
    TARGET_DAMAGE_LANDMARKS.leftEye[1],
    canvasW,
    canvasH
  );
  const [rx, ry] = toCanvas(
    TARGET_DAMAGE_LANDMARKS.rightEye[0],
    TARGET_DAMAGE_LANDMARKS.rightEye[1],
    canvasW,
    canvasH
  );
  const [mx, my] = toCanvas(
    TARGET_DAMAGE_LANDMARKS.mouth[0],
    TARGET_DAMAGE_LANDMARKS.mouth[1],
    canvasW,
    canvasH
  );

  ctx.save();
  ctx.globalAlpha = 0.55 + 0.45 * t;

  drawBulgingEye(ctx, lx, ly, u, t);
  drawBulgingEye(ctx, rx, ry, u, t);
  drawOohMouth(ctx, mx, my, u, t);

  ctx.restore();
}

function drawBulgingEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  t: number
) {
  const scale = 1 + 0.35 * t;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Cover original eye / glasses lens area with skin-ish patch first
  ctx.fillStyle = 'rgba(235, 195, 160, 0.92)';
  ctx.beginPath();
  ctx.ellipse(0, 0, u * 0.72, u * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // Big white sclera
  ctx.fillStyle = '#fffef8';
  ctx.beginPath();
  ctx.ellipse(0, u * 0.02, u * 0.58, u * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  // Iris
  ctx.fillStyle = '#3d7a3a';
  ctx.beginPath();
  ctx.ellipse(0, u * 0.04, u * 0.28, u * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dilated pupil
  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.ellipse(0, u * 0.05, u * 0.14, u * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Specular
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-u * 0.08, -u * 0.06, u * 0.07, u * 0.05, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawOohMouth(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  t: number
) {
  const open = 0.75 + 0.35 * t;
  ctx.save();
  ctx.translate(x, y + u * 0.05);

  // Cover the wide grin with a soft skin oval
  ctx.fillStyle = 'rgba(232, 188, 152, 0.97)';
  ctx.beginPath();
  ctx.ellipse(0, 0, u * 1.15, u * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  // Outer lip ring
  ctx.fillStyle = '#c45a5a';
  ctx.beginPath();
  ctx.ellipse(0, 0, u * 0.42 * open, u * 0.58 * open, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dark interior "ooh"
  ctx.fillStyle = '#1a0c10';
  ctx.beginPath();
  ctx.ellipse(0, u * 0.02, u * 0.28 * open, u * 0.42 * open, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tiny tongue hint at bottom
  ctx.fillStyle = '#a84858';
  ctx.beginPath();
  ctx.ellipse(0, u * 0.22 * open, u * 0.16 * open, u * 0.1 * open, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
