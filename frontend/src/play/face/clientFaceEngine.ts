/**
 * Browser-side fallback for the Mickey's Gym face engine.
 * Used when /api/face-engine/caricature is unavailable (static/gh-pages).
 * Matches the server engine contract: 1024 canvas, black bg, bake LM layout.
 */

const SIZE = 1024;

const LM = {
  rightEye: { x: 0.382, y: 0.459 },
  leftEye: { x: 0.595, y: 0.443 },
  nose: { x: 0.5, y: 0.52 },
  mouth: { x: 0.504, y: 0.665 },
  chin: { x: 0.51, y: 0.8 },
  rightEar: { x: 0.162, y: 0.544, rx: 0.065, ry: 0.125 },
  leftEar: { x: 0.836, y: 0.536, rx: 0.065, ry: 0.125 },
  forehead: { x: 0.5, y: 0.295 },
};

type Rgb = { r: number; g: number; b: number };

function clamp(v: number) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function rgb(c: Rgb, shade = 1) {
  return `rgb(${clamp(c.r * shade)},${clamp(c.g * shade)},${clamp(c.b * shade)})`;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r * (1 - t) + b.r * t,
    g: a.g * (1 - t) + b.g * t,
    b: a.b * (1 - t) + b.b * t,
  };
}

function sample(ctx: CanvasRenderingContext2D, x: number, y: number, radius = 8): Rgb {
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
    const rr = data[i];
    const gg = data[i + 1];
    const bb = data[i + 2];
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    if (max < 20 || (min > 230 && max - min < 16)) continue;
    r += rr;
    g += gg;
    b += bb;
    n++;
  }
  if (!n) return { r: 210, g: 165, b: 125 };
  return { r: r / n, g: g / n, b: b / n };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load photo'));
    };
    img.src = url;
  });
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

