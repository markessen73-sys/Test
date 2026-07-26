/**
 * Build a flat 2D boxing caricature from a face photo using landmarks + color sampling.
 * Always produces a cartoon on black (never a filtered photo), aimed at the gym bake LM layout.
 */
import { detectFaceLandmarks, type FaceLandmarks } from './faceDetect';
import { LM, W, H } from '../bake/faceDamageBake';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function clampByte(v: number) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function sampleRgb(ctx: CanvasRenderingContext2D, x: number, y: number, radius = 5): Rgb {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const x0 = Math.max(0, Math.floor(x - radius));
  const y0 = Math.max(0, Math.floor(y - radius));
  const x1 = Math.min(w - 1, Math.ceil(x + radius));
  const y1 = Math.min(h - 1, Math.ceil(y + radius));
  const data = ctx.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue;
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    if (min > 220 && max - min < 18) continue; // skip white/backdrop
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  if (!n) return { r: 220, g: 170, b: 130 };
  return { r: r / n, g: g / n, b: b / n };
}

function rgbStr(c: Rgb, shade = 1) {
  return `rgb(${clampByte(c.r * shade)},${clampByte(c.g * shade)},${clampByte(c.b * shade)})`;
}
function darken(c: Rgb, t: number): Rgb {
  return { r: c.r * (1 - t), g: c.g * (1 - t), b: c.b * (1 - t) };
}
function lighten(c: Rgb, t: number): Rgb {
  return { r: c.r + (255 - c.r) * t, g: c.g + (255 - c.g) * t, b: c.b + (255 - c.b) * t };
}

function fillEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string
) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  width: number
) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

