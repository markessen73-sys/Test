/**
 * Shared ooh hit-reaction painter: base face + optional zooming pop eyes.
 * Eye marks stay in source-image space (same as capture preview), then the
 * eye layer is contain-fitted with the face so game + preview align.
 */
import { FACE_CONTAIN_PAD, drawFullFaceOnCanvas } from './composeFaceTexture';
import type { FaceFeatureMark } from '../../face-capture/customFace';
import {
  drawPopEyesZoom,
  popEyeScaleForHit,
  sampleSkinNearEyes,
  type Rgb,
} from '../../face-capture/popEyes';

export type PopEyePair = { left: FaceFeatureMark; right: FaceFeatureMark };

/** Scratch canvas so we can draw eyes in image pixels, then contain-blit. */
let eyeLayer: HTMLCanvasElement | null = null;

function getEyeLayer(w: number, h: number): CanvasRenderingContext2D | null {
  if (!eyeLayer) eyeLayer = document.createElement('canvas');
  if (eyeLayer.width !== w || eyeLayer.height !== h) {
    eyeLayer.width = w;
    eyeLayer.height = h;
  }
  return eyeLayer.getContext('2d');
}

export function paintOohReaction(
  ctx: CanvasRenderingContext2D,
  canvasSize: number,
  baseImg: HTMLImageElement,
  opts: {
    popEyes?: PopEyePair | null;
    skin?: Rgb | null;
    /** ms since hit; when set with popEyes, eyes zoom 0.5→1 */
    hitAgeMs?: number;
    oohMs: number;
  },
) {
  drawFullFaceOnCanvas(ctx, baseImg, canvasSize, canvasSize);
  const marks = opts.popEyes;
  if (!marks || opts.hitAgeMs == null) return;
  const scale = popEyeScaleForHit(opts.hitAgeMs, opts.oohMs);
  if (scale == null) return;
  const skin = opts.skin ?? { r: 180, g: 140, b: 120 };
  const iw = baseImg.naturalWidth || baseImg.width || canvasSize;
  const ih = baseImg.naturalHeight || baseImg.height || canvasSize;

  // Draw in source-image space (identical to OohPopPreview), then contain-fit.
  const ect = getEyeLayer(iw, ih);
  if (!ect || !eyeLayer) {
    // Fallback: remap into canvas space if scratch canvas unavailable
    const contain = Math.min(canvasSize / iw, canvasSize / ih) * FACE_CONTAIN_PAD;
    const drawW = iw * contain;
    const drawH = ih * contain;
    const ox = (canvasSize - drawW) / 2;
    const oy = (canvasSize - drawH) / 2;
    const remap = (m: FaceFeatureMark): FaceFeatureMark => ({
      cx: (ox + m.cx * drawW) / canvasSize,
      cy: (oy + m.cy * drawH) / canvasSize,
      rx: m.rx * (drawW / canvasSize),
      ry: m.ry * (drawH / canvasSize),
    });
    drawPopEyesZoom(ctx, remap(marks.left), remap(marks.right), canvasSize, canvasSize, scale, skin);
    return;
  }

  ect.clearRect(0, 0, iw, ih);
  drawPopEyesZoom(ect, marks.left, marks.right, iw, ih, scale, skin);

  const contain = Math.min(canvasSize / iw, canvasSize / ih) * FACE_CONTAIN_PAD;
  const drawW = iw * contain;
  const drawH = ih * contain;
  const ox = (canvasSize - drawW) / 2;
  const oy = (canvasSize - drawH) / 2;
  ctx.drawImage(eyeLayer, 0, 0, iw, ih, ox, oy, drawW, drawH);
}

/** Sample skin once from a loaded face image for pop-eye shading. */
export function skinFromFaceImage(
  img: HTMLImageElement,
  popEyes: PopEyePair,
): Rgb {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { r: 180, g: 140, b: 120 };
  ctx.drawImage(img, 0, 0);
  return sampleSkinNearEyes(ctx.getImageData(0, 0, c.width, c.height), popEyes.left, popEyes.right);
}