/** Convert a face photo to a flat gym caricature in the browser. */
export async function clientFaceEngineCaricature(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = img.naturalWidth;
  sampleCanvas.height = img.naturalHeight;
  const sctx = sampleCanvas.getContext('2d')!;
  sctx.drawImage(img, 0, 0);

  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  // Heuristic face centre (full-frame selfie).
  const midX = sw * 0.5;
  const midY = sh * 0.42;
  const eyeY = sh * 0.38;
  const eyeSpan = sw * 0.22;

  const skin = sample(sctx, midX, midY + eyeSpan * 0.35, 14);
  const hair = sample(sctx, midX, Math.max(8, eyeY - eyeSpan * 1.2), 16);
  const iris = sample(sctx, midX - eyeSpan * 0.45, eyeY, 3);
  const lip = sample(sctx, midX, midY + eyeSpan * 0.95, 5);
  const brow = mix(hair, skin, 0.25);
  const ink = 'rgb(18,12,10)';

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SIZE, SIZE);

  const re = { x: LM.rightEye.x * SIZE, y: LM.rightEye.y * SIZE };
  const le = { x: LM.leftEye.x * SIZE, y: LM.leftEye.y * SIZE };
  const nose = { x: LM.nose.x * SIZE, y: LM.nose.y * SIZE };
  const mouth = { x: LM.mouth.x * SIZE, y: LM.mouth.y * SIZE };
  const chin = { x: LM.chin.x * SIZE, y: LM.chin.y * SIZE };
  const forehead = { x: LM.forehead.x * SIZE, y: LM.forehead.y * SIZE };
  const mid = { x: (re.x + le.x) / 2, y: (re.y + le.y) / 2 };
  const headRx = SIZE * 0.3;
  const headRy = SIZE * 0.355;
  const headC = { x: mid.x, y: mid.y + SIZE * 0.04 };

  // Neck
  ctx.fillStyle = rgb(skin);
  ctx.fillRect(chin.x - SIZE * 0.13, chin.y - SIZE * 0.02, SIZE * 0.26, SIZE * 0.22);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(chin.x - SIZE * 0.13, chin.y);
  ctx.lineTo(chin.x - SIZE * 0.11, SIZE * 0.98);
  ctx.moveTo(chin.x + SIZE * 0.13, chin.y);
  ctx.lineTo(chin.x + SIZE * 0.11, SIZE * 0.98);
  ctx.stroke();

  // Ears
  for (const ear of [LM.rightEar, LM.leftEar]) {
    fillEllipse(ctx, ear.x * SIZE, ear.y * SIZE, ear.rx * SIZE, ear.ry * SIZE, rgb(mix(skin, { r: 0, g: 0, b: 0 }, 0.08)));
    strokeEllipse(ctx, ear.x * SIZE, ear.y * SIZE, ear.rx * SIZE, ear.ry * SIZE, ink, 3);
  }

  // Hair mass
  fillEllipse(ctx, forehead.x, forehead.y - SIZE * 0.04, headRx * 1.08, SIZE * 0.16, rgb(hair));
  fillEllipse(ctx, LM.rightEar.x * SIZE - SIZE * 0.01, mid.y - SIZE * 0.04, SIZE * 0.06, SIZE * 0.18, rgb(hair));
  fillEllipse(ctx, LM.leftEar.x * SIZE + SIZE * 0.01, mid.y - SIZE * 0.04, SIZE * 0.06, SIZE * 0.18, rgb(hair));

  // Head
  fillEllipse(ctx, headC.x, headC.y, headRx, headRy, rgb(skin));

  // Crown fringe
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(headC.x, headC.y, headRx, headRy, 0, (200 * Math.PI) / 180, (340 * Math.PI) / 180);
  ctx.clip();
  fillEllipse(ctx, forehead.x, forehead.y - SIZE * 0.06, headRx * 0.98, SIZE * 0.14, rgb(hair));
  ctx.restore();

  // Brows
  ctx.strokeStyle = rgb(brow);
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (const [eye, side] of [
    [re, -1],
    [le, 1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(eye.x - side * SIZE * 0.06, eye.y - SIZE * 0.05);
    ctx.quadraticCurveTo(eye.x, eye.y - SIZE * 0.065, eye.x + side * SIZE * 0.055, eye.y - SIZE * 0.04);
    ctx.stroke();
  }

  // Eyes
  for (const eye of [re, le]) {
    fillEllipse(ctx, eye.x, eye.y, SIZE * 0.055, SIZE * 0.038, '#fafafa');
    strokeEllipse(ctx, eye.x, eye.y, SIZE * 0.055, SIZE * 0.038, ink, 4);
    fillEllipse(ctx, eye.x, eye.y, SIZE * 0.022, SIZE * 0.022, rgb(iris));
    fillEllipse(ctx, eye.x, eye.y, SIZE * 0.009, SIZE * 0.009, 'rgb(25,18,12)');
    fillEllipse(ctx, eye.x + SIZE * 0.008, eye.y - SIZE * 0.01, SIZE * 0.005, SIZE * 0.005, '#fff');
  }

  // Nose
  ctx.beginPath();
  ctx.moveTo(nose.x, nose.y - SIZE * 0.015);
  ctx.lineTo(nose.x + SIZE * 0.03, nose.y + SIZE * 0.05);
  ctx.lineTo(nose.x - SIZE * 0.012, nose.y + SIZE * 0.055);
  ctx.closePath();
  ctx.fillStyle = rgb(mix(skin, { r: 0, g: 0, b: 0 }, 0.1));
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Mouth
  fillEllipse(ctx, mouth.x, mouth.y, SIZE * 0.07, SIZE * 0.028, rgb(mix(lip, { r: 0, g: 0, b: 0 }, 0.12)));
  strokeEllipse(ctx, mouth.x, mouth.y, SIZE * 0.07, SIZE * 0.028, ink, 3);

  // Head outline
  strokeEllipse(ctx, headC.x, headC.y, headRx, headRy, ink, 5);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encode failed'))), 'image/png');
  });
}