export async function paintFlatCaricature(
  source: HTMLImageElement | HTMLCanvasElement
): Promise<Blob> {
  const srcW = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  const sample = document.createElement('canvas');
  sample.width = srcW;
  sample.height = srcH;
  const sctx = sample.getContext('2d')!;
  sctx.drawImage(source, 0, 0);

  let lm: FaceLandmarks | null = null;
  try {
    lm = await detectFaceLandmarks(source);
  } catch {
    lm = null;
  }

  const re = lm
    ? { x: lm.rightEye.x * srcW, y: lm.rightEye.y * srcH }
    : { x: srcW * 0.38, y: srcH * 0.42 };
  const le = lm
    ? { x: lm.leftEye.x * srcW, y: lm.leftEye.y * srcH }
    : { x: srcW * 0.62, y: srcH * 0.42 };
  const mouth = lm
    ? { x: lm.mouth.x * srcW, y: lm.mouth.y * srcH }
    : { x: srcW * 0.5, y: srcH * 0.68 };

  const midX = (re.x + le.x) / 2;
  const midY = (re.y + le.y) / 2;
  const eyeDist = Math.hypot(le.x - re.x, le.y - re.y) || srcW * 0.25;

  const skin = sampleRgb(sctx, midX, mouth.y - eyeDist * 0.4, 10);
  const hair = sampleRgb(sctx, midX, Math.max(6, midY - eyeDist * 1.4), 12);
  const irisR = sampleRgb(sctx, re.x, re.y, 2);
  const irisL = sampleRgb(sctx, le.x, le.y, 2);
  const lip = sampleRgb(sctx, mouth.x, mouth.y, 3);

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const dRe = { x: LM.rightEye.x * W, y: LM.rightEye.y * H };
  const dLe = { x: LM.leftEye.x * W, y: LM.leftEye.y * H };
  const dMouth = { x: LM.mouth.x * W, y: LM.mouth.y * H };
  const dNose = { x: LM.nose.x * W, y: LM.nose.y * H };
  const headCx = 0.5 * W;
  const headCy = 0.52 * H;
  const headRx = 0.34 * W;
  const headRy = 0.4 * H;

  // Hair mass behind head.
  fillEllipse(ctx, headCx, headCy - headRy * 0.32, headRx * 1.15, headRy * 0.9, rgbStr(hair, 0.95));
  fillEllipse(ctx, headCx, headCy - headRy * 0.55, headRx * 0.98, headRy * 0.58, rgbStr(lighten(hair, 0.1)));

  // Ears.
  const ear = rgbStr(darken(skin, 0.05));
  fillEllipse(ctx, LM.rightEar.x * W, LM.rightEar.y * H, LM.rightEar.rx * W, LM.rightEar.ry * H, ear);
  fillEllipse(ctx, LM.leftEar.x * W, LM.leftEar.y * H, LM.leftEar.rx * W, LM.leftEar.ry * H, ear);
  strokeEllipse(ctx, LM.rightEar.x * W, LM.rightEar.y * H, LM.rightEar.rx * W, LM.rightEar.ry * H, '#1a1008', 5);
  strokeEllipse(ctx, LM.leftEar.x * W, LM.leftEar.y * H, LM.leftEar.rx * W, LM.leftEar.ry * H, '#1a1008', 5);

  // Face.
  fillEllipse(ctx, headCx, headCy, headRx, headRy, rgbStr(skin));
  strokeEllipse(ctx, headCx, headCy, headRx, headRy, '#1a1008', 8);

  // Hairline over forehead + temples.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(headCx, headCy, headRx, headRy, 0, 0, Math.PI * 2);
  ctx.clip();
  fillEllipse(ctx, headCx, headCy - headRy * 0.62, headRx * 1.0, headRy * 0.45, rgbStr(hair));
  fillEllipse(ctx, headCx - headRx * 0.8, headCy - 10, 52, 100, rgbStr(darken(hair, 0.05)));
  fillEllipse(ctx, headCx + headRx * 0.8, headCy - 10, 52, 100, rgbStr(darken(hair, 0.05)));
  ctx.restore();

  // Brows (exaggerated).
  ctx.strokeStyle = rgbStr(darken(hair, 0.3));
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(dRe.x - 52, dRe.y - 44);
  ctx.quadraticCurveTo(dRe.x, dRe.y - 62, dRe.x + 48, dRe.y - 40);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(dLe.x + 52, dLe.y - 44);
  ctx.quadraticCurveTo(dLe.x, dLe.y - 62, dLe.x - 48, dLe.y - 40);
  ctx.stroke();

  // Eyes.
  for (const [eye, iris] of [
    [dRe, irisR],
    [dLe, irisL],
  ] as const) {
    fillEllipse(ctx, eye.x, eye.y, 56, 44, '#f5f1e9');
    strokeEllipse(ctx, eye.x, eye.y, 56, 44, '#1a1008', 5);
    const ic = { r: Math.max(iris.r, 45), g: Math.max(iris.g, 35), b: Math.max(iris.b, 25) };
    fillEllipse(ctx, eye.x, eye.y + 2, 30, 30, rgbStr(ic));
    fillEllipse(ctx, eye.x, eye.y + 2, 13, 13, '#0a0604');
    fillEllipse(ctx, eye.x - 7, eye.y - 5, 6, 6, '#fff');
  }

  // Nose (slightly exaggerated).
  ctx.strokeStyle = rgbStr(darken(skin, 0.32));
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(dNose.x - 6, dNose.y - 55);
  ctx.quadraticCurveTo(dNose.x + 32, dNose.y - 8, dNose.x + 12, dNose.y + 32);
  ctx.quadraticCurveTo(dNose.x, dNose.y + 42, dNose.x - 22, dNose.y + 24);
  ctx.stroke();
  fillEllipse(ctx, dNose.x - 16, dNose.y + 20, 9, 7, rgbStr(darken(skin, 0.18)));
  fillEllipse(ctx, dNose.x + 16, dNose.y + 20, 9, 7, rgbStr(darken(skin, 0.18)));

  // Mouth.
  const lipC = {
    r: Math.max(lip.r, skin.r * 0.9),
    g: Math.min(lip.g, skin.g * 0.88),
    b: Math.min(lip.b, skin.b * 0.82),
  };
  fillEllipse(ctx, dMouth.x, dMouth.y + 8, 78, 32, rgbStr(lighten(lipC, 0.04)));
  strokeEllipse(ctx, dMouth.x, dMouth.y + 8, 78, 32, '#1a1008', 5);
  fillEllipse(ctx, dMouth.x, dMouth.y + 4, 48, 12, '#f7f2e8');
  ctx.beginPath();
  ctx.moveTo(dMouth.x - 60, dMouth.y + 4);
  ctx.quadraticCurveTo(dMouth.x, dMouth.y + 26, dMouth.x + 60, dMouth.y + 4);
  ctx.strokeStyle = rgbStr(darken(lipC, 0.4));
  ctx.lineWidth = 4;
  ctx.stroke();

  // Neck.
  ctx.fillStyle = rgbStr(darken(skin, 0.04));
  ctx.beginPath();
  ctx.moveTo(headCx - 95, headCy + headRy * 0.72);
  ctx.lineTo(headCx + 95, headCy + headRy * 0.72);
  ctx.lineTo(headCx + 72, H - 18);
  ctx.lineTo(headCx - 72, H - 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1a1008';
  ctx.lineWidth = 6;
  ctx.stroke();

  strokeEllipse(ctx, headCx, headCy, headRx, headRy, '#1a1008', 8);

  return new Promise((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode caricature'))), 'image/png');
  });
}
