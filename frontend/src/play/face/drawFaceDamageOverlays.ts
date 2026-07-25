import { FACE_CONTAIN_PAD } from './composeFaceTexture';
import { FACE_SOURCE_SIZE } from './faceTemplate';
import { TARGET_DAMAGE_LANDMARKS } from './faceDamageAssets';
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

function faceUnit(canvasW: number, canvasH: number): number {
  const contain = Math.min(canvasW / IMAGE_W, canvasH / IMAGE_H) * FACE_CONTAIN_PAD;
  return IMAGE_W * contain * 0.2;
}

/** Soft purple-blue bruise — works on any skin tone via multiply. */
function drawBruise(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  angle = 0
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.globalCompositeOperation = 'multiply';
  const g = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, Math.max(rx, ry));
  g.addColorStop(0, 'rgba(55, 20, 70, 0.72)');
  g.addColorStop(0.35, 'rgba(95, 35, 90, 0.55)');
  g.addColorStop(0.7, 'rgba(140, 55, 70, 0.32)');
  g.addColorStop(1, 'rgba(160, 90, 70, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Darker core blotch
  ctx.fillStyle = 'rgba(40, 12, 45, 0.4)';
  ctx.beginPath();
  ctx.ellipse(-rx * 0.12, ry * 0.08, rx * 0.45, ry * 0.4, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Small fresh cut — thin dark-red slash with a highlight edge. */
function drawCut(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  angle: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = 'source-over';

  // Soft red halo
  ctx.strokeStyle = 'rgba(160, 40, 40, 0.35)';
  ctx.lineWidth = Math.max(2, len * 0.18);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.lineTo(len / 2, 0);
  ctx.stroke();

  // Dark cut line
  ctx.strokeStyle = '#4a1010';
  ctx.lineWidth = Math.max(1.5, len * 0.08);
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.lineTo(len / 2, 0);
  ctx.stroke();

  // Tiny blood bead at one end
  ctx.fillStyle = '#8a1c1c';
  ctx.beginPath();
  ctx.ellipse(len * 0.28, len * 0.06, len * 0.07, len * 0.05, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Paint simple bruises and small cuts on any face.
 * Positions are landmark-relative so they transfer across caricatures.
 */
export function drawFaceDamageOverlays(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  damages: readonly FaceDamageId[]
) {
  if (!damages.length) return;

  const u = faceUnit(canvasW, canvasH);
  // Image-left = subject's right.
  const [LEx, LEy] = toCanvas(
    TARGET_DAMAGE_LANDMARKS.leftEye[0],
    TARGET_DAMAGE_LANDMARKS.leftEye[1],
    canvasW,
    canvasH
  );
  const [REx, REy] = toCanvas(
    TARGET_DAMAGE_LANDMARKS.rightEye[0],
    TARGET_DAMAGE_LANDMARKS.rightEye[1],
    canvasW,
    canvasH
  );
  const [fx, fy] = toCanvas(
    TARGET_DAMAGE_LANDMARKS.forehead[0],
    TARGET_DAMAGE_LANDMARKS.forehead[1],
    canvasW,
    canvasH
  );
  const [cx, cy] = toCanvas(
    TARGET_DAMAGE_LANDMARKS.chin[0],
    TARGET_DAMAGE_LANDMARKS.chin[1],
    canvasW,
    canvasH
  );

  // Cheek midpoints between eye and chin
  const cheekLY = (LEy + cy) * 0.5;
  const cheekRY = (REy + cy) * 0.5;
  const cheekLX = LEx - u * 0.15;
  const cheekRX = REx + u * 0.15;

  ctx.save();

  for (const d of damages) {
    switch (d) {
      case 'bruiseCheekLeft':
        // subject left cheek = image right
        drawBruise(ctx, cheekRX, cheekRY, u * 0.7, u * 0.55, 0.2);
        break;
      case 'bruiseCheekRight':
        drawBruise(ctx, cheekLX, cheekLY, u * 0.7, u * 0.55, -0.2);
        break;
      case 'bruiseForehead':
        drawBruise(ctx, fx + u * 0.25, fy + u * 0.15, u * 0.75, u * 0.4, 0.1);
        break;
      case 'bruiseEyeLeft':
        drawBruise(ctx, REx, REy + u * 0.15, u * 0.85, u * 0.65, 0);
        break;
      case 'bruiseEyeRight':
        drawBruise(ctx, LEx, LEy + u * 0.15, u * 0.85, u * 0.65, 0);
        break;
      case 'cutBrow':
        drawCut(ctx, LEx - u * 0.1, LEy - u * 0.55, u * 0.55, -0.35);
        break;
      case 'cutCheek':
        drawCut(ctx, cheekRX - u * 0.1, cheekRY - u * 0.1, u * 0.45, 0.55);
        break;
      case 'cutChin':
        drawCut(ctx, cx + u * 0.15, cy - u * 0.15, u * 0.4, -0.15);
        break;
    }
  }

  ctx.restore();
}
