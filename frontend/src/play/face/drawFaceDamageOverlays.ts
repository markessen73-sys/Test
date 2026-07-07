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

function unit(canvasW: number, canvasH: number): number {
  return faceDrawWidth(canvasW, canvasH) * 0.2;
}

/**
 * Periorbital hematoma — classic boxer shiner.
 * Purple-blue-black raccoon ring, puffy lids, half-shut bruised eye.
 */
function drawBlackEye(ctx: CanvasRenderingContext2D, x: number, y: number, u: number) {
  ctx.save();
  ctx.translate(x, y);

  // Outer bruise halo — fades into cheek and brow
  const outer = ctx.createRadialGradient(0, u * 0.1, u * 0.1, 0, u * 0.1, u * 1.45);
  outer.addColorStop(0, 'rgba(25, 10, 35, 0)');
  outer.addColorStop(0.35, 'rgba(90, 35, 75, 0.35)');
  outer.addColorStop(0.6, 'rgba(130, 50, 90, 0.45)');
  outer.addColorStop(0.8, 'rgba(165, 75, 65, 0.25)');
  outer.addColorStop(1, 'rgba(190, 110, 75, 0)');
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.ellipse(0, u * 0.12, u * 1.35, u * 1.15, -0.05, 0, Math.PI * 2);
  ctx.fill();

  // Core orbital bruise — darkest under eye and at inner corner
  ctx.globalCompositeOperation = 'multiply';
  const core = ctx.createRadialGradient(-u * 0.12, u * 0.22, u * 0.05, 0, u * 0.08, u * 1.05);
  core.addColorStop(0, 'rgba(12, 4, 18, 0.95)');
  core.addColorStop(0.2, 'rgba(35, 12, 55, 0.9)');
  core.addColorStop(0.45, 'rgba(70, 28, 95, 0.82)');
  core.addColorStop(0.65, 'rgba(105, 42, 110, 0.65)');
  core.addColorStop(0.82, 'rgba(145, 58, 95, 0.4)');
  core.addColorStop(1, 'rgba(175, 90, 70, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(0, u * 0.1, u * 1.1, u * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();

  // Blue-purple upper orbit ring
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = 'rgba(55, 65, 145, 0.45)';
  ctx.beginPath();
  ctx.ellipse(0, -u * 0.05, u * 1.05, u * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';

  // Swollen puffy upper lid — droops over eye
  const upperLid = ctx.createLinearGradient(0, -u * 0.45, 0, u * 0.05);
  upperLid.addColorStop(0, 'rgba(210, 165, 175, 0.7)');
  upperLid.addColorStop(0.5, 'rgba(175, 120, 145, 0.65)');
  upperLid.addColorStop(1, 'rgba(130, 70, 100, 0.5)');
  ctx.fillStyle = upperLid;
  ctx.beginPath();
  ctx.ellipse(0, -u * 0.08, u * 1.08, u * 0.38, -0.06, 0, Math.PI * 2);
  ctx.fill();

  // Puffy lower lid water-bag
  ctx.fillStyle = 'rgba(115, 45, 80, 0.55)';
  ctx.beginPath();
  ctx.ellipse(0, u * 0.42, u * 0.88, u * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Half-closed bruised eye slit — obscures the blue iris beneath
  ctx.fillStyle = 'rgba(22, 8, 28, 0.92)';
  ctx.beginPath();
  ctx.ellipse(0, u * 0.1, u * 0.5, u * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crusted swollen lid crease
  ctx.strokeStyle = 'rgba(55, 20, 50, 0.95)';
  ctx.lineWidth = u * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-u * 0.52, u * 0.08);
  ctx.quadraticCurveTo(0, u * 0.28, u * 0.52, u * 0.08);
  ctx.stroke();

  // Inner corner blood pocket
  ctx.fillStyle = 'rgba(80, 15, 25, 0.5)';
  ctx.beginPath();
  ctx.ellipse(-u * 0.38, u * 0.14, u * 0.16, u * 0.14, 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Acute periorbital edema — red inflamed tissue, nearly shut (not bruised). */
function drawSwollenEye(ctx: CanvasRenderingContext2D, x: number, y: number, u: number) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(240, 130, 115, 0.45)';
  ctx.beginPath();
  ctx.ellipse(0, u * 0.08, u * 1.3, u * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();

  const lid = ctx.createRadialGradient(0, -u * 0.18, 0, 0, -u * 0.12, u * 0.75);
  lid.addColorStop(0, 'rgba(255, 215, 200, 0.9)');
  lid.addColorStop(0.45, 'rgba(245, 155, 135, 0.75)');
  lid.addColorStop(1, 'rgba(215, 95, 90, 0.4)');
  ctx.fillStyle = lid;
  ctx.beginPath();
  ctx.ellipse(0, -u * 0.14, u * 1.15, u * 0.58, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(230, 160, 150, 0.7)';
  ctx.beginPath();
  ctx.ellipse(0, u * 0.44, u * 0.92, u * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(110, 40, 40, 0.9)';
  ctx.lineWidth = u * 0.11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-u * 0.5, u * 0.04);
  ctx.quadraticCurveTo(0, u * 0.24, u * 0.5, u * 0.04);
  ctx.stroke();

  ctx.restore();
}

/**
 * Swollen auricular hematoma — right ear (massive bulbous distension).
 * Calibrated against reference caricature (swollen right ear with suture line).
 */
function drawCauliflowerEarRight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  side: -1 | 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side, 1);

  // Enlarged smooth pinna — ~2× volume, protrudes forward and upward
  const skin = ctx.createLinearGradient(-u * 0.2, -u * 0.65, u * 1.05, u * 0.85);
  skin.addColorStop(0, '#f0d0bc');
  skin.addColorStop(0.3, '#e0b0a0');
  skin.addColorStop(0.6, '#d08880');
  skin.addColorStop(1, '#b87070');
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(u * 0.02, -u * 0.58);
  ctx.bezierCurveTo(u * 0.85, -u * 0.72, u * 1.28, -u * 0.28, u * 1.15, u * 0.28);
  ctx.bezierCurveTo(u * 1.05, u * 0.72, u * 0.62, u * 1.05, u * 0.2, u * 0.95);
  ctx.bezierCurveTo(-u * 0.08, u * 0.85, -u * 0.18, u * 0.42, -u * 0.05, u * 0.08);
  ctx.bezierCurveTo(-u * 0.1, -u * 0.22, -u * 0.08, -u * 0.42, u * 0.02, -u * 0.58);
  ctx.closePath();
  ctx.fill();

  // Deep reddish-purple hematoma wash
  ctx.globalCompositeOperation = 'multiply';
  const bruise = ctx.createRadialGradient(u * 0.5, u * 0.02, u * 0.05, u * 0.5, u * 0.02, u * 1.05);
  bruise.addColorStop(0, 'rgba(95, 25, 55, 0.85)');
  bruise.addColorStop(0.35, 'rgba(130, 35, 65, 0.78)');
  bruise.addColorStop(0.6, 'rgba(165, 48, 72, 0.62)');
  bruise.addColorStop(0.82, 'rgba(185, 65, 78, 0.38)');
  bruise.addColorStop(1, 'rgba(200, 90, 85, 0.12)');
  ctx.fillStyle = bruise;
  ctx.beginPath();
  ctx.ellipse(u * 0.48, u * 0.05, u * 0.95, u * 0.98, 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Magenta-pink inflamed overlay at peak swelling
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = 'rgba(180, 60, 90, 0.4)';
  ctx.beginPath();
  ctx.ellipse(u * 0.52, -u * 0.08, u * 0.72, u * 0.65, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Taut swollen skin sheen — bright highlight along outer rim
  const sheen = ctx.createLinearGradient(u * 0.1, -u * 0.5, u * 1.0, u * 0.3);
  sheen.addColorStop(0, 'rgba(255, 230, 215, 0.7)');
  sheen.addColorStop(0.4, 'rgba(255, 210, 195, 0.45)');
  sheen.addColorStop(1, 'rgba(255, 190, 180, 0.1)');
  ctx.strokeStyle = sheen;
  ctx.lineWidth = u * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(u * 0.1, -u * 0.52);
  ctx.bezierCurveTo(u * 0.78, -u * 0.62, u * 1.12, -u * 0.18, u * 1.02, u * 0.32);
  ctx.stroke();

  // Specular spot — fluid-filled taut surface
  ctx.fillStyle = 'rgba(255, 245, 240, 0.45)';
  ctx.beginPath();
  ctx.ellipse(u * 0.62, -u * 0.18, u * 0.18, u * 0.12, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Inner ear bowl — smoothed out by swelling
  ctx.fillStyle = 'rgba(120, 40, 58, 0.4)';
  ctx.beginPath();
  ctx.ellipse(u * 0.42, u * 0.14, u * 0.42, u * 0.52, 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Suture / scab line across upper cartilage
  drawEarSuture(ctx, u, 0.15, -0.32, 0.88, -0.34, 6);

  // Swollen lobe — smooth bulbous bottom, enlarged
  const lobe = ctx.createRadialGradient(u * 0.24, u * 0.85, 0, u * 0.24, u * 0.85, u * 0.34);
  lobe.addColorStop(0, 'rgba(210, 110, 105, 0.75)');
  lobe.addColorStop(0.5, 'rgba(175, 70, 75, 0.6)');
  lobe.addColorStop(1, 'rgba(145, 55, 65, 0.3)');
  ctx.fillStyle = lobe;
  ctx.beginPath();
  ctx.ellipse(u * 0.24, u * 0.85, u * 0.32, u * 0.24, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Left ear hematoma — preserves ear silhouette with purple bruising and cross-stitch suture.
 * Calibrated against reference caricature (cauliflower left ear).
 */
function drawCauliflowerEarLeft(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  u: number,
  side: -1 | 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side, 1);

  // Moderate thickening — ear outline preserved, puffy but not 2× volume
  const skin = ctx.createLinearGradient(-u * 0.1, -u * 0.5, u * 0.75, u * 0.7);
  skin.addColorStop(0, '#ecd0bc');
  skin.addColorStop(0.45, '#d8a898');
  skin.addColorStop(1, '#c08880');
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(u * 0.08, -u * 0.48);
  ctx.bezierCurveTo(u * 0.62, -u * 0.56, u * 0.95, -u * 0.2, u * 0.88, u * 0.18);
  ctx.bezierCurveTo(u * 0.82, u * 0.52, u * 0.5, u * 0.78, u * 0.22, u * 0.72);
  ctx.bezierCurveTo(-u * 0.02, u * 0.66, -u * 0.08, u * 0.32, u * 0.02, u * 0.06);
  ctx.bezierCurveTo(-u * 0.04, -u * 0.15, -u * 0.02, -u * 0.32, u * 0.08, -u * 0.48);
  ctx.closePath();
  ctx.fill();

  // Deep burgundy bruise in scaphoid / antihelix folds
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(85, 18, 42, 0.82)';
  ctx.beginPath();
  ctx.ellipse(u * 0.42, -u * 0.08, u * 0.4, u * 0.34, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(100, 22, 48, 0.78)';
  ctx.beginPath();
  ctx.ellipse(u * 0.38, u * 0.18, u * 0.44, u * 0.4, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Dark red concha wash
  ctx.fillStyle = 'rgba(130, 32, 55, 0.58)';
  ctx.beginPath();
  ctx.ellipse(u * 0.36, u * 0.12, u * 0.36, u * 0.44, 0.06, 0, Math.PI * 2);
  ctx.fill();

  // Outer helix rim — still defined through swelling
  ctx.strokeStyle = 'rgba(220, 175, 160, 0.6)';
  ctx.lineWidth = u * 0.05;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(u * 0.1, -u * 0.44);
  ctx.bezierCurveTo(u * 0.58, -u * 0.52, u * 0.9, -u * 0.16, u * 0.84, u * 0.22);
  ctx.stroke();

  // Slightly swollen lobe
  ctx.fillStyle = 'rgba(185, 95, 95, 0.55)';
  ctx.beginPath();
  ctx.ellipse(u * 0.22, u * 0.7, u * 0.24, u * 0.18, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Cross-stitch suture along outer helix rim (drawn last, on top)
  ctx.strokeStyle = '#120608';
  ctx.lineWidth = u * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(u * 0.12, -u * 0.42);
  ctx.bezierCurveTo(u * 0.55, -u * 0.5, u * 0.88, -u * 0.14, u * 0.8, u * 0.08);
  ctx.stroke();

  ctx.lineWidth = u * 0.042;
  const suturePts = [
    [0.22, -0.46], [0.38, -0.48], [0.54, -0.44], [0.68, -0.36], [0.78, -0.22],
  ];
  for (const [px, py] of suturePts) {
    const sx = u * px;
    const sy = u * py;
    const cs = u * 0.075;
    ctx.beginPath();
    ctx.moveTo(sx - cs, sy - cs * 0.55);
    ctx.lineTo(sx + cs, sy + cs * 0.55);
    ctx.moveTo(sx + cs, sy - cs * 0.55);
    ctx.lineTo(sx - cs, sy + cs * 0.55);
    ctx.stroke();
  }

  ctx.restore();
}

/** Horizontal suture line with optional cross-stitch marks. */
function drawEarSuture(
  ctx: CanvasRenderingContext2D,
  u: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stitches: number,
  crossStitch = false
) {
  ctx.strokeStyle = 'rgba(12, 4, 8, 1)';
  ctx.lineWidth = u * (crossStitch ? 0.08 : 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(u * x0, u * y0);
  ctx.quadraticCurveTo(u * ((x0 + x1) / 2), u * ((y0 + y1) / 2 + 0.04), u * x1, u * y1);
  ctx.stroke();

  const stitchW = crossStitch ? 0.045 : 0.028;
  ctx.lineWidth = u * stitchW;
  for (let i = 0; i < stitches; i++) {
    const t = (i + 0.5) / stitches;
    const sx = u * (x0 + t * (x1 - x0));
    const sy = u * (y0 + t * (y1 - y0) + 0.02 * Math.sin(t * Math.PI));
    ctx.beginPath();
    ctx.moveTo(sx, sy - u * 0.07);
    ctx.lineTo(sx, sy + u * 0.07);
    ctx.stroke();
    if (crossStitch) {
      const cs = u * 0.065;
      ctx.beginPath();
      ctx.moveTo(sx - cs, sy - cs * 0.65);
      ctx.lineTo(sx + cs, sy + cs * 0.65);
      ctx.moveTo(sx + cs, sy - cs * 0.65);
      ctx.lineTo(sx - cs, sy + cs * 0.65);
      ctx.stroke();
    }
  }
}

/** Ringside cut dressing — horizontal gauze pad taped across the forehead. */
function drawForeheadBandage(ctx: CanvasRenderingContext2D, x: number, y: number, u: number) {
  ctx.save();
  ctx.translate(x, y);

  // Skin shadow beneath pad
  ctx.fillStyle = 'rgba(60, 35, 30, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, u * 0.1, u * 2.15, u * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main horizontal gauze pad
  drawGauzePad(ctx, 0, u * 0.02, u * 2.05, u * 0.42);

  // Cross strips of adhesive tape at temples
  drawMedicalTape(ctx, -u * 1.12, u * 0.02, u * 0.38, u * 0.48, -0.35);
  drawMedicalTape(ctx, u * 1.12, u * 0.02, u * 0.38, u * 0.48, 0.35);

  // Vertical hold-down tape over center
  drawMedicalTape(ctx, 0, u * 0.02, u * 0.22, u * 0.52, 0);

  // Blood seepage through gauze
  ctx.fillStyle = 'rgba(145, 28, 28, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-u * 0.15, u * 0.04, u * 0.16, u * 0.12, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(100, 18, 18, 0.35)';
  ctx.beginPath();
  ctx.ellipse(-u * 0.12, u * 0.08, u * 0.28, u * 0.08, -0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawGauzePad(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number
) {
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const r = h * 0.28;

  // Padded body with slight puff
  const body = ctx.createLinearGradient(x0, y0, x0, y0 + h);
  body.addColorStop(0, '#faf6ee');
  body.addColorStop(0.4, '#f0ebe2');
  body.addColorStop(1, '#d8d0c4');
  ctx.fillStyle = body;
  ctx.strokeStyle = '#b8b0a0';
  ctx.lineWidth = h * 0.06;
  roundRect(ctx, x0, y0, w, h, r);
  ctx.fill();
  ctx.stroke();

  // Gauze cross-weave texture
  ctx.strokeStyle = 'rgba(160, 150, 135, 0.5)';
  ctx.lineWidth = h * 0.035;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.06, cy + i * h * 0.11);
    ctx.lineTo(x0 + w * 0.94, cy + i * h * 0.11);
    ctx.stroke();
  }
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * w * 0.07, y0 + h * 0.12);
    ctx.lineTo(cx + i * w * 0.07, y0 + h * 0.88);
    ctx.stroke();
  }

  // Top highlight — cotton pad sheen
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = h * 0.05;
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0 + h * 0.14);
  ctx.lineTo(x0 + w - r, y0 + h * 0.14);
  ctx.stroke();
}

function drawMedicalTape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const x0 = -w / 2;
  const y0 = -h / 2;

  ctx.fillStyle = '#e8dcc8';
  ctx.strokeStyle = '#c8bca8';
  ctx.lineWidth = h * 0.08;
  roundRect(ctx, x0, y0, w, h, h * 0.15);
  ctx.fill();
  ctx.stroke();

  // Tape fiber lines
  ctx.strokeStyle = 'rgba(180, 165, 140, 0.45)';
  ctx.lineWidth = h * 0.04;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.15, cy + i * h * 0.22 - cy);
    ctx.lineTo(x0 + w * 0.85, cy + i * h * 0.22 - cy);
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

function drawBrokenNose(ctx: CanvasRenderingContext2D, x: number, y: number, u: number) {
  ctx.save();
  ctx.translate(x, y);

  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(165, 55, 50, 0.55)';
  ctx.beginPath();
  ctx.ellipse(u * 0.1, 0, u * 0.45, u * 0.58, 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.strokeStyle = '#4a1414';
  ctx.lineWidth = u * 0.08;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-u * 0.1, -u * 0.45);
  ctx.quadraticCurveTo(u * 0.28, u * 0.02, u * 0.15, u * 0.52);
  ctx.stroke();

  ctx.fillStyle = 'rgba(110, 30, 30, 0.6)';
  ctx.beginPath();
  ctx.ellipse(u * 0.22, -u * 0.04, u * 0.2, u * 0.14, 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSwollenLip(ctx: CanvasRenderingContext2D, x: number, y: number, u: number) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(195, 45, 58, 0.75)';
  ctx.beginPath();
  ctx.ellipse(0, u * 0.16, u * 0.58, u * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(110, 18, 28, 0.85)';
  ctx.lineWidth = u * 0.055;
  ctx.beginPath();
  ctx.moveTo(-u * 0.44, u * 0.08);
  ctx.lineTo(u * 0.44, u * 0.08);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-u * 0.14, u * 0.05);
  ctx.lineTo(-u * 0.08, u * 0.24);
  ctx.stroke();

  ctx.restore();
}

/** Paint accumulated injuries on top of the base face texture. */
export function drawFaceDamageOverlays(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  damages: readonly FaceDamageId[]
) {
  if (!damages.length) return;

  const u = unit(canvasW, canvasH);
  const [lx, ly] = toCanvas(0.3493, 0.3464, canvasW, canvasH);
  const [rx, ry] = toCanvas(0.6487, 0.3464, canvasW, canvasH);
  const [nx, ny] = toCanvas(0.499, 0.456, canvasW, canvasH);
  const [mx, my] = toCanvas(0.499, 0.597, canvasW, canvasH);
  // Anatomical left/right ears (subject's left = image right, subject's right = image left).
  const [anatLeftEarX, anatLeftEarY] = toCanvas(0.86, 0.42, canvasW, canvasH);
  const [anatRightEarX, anatRightEarY] = toCanvas(0.14, 0.42, canvasW, canvasH);
  const [foreheadX, foreheadY] = toCanvas(0.5, 0.19, canvasW, canvasH);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';

  for (const d of damages) {
    switch (d) {
      case 'cauliflowerLeftEar':
        drawCauliflowerEarLeft(ctx, anatLeftEarX, anatLeftEarY, u * 1.5, 1);
        break;
      case 'cauliflowerRightEar':
        drawCauliflowerEarRight(ctx, anatRightEarX, anatRightEarY, u * 1.65, -1);
        break;
      case 'blackLeftEye':
        drawBlackEye(ctx, lx, ly, u);
        break;
      case 'swollenRightEye':
        drawSwollenEye(ctx, rx, ry, u);
        break;
      case 'foreheadBandage':
        drawForeheadBandage(ctx, foreheadX, foreheadY, u);
        break;
      case 'brokenNose':
        drawBrokenNose(ctx, nx, ny, u);
        break;
      case 'swollenBottomLip':
        drawSwollenLip(ctx, mx, my, u);
        break;
    }
  }

  ctx.restore();
}
