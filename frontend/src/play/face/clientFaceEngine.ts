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

export type FaceEngineMode = 'full' | 'skin' | 'eyes';

type Rgb = { r: number; g: number; b: number };

type SkinTone = {
  rgb: Rgb;
  hex: string;
  sampleCount: number;
};

type EyeSample = {
  iris: Rgb;
  irisHex: string;
  irisCount: number;
  eyeScale: number;
  hasGlasses: boolean;
  glasses: Rgb;
  glassesHex: string;
};

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

function toHex(c: Rgb): string {
  const h = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function medianChannel(vals: number[]): number {
  if (!vals.length) return 80;
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function medianRgb(pool: number[]): Rgb {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let i = 0; i < pool.length; i += 3) {
    rs.push(pool[i]);
    gs.push(pool[i + 1]);
    bs.push(pool[i + 2]);
  }
  return { r: medianChannel(rs), g: medianChannel(gs), b: medianChannel(bs) };
}

/** Rough RGB→YCrCb (same ranges as OpenCV / server skin.py). */
function isSkinYCrCb(r: number, g: number, b: number): boolean {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  return y > 40 && y < 240 && cr >= 133 && cr <= 173 && cb >= 77 && cb <= 127;
}

function sampleSkinTone(ctx: CanvasRenderingContext2D): SkinTone {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const fx = Math.floor(w * 0.18);
  const fy = Math.floor(h * 0.12);
  const fw = Math.floor(w * 0.64);
  const fh = Math.floor(h * 0.72);
  const x0 = fx + Math.floor(fw * 0.05);
  const y0 = fy + Math.floor(fh * 0.18);
  const x1 = fx + fw - Math.floor(fw * 0.05);
  const y1 = fy + Math.floor(fh * 0.78);
  const rw = Math.max(1, x1 - x0);
  const rh = Math.max(1, y1 - y0);
  const data = ctx.getImageData(x0, y0, rw, rh).data;

  const prefer: number[] = [];
  const allSkin: number[] = [];
  const bandY0 = Math.floor(rh * 0.28);
  const bandY1 = Math.floor(rh * 0.72);
  const leftCheek = Math.floor(rw * 0.38);
  const rightCheek = Math.floor(rw * 0.62);
  const foreY0 = Math.floor(rh * 0.15);
  const foreY1 = Math.floor(rh * 0.35);
  const foreX0 = Math.floor(rw * 0.3);
  const foreX1 = Math.floor(rw * 0.7);

  for (let py = 0; py < rh; py++) {
    for (let px = 0; px < rw; px++) {
      const i = (py * rw + px) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!isSkinYCrCb(r, g, b)) continue;
      allSkin.push(r, g, b);
      const inCheek = py >= bandY0 && py < bandY1 && (px < leftCheek || px >= rightCheek);
      const inFore = py >= foreY0 && py < foreY1 && px >= foreX0 && px < foreX1;
      if (inCheek || inFore) prefer.push(r, g, b);
    }
  }

  const pool = prefer.length >= 120 ? prefer : allSkin.length >= 60 ? allSkin : null;
  if (!pool) {
    const fallback = sample(ctx, w * 0.5, h * 0.48, 18);
    return { rgb: fallback, hex: toHex(fallback), sampleCount: 0 };
  }
  const tone = medianRgb(pool);
  return { rgb: tone, hex: toHex(tone), sampleCount: pool.length / 3 };
}

function refineEyeCenter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  eyeSpan: number
): { x: number; y: number } {
  const r = Math.max(8, Math.floor(eyeSpan * 0.16));
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const size = r * 2;
  const data = ctx.getImageData(x0, y0, size, size).data;
  let best = 999;
  let bx = cx;
  let by = cy;
  const pad = Math.max(2, Math.floor(r / 5));
  for (let py = pad; py < size - pad; py++) {
    for (let px = pad; px < size - pad; px++) {
      const i = (py * size + px) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < best) {
        best = lum;
        bx = x0 + px;
        by = y0 + py;
      }
    }
  }
  if (best > 140) return { x: cx, y: cy };
  return { x: bx, y: by };
}

