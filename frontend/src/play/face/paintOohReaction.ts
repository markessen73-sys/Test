/**
 * Shared ooh hit-reaction painter: base face + optional zooming pop eyes.
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

/** Map normalized marks from the source image into contain-fitted canvas space. */
function remapMarkToContainCanvas(
  m: FaceFeatureMark,
  canvasW: number,
  canvasH: number,
  imgW: number,
  imgH: number,
): FaceFeatureMark {
  const contain = Math.min(canvasW / imgW, canvasH / imgH) * FACE_CONTAIN_PAD;
  const drawW = imgW * contain;
  const drawH = imgH * contain;
  const ox = (canvasW - drawW) / 2;
  const oy = (canvasH - drawH) / 2;
  return {
    cx: (ox + m.cx * drawW) / canvasW,
    cy: (oy + m.cy * drawH) / canvasH,
    rx: m.rx * (drawW / canvasW),
    ry: m.ry * (drawH / canvasH),
  };
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
  const left = remapMarkToContainCanvas(marks.left, canvasSize, canvasSize, iw, ih);
  const right = remapMarkToContainCanvas(marks.right, canvasSize, canvasSize, iw, ih);
  drawPopEyesZoom(ctx, left, right, canvasSize, canvasSize, scale, skin);
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
