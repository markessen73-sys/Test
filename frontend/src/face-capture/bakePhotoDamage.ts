/**
 * Bake cumulative damage-stage PNGs onto a photo face using user-marked features.
 * Procedural overlays (bruise, plaster, bandage, etc.) anchored to feature ellipses.
 */
import type { CustomFaceFeatures, FaceFeatureMark } from './customFace';
import { DAMAGE_FACE_SEQUENCE, type FaceDamageId } from '../play/face/faceDamage';

const SIZE = 384; // HUD is small; keep stages compact for localStorage / runtime bake

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load face for damage bake'));
    img.src = src;
  });
}

function mark(
  features: CustomFaceFeatures,
  id: keyof CustomFaceFeatures,
  fallback: FaceFeatureMark
): FaceFeatureMark {
  return features[id] ?? fallback;
}

function deriveFeatures(features: CustomFaceFeatures): Required<
  Pick<
    CustomFaceFeatures,
    'leftEye' | 'rightEye' | 'nose' | 'mouth' | 'leftEar' | 'rightEar' | 'forehead' | 'chin'
  >
> {
  const leftEye = mark(features, 'leftEye', { cx: 0.38, cy: 0.42, rx: 0.08, ry: 0.05 });
  const rightEye = mark(features, 'rightEye', { cx: 0.62, cy: 0.42, rx: 0.08, ry: 0.05 });
  const nose = mark(features, 'nose', { cx: 0.5, cy: 0.52, rx: 0.07, ry: 0.09 });
  const mouth = mark(features, 'mouth', { cx: 0.5, cy: 0.68, rx: 0.12, ry: 0.05 });
  const leftEar = mark(features, 'leftEar', { cx: 0.14, cy: 0.5, rx: 0.06, ry: 0.1 });
  const rightEar = mark(features, 'rightEar', { cx: 0.86, cy: 0.5, rx: 0.06, ry: 0.1 });
  const midEyeX = (leftEye.cx + rightEye.cx) / 2;
  const midEyeY = (leftEye.cy + rightEye.cy) / 2;
  const iod = Math.abs(rightEye.cx - leftEye.cx) || 0.24;
  const forehead = mark(features, 'forehead', {
    cx: midEyeX,
    cy: Math.max(0.12, midEyeY - iod * 0.55),
    rx: iod * 0.85,
    ry: iod * 0.28,
  });
  const chin = mark(features, 'chin', {
    cx: mouth.cx,
    cy: Math.min(0.92, mouth.cy + iod * 0.55),
    rx: iod * 0.35,
    ry: iod * 0.18,
  });
  return { leftEye, rightEye, nose, mouth, leftEar, rightEar, forehead, chin };
}