function sampleIrisAt(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  eyeSpan: number
): { rgb: Rgb; count: number } {
  const refined = refineEyeCenter(ctx, cx, cy, eyeSpan);
  cx = refined.x;
  cy = refined.y;
  const rOut = Math.max(4, Math.floor(eyeSpan * 0.085));
  const rIn = Math.max(1, Math.floor(rOut * 0.32));
  const x0 = Math.max(0, Math.floor(cx - rOut));
  const y0 = Math.max(0, Math.floor(cy - rOut));
  const x1 = Math.min(ctx.canvas.width - 1, Math.ceil(cx + rOut));
  const y1 = Math.min(ctx.canvas.height - 1, Math.ceil(cy + rOut));
  const rw = x1 - x0 + 1;
  const rh = y1 - y0 + 1;
  const data = ctx.getImageData(x0, y0, rw, rh).data;
  const keep: number[] = [];
  const fallback: number[] = [];
  for (let py = 0; py < rh; py++) {
    for (let px = 0; px < rw; px++) {
      const dx = x0 + px - cx;
      const dy = y0 + py - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < rIn || d > rOut) continue;
      const i = (py * rw + px) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = (r + g + b) / 3;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (isSkinYCrCb(r, g, b)) continue;
      fallback.push(r, g, b);
      if (lum <= 28 || lum >= 200 || chroma <= 12) continue;
      keep.push(r, g, b);
    }
  }
  const use = keep.length >= 8 ? keep : fallback;
  if (!use.length) return { rgb: { r: 90, g: 90, b: 110 }, count: 0 };
  return { rgb: medianRgb(use), count: use.length / 3 };
}

