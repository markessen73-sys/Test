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

/** Soft irregular blotch — builds mottled hematoma edges. */
function blotch(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  rx: number,
  ry: number,
  rot: number,
  color: string
) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Realistic contusion: irregular mottled layers (deep purple core → blue-red mid →
 * olive/yellow fringe), soft capillary flecks, multiply blend into skin.
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
  ctx.globalCompositeOperation = 'multiply';

  // Outer yellowish-olive fringe (healing edge / serum)
  const outer = ctx.createRadialGradient(0, 0, Math.max(rx, ry) * 0.35, 0, 0, Math.max(rx, ry) * 1.05);
  outer.addColorStop(0, 'rgba(120, 70, 55, 0)');
  outer.addColorStop(0.55, 'rgba(130, 95, 45, 0.22)');
  outer.addColorStop(0.82, 'rgba(90, 110, 55, 0.28)');
  outer.addColorStop(1, 'rgba(100, 120, 70, 0)');
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 1.08, ry * 1.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mid blue-violet body
  const mid = ctx.createRadialGradient(-rx * 0.1, ry * 0.05, rx * 0.08, 0, 0, Math.max(rx, ry));
  mid.addColorStop(0, 'rgba(70, 35, 95, 0.55)');
  mid.addColorStop(0.4, 'rgba(85, 40, 100, 0.42)');
  mid.addColorStop(0.72, 'rgba(110, 45, 75, 0.28)');
  mid.addColorStop(1, 'rgba(140, 70, 60, 0)');
  ctx.fillStyle = mid;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Irregular mottled satellite blotches (broken vessels / uneven pooling)
  for (let i = 0; i < 7; i++) {
    const t = hash01(seed * 17 + i * 3.1);
    const t2 = hash01(seed * 29 + i * 5.7);
    const t3 = hash01(seed * 41 + i * 2.3);
    const ox = (t - 0.5) * rx * 1.15;
    const oy = (t2 - 0.5) * ry * 1.15;
    const srx = rx * (0.18 + t3 * 0.28);
    const sry = ry * (0.16 + hash01(seed + i) * 0.26);
    const rot = (t - 0.5) * 1.4;
    const deep = t3 > 0.55;
    blotch(
      ctx,
      ox,
      oy,
      srx,
      sry,
      rot,
      deep
        ? `rgba(45, 15, 55, ${0.22 + t * 0.28})`
        : `rgba(95, 40, 80, ${0.16 + t2 * 0.22})`
    );
  }

  // Dark hematoma core (slightly off-center)
  const coreX = -rx * (0.08 + hash01(seed) * 0.12);
  const coreY = ry * (0.04 + hash01(seed + 2) * 0.1);
  const core = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, Math.max(rx, ry) * 0.42);
  core.addColorStop(0, 'rgba(35, 8, 40, 0.62)');
  core.addColorStop(0.45, 'rgba(55, 18, 50, 0.38)');
  core.addColorStop(1, 'rgba(70, 30, 55, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(coreX, coreY, rx * 0.48, ry * 0.42, 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Reddish inflammatory flush near core
  blotch(
    ctx,
    coreX + rx * 0.15,
    coreY - ry * 0.08,
    rx * 0.32,
    ry * 0.28,
    -0.3,
    'rgba(140, 35, 45, 0.28)'
  );

  // Tiny capillary flecks
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 5; i++) {
    const t = hash01(seed * 7 + i * 11);
    const t2 = hash01(seed * 13 + i * 9);
    const fx = (t - 0.5) * rx * 0.9;
    const fy = (t2 - 0.5) * ry * 0.85;
    ctx.fillStyle = `rgba(90, 20, 35, ${0.18 + t * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(fx, fy, rx * (0.02 + t * 0.03), ry * (0.015 + t2 * 0.025), t * Math.PI, 0, Math.PI * 2);
    ctx.fill();
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
