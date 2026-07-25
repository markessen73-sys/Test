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

/**
 * Deterministic pseudo-random in [0,1) from seed — keeps bruise shapes stable
 * across re-renders of the same damage set.
 */
function hash01(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Soft-edged color cloud (fully feathered — no hard oval outline). */
function softCloud(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  rx: number,
  ry: number,
  rot: number,
  stops: Array<[number, string]>
) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(rot);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Realistic contusion: feathered, mottled hematoma (yellow-green fringe →
 * blue-violet body → dark purple core + red flush), no hard stamp edges.
 */
function drawBruise(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  angle = 0,
  seed = 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Hue stains first (source-over) so yellow/green/red read on pale skin
  ctx.globalCompositeOperation = 'source-over';
  softCloud(ctx, rx * 0.08, -ry * 0.06, rx * 1.3, ry * 1.22, 0.12, [
    [0, 'rgba(190, 160, 55, 0.22)'],
    [0.4, 'rgba(120, 150, 55, 0.28)'],
    [0.7, 'rgba(90, 130, 70, 0.14)'],
    [1, 'rgba(100, 130, 80, 0)'],
  ]);
  softCloud(ctx, -rx * 0.2, ry * 0.22, rx * 0.7, ry * 0.55, -0.5, [
    [0, 'rgba(70, 140, 90, 0.2)'],
    [0.55, 'rgba(100, 130, 70, 0.1)'],
    [1, 'rgba(100, 130, 70, 0)'],
  ]);

  // Depth via multiply — blue-violet body + pooling
  ctx.globalCompositeOperation = 'multiply';
  softCloud(ctx, -rx * 0.05, ry * 0.02, rx * 1.02, ry * 0.98, -0.08, [
    [0, 'rgba(75, 40, 105, 0.42)'],
    [0.35, 'rgba(95, 45, 95, 0.34)'],
    [0.65, 'rgba(120, 50, 75, 0.2)'],
    [1, 'rgba(140, 70, 60, 0)'],
  ]);
  softCloud(ctx, rx * 0.18, -ry * 0.12, rx * 0.72, ry * 0.7, 0.35, [
    [0, 'rgba(60, 30, 90, 0.3)'],
    [0.55, 'rgba(100, 45, 80, 0.16)'],
    [1, 'rgba(120, 60, 70, 0)'],
  ]);
  softCloud(ctx, -rx * 0.22, ry * 0.18, rx * 0.65, ry * 0.58, -0.4, [
    [0, 'rgba(90, 35, 70, 0.28)'],
    [0.5, 'rgba(120, 50, 65, 0.14)'],
    [1, 'rgba(130, 70, 55, 0)'],
  ]);

  for (let i = 0; i < 6; i++) {
    const t = hash01(seed * 17 + i * 3.1);
    const t2 = hash01(seed * 29 + i * 5.7);
    const t3 = hash01(seed * 41 + i * 2.3);
    const ox = (t - 0.5) * rx * 0.95;
    const oy = (t2 - 0.5) * ry * 0.95;
    const srx = rx * (0.28 + t3 * 0.32);
    const sry = ry * (0.24 + hash01(seed + i) * 0.3);
    const deep = t3 > 0.5;
    softCloud(ctx, ox, oy, srx, sry, (t - 0.5) * 1.2, [
      [
        0,
        deep
          ? `rgba(40, 12, 50, ${0.3 + t * 0.22})`
          : `rgba(100, 40, 75, ${0.2 + t2 * 0.16})`,
      ],
      [0.55, deep ? 'rgba(55, 20, 55, 0.12)' : 'rgba(120, 50, 70, 0.08)'],
      [1, 'rgba(80, 40, 60, 0)'],
    ]);
  }

  const coreX = -rx * (0.06 + hash01(seed) * 0.14);
  const coreY = ry * (0.02 + hash01(seed + 2) * 0.12);
  softCloud(ctx, coreX, coreY, rx * 0.48, ry * 0.42, 0.2, [
    [0, 'rgba(30, 6, 38, 0.58)'],
    [0.4, 'rgba(50, 15, 48, 0.34)'],
    [1, 'rgba(70, 30, 55, 0)'],
  ]);

  // Fresh red flush on top so inflammation stays vivid
  ctx.globalCompositeOperation = 'source-over';
  softCloud(ctx, coreX + rx * 0.18, coreY - ry * 0.1, rx * 0.4, ry * 0.34, -0.25, [
    [0, 'rgba(180, 35, 45, 0.34)'],
    [0.45, 'rgba(150, 50, 55, 0.16)'],
    [1, 'rgba(150, 70, 55, 0)'],
  ]);

  for (let i = 0; i < 10; i++) {
    const t = hash01(seed * 7 + i * 11);
    const t2 = hash01(seed * 13 + i * 9);
    softCloud(
      ctx,
      (t - 0.5) * rx * 0.85,
      (t2 - 0.5) * ry * 0.8,
      rx * (0.04 + t * 0.05),
      ry * (0.03 + t2 * 0.04),
      0,
      [
        [0, `rgba(110, 20, 35, ${0.22 + t * 0.2})`],
        [1, 'rgba(110, 20, 35, 0)'],
      ]
    );
  }

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
        drawBruise(ctx, cheekRX, cheekRY, u * 0.7, u * 0.55, 0.2, 11);
        break;
      case 'bruiseCheekRight':
        drawBruise(ctx, cheekLX, cheekLY, u * 0.7, u * 0.55, -0.2, 22);
        break;
      case 'bruiseForehead':
        drawBruise(ctx, fx + u * 0.25, fy + u * 0.15, u * 0.75, u * 0.4, 0.1, 33);
        break;
      case 'bruiseEyeLeft':
        drawBruise(ctx, REx, REy + u * 0.15, u * 0.85, u * 0.65, 0, 44);
        break;
      case 'bruiseEyeRight':
        drawBruise(ctx, LEx, LEy + u * 0.15, u * 0.85, u * 0.65, 0, 55);
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