function sampleEyesAndGlasses(ctx: CanvasRenderingContext2D): EyeSample {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const eyeY = h * 0.38;
  const eyeSpan = w * 0.22;
  const right = { x: w * 0.5 - eyeSpan * 0.5, y: eyeY };
  const left = { x: w * 0.5 + eyeSpan * 0.5, y: eyeY };

  const ir = sampleIrisAt(ctx, right.x, right.y, eyeSpan);
  const il = sampleIrisAt(ctx, left.x, left.y, eyeSpan);
  const iris =
    ir.count + il.count === 0
      ? { r: 90, g: 90, b: 110 }
      : {
          r: (ir.rgb.r * Math.max(1, ir.count) + il.rgb.r * Math.max(1, il.count)) /
            (Math.max(1, ir.count) + Math.max(1, il.count)),
          g: (ir.rgb.g * Math.max(1, ir.count) + il.rgb.g * Math.max(1, il.count)) /
            (Math.max(1, ir.count) + Math.max(1, il.count)),
          b: (ir.rgb.b * Math.max(1, ir.count) + il.rgb.b * Math.max(1, il.count)) /
            (Math.max(1, ir.count) + Math.max(1, il.count)),
        };

  // Contrast-based eye scale (matches server range ~1.12–1.45)
  let eyeScale = 1.22;
  for (const eye of [right, left]) {
    const r = Math.max(6, Math.floor(eyeSpan * 0.12));
    const patch = ctx.getImageData(
      Math.max(0, Math.floor(eye.x - r)),
      Math.max(0, Math.floor(eye.y - r)),
      r * 2,
      r * 2
    ).data;
    let sum = 0;
    let sum2 = 0;
    let n = 0;
    for (let i = 0; i < patch.length; i += 4) {
      const lum = 0.299 * patch[i] + 0.587 * patch[i + 1] + 0.114 * patch[i + 2];
      sum += lum;
      sum2 += lum * lum;
      n++;
    }
    if (n) {
      const mean = sum / n;
      const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
      eyeScale = Math.min(1.45, Math.max(1.12, 1.12 + (std / 64) * 0.18));
    }
  }

  // Glasses: dark non-skin ring on both eyes + bridge
  const framePool: number[] = [];
  const perEye: number[] = [];
  const rIn = Math.max(5, Math.floor(eyeSpan * 0.11));
  const rOut = Math.max(rIn + 3, Math.floor(eyeSpan * 0.22));
  for (const eye of [right, left]) {
    const x0 = Math.max(0, Math.floor(eye.x - rOut));
    const y0 = Math.max(0, Math.floor(eye.y - rOut));
    const x1 = Math.min(w - 1, Math.ceil(eye.x + rOut));
    const y1 = Math.min(h - 1, Math.ceil(eye.y + rOut));
    const rw = x1 - x0 + 1;
    const rh = y1 - y0 + 1;
    const data = ctx.getImageData(x0, y0, rw, rh).data;
    let hits = 0;
    let total = 0;
    for (let py = 0; py < rh; py++) {
      for (let px = 0; px < rw; px++) {
        const dx = x0 + px - eye.x;
        const dy = y0 + py - eye.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < rIn || d > rOut) continue;
        const i = (py * rw + px) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = (r + g + b) / 3;
        if (isSkinYCrCb(r, g, b)) continue;
        total++;
        if (lum < 95) {
          hits++;
          framePool.push(r, g, b);
        }
      }
    }
    perEye.push(hits / Math.max(1, total));
  }

  const mx = (right.x + left.x) / 2;
  const my = (right.y + left.y) / 2;
  const bw = Math.max(4, Math.floor(eyeSpan * 0.18));
  const bh = Math.max(3, Math.floor(eyeSpan * 0.055));
  const bridge = ctx.getImageData(
    Math.max(0, Math.floor(mx - bw)),
    Math.max(0, Math.floor(my - bh)),
    bw * 2,
    bh * 2
  ).data;
  let bridgeHit = 0;
  let bridgeN = 0;
  for (let i = 0; i < bridge.length; i += 4) {
    const r = bridge[i];
    const g = bridge[i + 1];
    const b = bridge[i + 2];
    bridgeN++;
    if (isSkinYCrCb(r, g, b)) continue;
    if ((r + g + b) / 3 < 90) {
      bridgeHit++;
      framePool.push(r, g, b);
    }
  }
  const bridgeRatio = bridgeHit / Math.max(1, bridgeN);
  const bothEyes = perEye.length === 2 && Math.min(...perEye) > 0.1;
  const strongRings = perEye.length === 2 && Math.min(...perEye) > 0.2;
  let hasGlasses = (bothEyes && bridgeRatio > 0.1) || (strongRings && bridgeRatio > 0.04);
  const glasses = framePool.length >= 30 && hasGlasses ? medianRgb(framePool) : { r: 40, g: 40, b: 40 };
  if (framePool.length < 30) hasGlasses = false;

  return {
    iris,
    irisHex: toHex(iris),
    irisCount: ir.count + il.count,
    eyeScale,
    hasGlasses,
    glasses,
    glassesHex: toHex(glasses),
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

function eyeAxes(eyeScale: number) {
  const s = Math.min(1.5, Math.max(1.05, eyeScale));
  return {
    eyeRx: SIZE * 0.072 * s,
    eyeRy: SIZE * 0.05 * s,
    irisR: SIZE * 0.03 * s,
    pupilR: SIZE * 0.012 * s,
  };
}

function paintEyes(
  ctx: CanvasRenderingContext2D,
  re: { x: number; y: number },
  le: { x: number; y: number },
  iris: Rgb,
  eyeScale: number
) {
  const ink = 'rgb(18,12,10)';
  const { eyeRx, eyeRy, irisR, pupilR } = eyeAxes(eyeScale);
  for (const eye of [re, le]) {
    fillEllipse(ctx, eye.x, eye.y, eyeRx, eyeRy, '#fafafa');
    strokeEllipse(ctx, eye.x, eye.y, eyeRx, eyeRy, ink, Math.max(3, 4 * eyeScale));
    fillEllipse(ctx, eye.x, eye.y, irisR, irisR, rgb(iris));
    fillEllipse(ctx, eye.x, eye.y, pupilR, pupilR, 'rgb(25,18,12)');
    fillEllipse(
      ctx,
      eye.x + SIZE * 0.01 * eyeScale,
      eye.y - SIZE * 0.012 * eyeScale,
      SIZE * 0.006 * eyeScale,
      SIZE * 0.006 * eyeScale,
      '#fff'
    );
  }
}

function paintGlasses(
  ctx: CanvasRenderingContext2D,
  re: { x: number; y: number },
  le: { x: number; y: number },
  eyes: EyeSample
) {
  if (!eyes.hasGlasses) return;
  const { eyeRx, eyeRy } = eyeAxes(eyes.eyeScale);
  const gx = eyeRx * 1.28;
  const gy = eyeRy * 1.35;
  const thickness = Math.max(5, SIZE * 0.009);
  const frame = rgb(eyes.glasses);
  for (const eye of [re, le]) {
    strokeEllipse(ctx, eye.x, eye.y, gx, gy, frame, thickness);
  }
  const midY = (re.y + le.y) / 2;
  ctx.strokeStyle = frame;
  ctx.lineWidth = Math.max(4, thickness - 1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(re.x + gx * 0.85, midY);
  ctx.lineTo(le.x - gx * 0.85, midY);
  ctx.stroke();
  for (const [eye, side] of [
    [re, -1],
    [le, 1],
  ] as const) {
    ctx.lineWidth = Math.max(3, thickness - 2);
    ctx.beginPath();
    ctx.moveTo(eye.x + side * gx * 0.95, eye.y);
    ctx.lineTo(eye.x + side * gx * 1.55, eye.y + SIZE * 0.01);
    ctx.stroke();
  }
}

function paintHeadSilhouette(ctx: CanvasRenderingContext2D, skin: Rgb) {
  const ink = 'rgb(18,12,10)';
  const re = { x: LM.rightEye.x * SIZE, y: LM.rightEye.y * SIZE };
  const le = { x: LM.leftEye.x * SIZE, y: LM.leftEye.y * SIZE };
  const chin = { x: LM.chin.x * SIZE, y: LM.chin.y * SIZE };
  const mid = { x: (re.x + le.x) / 2, y: (re.y + le.y) / 2 };
  const headRx = SIZE * 0.3;
  const headRy = SIZE * 0.355;
  const headC = { x: mid.x, y: mid.y + SIZE * 0.04 };

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

  for (const ear of [LM.rightEar, LM.leftEar]) {
    fillEllipse(
      ctx,
      ear.x * SIZE,
      ear.y * SIZE,
      ear.rx * SIZE,
      ear.ry * SIZE,
      rgb(mix(skin, { r: 0, g: 0, b: 0 }, 0.08))
    );
    strokeEllipse(ctx, ear.x * SIZE, ear.y * SIZE, ear.rx * SIZE, ear.ry * SIZE, ink, 3);
  }

  fillEllipse(ctx, headC.x, headC.y, headRx, headRy, rgb(skin));
  strokeEllipse(ctx, headC.x, headC.y, headRx, headRy, ink, 5);

  return { headC, headRx, headRy, chin, mid, re, le };
}

function paintSkinSwatch(ctx: CanvasRenderingContext2D, tone: SkinTone) {
  const sw = SIZE * 0.18;
  const sx0 = SIZE * 0.06;
  const sy0 = SIZE * 0.78;
  ctx.fillStyle = rgb(tone.rgb);
  ctx.fillRect(sx0, sy0, sw, sw);
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx0, sy0, sw, sw);
  ctx.fillStyle = '#f0f0f0';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(tone.hex.toUpperCase(), sx0, sy0 - 12);
  ctx.fillStyle = '#b4b4b4';
  ctx.font = '22px sans-serif';
  ctx.fillText(`n=${tone.sampleCount}`, sx0, sy0 + sw + 28);
}

function paintEyesSwatches(ctx: CanvasRenderingContext2D, eyes: EyeSample) {
  const sw = SIZE * 0.14;
  const sx0 = SIZE * 0.06;
  const sy0 = SIZE * 0.8;
  ctx.fillStyle = rgb(eyes.iris);
  ctx.fillRect(sx0, sy0, sw, sw);
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx0, sy0, sw, sw);
  ctx.fillStyle = '#f0f0f0';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`iris ${eyes.irisHex.toUpperCase()}`, sx0, sy0 - 12);

  const gx0 = sx0 + sw + SIZE * 0.04;
  if (eyes.hasGlasses) {
    ctx.fillStyle = rgb(eyes.glasses);
    ctx.fillRect(gx0, sy0, sw, sw);
    ctx.strokeStyle = '#f0f0f0';
    ctx.strokeRect(gx0, sy0, sw, sw);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillText(`frames ${eyes.glassesHex.toUpperCase()}`, gx0, sy0 - 12);
  } else {
    ctx.fillStyle = '#a0a0a0';
    ctx.font = '22px sans-serif';
    ctx.fillText('no glasses', gx0, sy0 + sw / 2);
  }
  ctx.fillStyle = '#b4b4b4';
  ctx.font = '20px sans-serif';
  ctx.fillText(`scale=${eyes.eyeScale.toFixed(2)}`, sx0, sy0 + sw + 28);
}