function drawBlackEye(
  ctx: CanvasRenderingContext2D,
  eye: FaceFeatureMark,
  w: number,
  h: number
) {
  const x = eye.cx * w;
  const y = eye.cy * h;
  const rx = Math.max(14, eye.rx * w * 2.1);
  const ry = Math.max(12, eye.ry * h * 2.4);
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, 'rgba(25, 10, 35, 0.92)');
  g.addColorStop(0.35, 'rgba(70, 25, 55, 0.8)');
  g.addColorStop(0.7, 'rgba(110, 40, 50, 0.55)');
  g.addColorStop(1, 'rgba(120, 50, 40, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 8, 18, 0.65)';
  ctx.beginPath();
  ctx.ellipse(x, y - ry * 0.35, rx * 0.95, ry * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Reddish rim under brow
  ctx.fillStyle = 'rgba(160, 45, 55, 0.45)';
  ctx.beginPath();
  ctx.ellipse(x, y + ry * 0.25, rx * 0.85, ry * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSwollenEye(
  ctx: CanvasRenderingContext2D,
  eye: FaceFeatureMark,
  w: number,
  h: number
) {
  const x = eye.cx * w;
  const y = eye.cy * h;
  const rx = Math.max(16, eye.rx * w * 2.2);
  const ry = Math.max(14, eye.ry * h * 2.5);
  const g = ctx.createRadialGradient(x, y - ry * 0.1, 0, x, y, rx);
  g.addColorStop(0, 'rgba(220, 90, 80, 0.75)');
  g.addColorStop(0.45, 'rgba(180, 55, 65, 0.6)');
  g.addColorStop(0.8, 'rgba(150, 45, 50, 0.35)');
  g.addColorStop(1, 'rgba(140, 50, 50, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Puffy lid crease
  ctx.strokeStyle = 'rgba(90, 30, 40, 0.55)';
  ctx.lineWidth = Math.max(2, rx * 0.08);
  ctx.beginPath();
  ctx.ellipse(x, y - ry * 0.15, rx * 0.75, ry * 0.35, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
}

function drawCauliflowerEar(
  ctx: CanvasRenderingContext2D,
  ear: FaceFeatureMark,
  w: number,
  h: number,
  side: 'left' | 'right'
) {
  const x = ear.cx * w;
  const y = ear.cy * h;
  const rx = Math.max(12, ear.rx * w * 1.7);
  const ry = Math.max(18, ear.ry * h * 1.45);
  const out = side === 'left' ? -1 : 1;
  const g = ctx.createRadialGradient(x + out * rx * 0.1, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, 'rgba(230, 110, 95, 0.88)');
  g.addColorStop(0.45, 'rgba(190, 70, 70, 0.7)');
  g.addColorStop(1, 'rgba(160, 60, 50, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(200, 75, 70, 0.6)';
  ctx.beginPath();
  ctx.ellipse(x + out * rx * 0.15, y - ry * 0.2, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(170, 55, 60, 0.5)';
  ctx.beginPath();
  ctx.ellipse(x + out * rx * 0.05, y + ry * 0.15, rx * 0.4, ry * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawChinPlaster(
  ctx: CanvasRenderingContext2D,
  chin: FaceFeatureMark,
  w: number,
  h: number
) {
  const x = chin.cx * w;
  const y = chin.cy * h;
  const s = Math.max(18, chin.rx * w * 1.45);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.2);
  ctx.fillStyle = 'rgba(250, 246, 235, 0.97)';
  ctx.strokeStyle = 'rgba(160, 150, 130, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.fillRect(-s * 0.18, -s * 0.6, s * 0.36, s * 1.2);
  ctx.strokeRect(-s * 0.18, -s * 0.6, s * 0.36, s * 1.2);
  ctx.rotate(Math.PI / 2);
  ctx.fillRect(-s * 0.18, -s * 0.6, s * 0.36, s * 1.2);
  ctx.strokeRect(-s * 0.18, -s * 0.6, s * 0.36, s * 1.2);
  ctx.restore();
}

function drawMissingTooth(
  ctx: CanvasRenderingContext2D,
  mouth: FaceFeatureMark,
  w: number,
  h: number
) {
  const x = mouth.cx * w + mouth.rx * w * 0.18;
  const y = mouth.cy * h - mouth.ry * h * 0.1;
  // Dark gap in the smile
  ctx.fillStyle = 'rgba(15, 8, 12, 0.92)';
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(5, mouth.rx * w * 0.22), Math.max(8, mouth.ry * h * 0.7), 0, 0, Math.PI * 2);
  ctx.fill();
  // Lip shadow around gap
  ctx.strokeStyle = 'rgba(120, 50, 55, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(6, mouth.rx * w * 0.26), Math.max(9, mouth.ry * h * 0.8), 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBrokenNose(
  ctx: CanvasRenderingContext2D,
  nose: FaceFeatureMark,
  w: number,
  h: number
) {
  const x = nose.cx * w;
  const y = nose.cy * h;
  const rx = Math.max(14, nose.rx * w * 1.75);
  const ry = Math.max(16, nose.ry * h * 1.55);
  const g = ctx.createRadialGradient(x + rx * 0.15, y, 0, x, y, rx);
  g.addColorStop(0, 'rgba(210, 70, 85, 0.75)');
  g.addColorStop(0.55, 'rgba(170, 50, 60, 0.5)');
  g.addColorStop(1, 'rgba(160, 50, 50, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  // Crooked bridge line
  ctx.strokeStyle = 'rgba(60, 20, 28, 0.75)';
  ctx.lineWidth = Math.max(2.5, rx * 0.12);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - rx * 0.15, y - ry * 0.45);
  ctx.quadraticCurveTo(x + rx * 0.45, y, x + rx * 0.2, y + ry * 0.5);
  ctx.stroke();
}

function drawForeheadBandage(
  ctx: CanvasRenderingContext2D,
  forehead: FaceFeatureMark,
  w: number,
  h: number
) {
  const x = forehead.cx * w;
  const y = forehead.cy * h;
  const rw = Math.max(48, forehead.rx * w * 1.65);
  const rh = Math.max(16, forehead.ry * h * 1.65);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.08);
  ctx.fillStyle = 'rgba(252, 248, 240, 0.97)';
  ctx.beginPath();
  ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(170, 160, 140, 0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-rw * 0.85, -rh * 0.15);
  ctx.lineTo(rw * 0.85, rh * 0.12);
  ctx.stroke();
  // Small blood speck under bandage edge
  ctx.fillStyle = 'rgba(140, 30, 40, 0.45)';
  ctx.beginPath();
  ctx.ellipse(rw * 0.25, rh * 0.55, rw * 0.08, rh * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function applyInjury(
  ctx: CanvasRenderingContext2D,
  id: FaceDamageId,
  f: ReturnType<typeof deriveFeatures>,
  w: number,
  h: number
) {
  switch (id) {
    case 'cauliflowerLeftEar':
      drawCauliflowerEar(ctx, f.leftEar, w, h, 'left');
      break;
    case 'blackRightEye':
      drawBlackEye(ctx, f.rightEye, w, h);
      break;
    case 'chinCrossPlaster':
      drawChinPlaster(ctx, f.chin, w, h);
      break;
    case 'cauliflowerRightEar':
      drawCauliflowerEar(ctx, f.rightEar, w, h, 'right');
      break;
    case 'missingTooth':
      drawMissingTooth(ctx, f.mouth, w, h);
      break;
    case 'swollenLeftEye':
      drawSwollenEye(ctx, f.leftEye, w, h);
      break;
    case 'brokenNose':
      drawBrokenNose(ctx, f.nose, w, h);
      break;
    case 'foreheadBandage':
      drawForeheadBandage(ctx, f.forehead, w, h);
      break;
  }
}

/**
 * Returns 8 cumulative damage-stage data URLs + knockout URL for the HUD.
 * Injuries are placed from user-highlighted feature marks.
 */
export async function bakePhotoDamageStages(
  cleanDataUrl: string,
  features: CustomFaceFeatures,
  knockoutDataUrl: string
): Promise<{ stages: string[]; knockout: string }> {
  const img = await loadImage(cleanDataUrl);
  const f = deriveFeatures(features);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No canvas');

  const stages: string[] = [];
  for (let i = 0; i < DAMAGE_FACE_SEQUENCE.length; i++) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    for (let j = 0; j <= i; j++) {
      applyInjury(ctx, DAMAGE_FACE_SEQUENCE[j]!, f, SIZE, SIZE);
    }
    stages.push(canvas.toDataURL('image/png'));
  }

  return { stages, knockout: knockoutDataUrl };
}