/** Convert a face photo to a flat gym caricature (or feature test) in the browser. */
export async function clientFaceEngineCaricature(
  file: File,
  mode: FaceEngineMode = 'full'
): Promise<Blob> {
  const img = await loadImage(file);
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = img.naturalWidth;
  sampleCanvas.height = img.naturalHeight;
  const sctx = sampleCanvas.getContext('2d')!;
  sctx.drawImage(img, 0, 0);

  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const midX = sw * 0.5;
  const midY = sh * 0.42;
  const eyeY = sh * 0.38;
  const eyeSpan = sw * 0.22;

  const skinTone = sampleSkinTone(sctx);
  const skin = skinTone.rgb;
  const eyes = sampleEyesAndGlasses(sctx);
  const hair = sample(sctx, midX, Math.max(8, eyeY - eyeSpan * 1.2), 16);
  const lip = sample(sctx, midX, midY + eyeSpan * 0.95, 5);
  const brow = mix(hair, skin, 0.25);
  const ink = 'rgb(18,12,10)';

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SIZE, SIZE);

  if (mode === 'skin') {
    paintHeadSilhouette(ctx, skin);
    paintSkinSwatch(ctx, skinTone);
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encode failed'))), 'image/png');
    });
  }

  if (mode === 'eyes') {
    const { headC, headRx, headRy, re, le } = paintHeadSilhouette(ctx, skin);
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
    paintEyes(ctx, re, le, eyes.iris, eyes.eyeScale);
    paintGlasses(ctx, re, le, eyes);
    strokeEllipse(ctx, headC.x, headC.y, headRx, headRy, ink, 5);
    paintEyesSwatches(ctx, eyes);
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encode failed'))), 'image/png');
    });
  }

  const { headC, headRx, headRy, chin, mid, re, le } = paintHeadSilhouette(ctx, skin);
  const nose = { x: LM.nose.x * SIZE, y: LM.nose.y * SIZE };
  const mouth = { x: LM.mouth.x * SIZE, y: LM.mouth.y * SIZE };
  const forehead = { x: LM.forehead.x * SIZE, y: LM.forehead.y * SIZE };

  fillEllipse(ctx, forehead.x, forehead.y - SIZE * 0.04, headRx * 1.08, SIZE * 0.16, rgb(hair));
  fillEllipse(ctx, LM.rightEar.x * SIZE - SIZE * 0.01, mid.y - SIZE * 0.04, SIZE * 0.06, SIZE * 0.18, rgb(hair));
  fillEllipse(ctx, LM.leftEar.x * SIZE + SIZE * 0.01, mid.y - SIZE * 0.04, SIZE * 0.06, SIZE * 0.18, rgb(hair));
  fillEllipse(ctx, headC.x, headC.y, headRx, headRy, rgb(skin));

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(headC.x, headC.y, headRx, headRy, 0, (200 * Math.PI) / 180, (340 * Math.PI) / 180);
  ctx.clip();
  fillEllipse(ctx, forehead.x, forehead.y - SIZE * 0.06, headRx * 0.98, SIZE * 0.14, rgb(hair));
  ctx.restore();

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

  paintEyes(ctx, re, le, eyes.iris, eyes.eyeScale);
  paintGlasses(ctx, re, le, eyes);

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

  fillEllipse(ctx, mouth.x, mouth.y, SIZE * 0.07, SIZE * 0.028, rgb(mix(lip, { r: 0, g: 0, b: 0 }, 0.12)));
  strokeEllipse(ctx, mouth.x, mouth.y, SIZE * 0.07, SIZE * 0.028, ink, 3);

  strokeEllipse(ctx, headC.x, headC.y, headRx, headRy, ink, 5);
  void chin;

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encode failed'))), 'image/png');
  });
}
