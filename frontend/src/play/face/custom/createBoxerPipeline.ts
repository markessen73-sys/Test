import { transformPhoto, fetchHealth } from '../../../api';
import { bakeCustomBoxerPack } from '../bake/bakeCustomPack';
import {
  alignFaceToLandmarks,
  canvasToJpegFile,
  cropFaceToSquare,
  loadImageFromBlob,
  measureMidFaceWidth,
  synthesizeKnockout,
  synthesizeOoh,
} from './faceImage';
import { detectFaceLandmarks } from './faceDetect';
import { paintFlatCaricature } from './paintFlatCaricature';
import { LM, W, H } from '../bake/faceDamageBake';
import { assetUrl } from '../../../assetUrl';
import {
  newCustomBoxerId,
  saveCustomBoxerPack,
  type CustomBoxerPackRecord,
} from './customBoxerStorage';

export type CreateBoxerProgress = (message: string, ratio: number) => void;

type CaricatureResult = { blob: Blob; alreadyOnLayout: boolean };

/**
 * Turn a photo face into a gym caricature (never leave it as a raw photo).
 * Prefer the studio AI API when configured; otherwise paint a flat boxing
 * caricature from face landmarks + sampled colours (Default-style).
 */
async function caricatureFace(
  faceFile: File,
  faceCanvas: HTMLCanvasElement,
  onProgress?: CreateBoxerProgress
): Promise<CaricatureResult> {
  onProgress?.('Checking caricature service…', 0.1);
  try {
    const health = await fetchHealth();
    if (health.ai_available || health.monetization_mode === false) {
      onProgress?.('Creating AI caricature…', 0.15);
      const result = await transformPhoto(faceFile, 'mickeys_gym', (msg) => onProgress?.(msg, 0.22));
      return { blob: result.blob, alreadyOnLayout: false };
    }
  } catch {
    /* fall through to on-device painter */
  }

  onProgress?.('Drawing boxing caricature…', 0.2);
  const blob = await paintFlatCaricature(faceCanvas);
  return { blob, alreadyOnLayout: true };
}

async function imageDataFromImage(img: HTMLImageElement): Promise<ImageData> {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0, W, H);
  return ctx.getImageData(0, 0, W, H);
}

async function matchDefaultWidth(face: ImageData): Promise<ImageData> {
  const refImg = await loadImageFromBlob(
    await fetch(assetUrl('/faces/characters/default/clean.png')).then((r) => r.blob())
  );
  const ref = await imageDataFromImage(refImg);
  const target = measureMidFaceWidth(ref);
  const current = measureMidFaceWidth(face);
  if (current < 8 || Math.abs(target / current - 1) < 0.03) return face;
  const scale = target / current;
  const pivotX = ((LM.rightEye.x + LM.leftEye.x) / 2) * W;
  const pivotY = ((LM.rightEye.y + LM.leftEye.y) / 2) * H;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const tmp = document.createElement('canvas');
  tmp.width = W;
  tmp.height = H;
  tmp.getContext('2d')!.putImageData(face, 0, 0);
  ctx.translate(pivotX, pivotY);
  ctx.scale(scale, scale);
  ctx.translate(-pivotX, -pivotY);
  ctx.drawImage(tmp, 0, 0);
  return ctx.getImageData(0, 0, W, H);
}

/**
 * Turn a confirmed face crop into a full playable pack and persist it.
 */
export async function createBoxerFromFaceSource(opts: {
  sourceImage: HTMLImageElement | HTMLCanvasElement;
  faceBox: { x: number; y: number; width: number; height: number };
  name: string;
  onProgress?: CreateBoxerProgress;
}): Promise<CustomBoxerPackRecord> {
  const { sourceImage, faceBox, name, onProgress } = opts;

  onProgress?.('Cropping face…', 0.05);
  const crop = cropFaceToSquare(sourceImage, faceBox, 0.55);
  const faceFile = await canvasToJpegFile(crop, 'boxer-face.jpg');

  const { blob: caricatureBlob, alreadyOnLayout } = await caricatureFace(faceFile, crop, onProgress);
  onProgress?.('Aligning to gym face layout…', 0.4);
  const caricatureImg = await loadImageFromBlob(caricatureBlob);

  let clean: ImageData;
  if (alreadyOnLayout) {
    // Painter already put eyes/mouth on bake LM — only size-match to Default.
    clean = await matchDefaultWidth(await imageDataFromImage(caricatureImg));
  } else {
    const landmarks = await detectFaceLandmarks(caricatureImg).catch(() => null);
    clean = await alignFaceToLandmarks(caricatureImg, landmarks);
  }

  onProgress?.('Building expressions…', 0.5);
  const ooh = synthesizeOoh(clean);
  const knockout = synthesizeKnockout(clean);

  const blobs = await bakeCustomBoxerPack(clean, ooh, knockout, onProgress);

  const id = newCustomBoxerId();
  const record: CustomBoxerPackRecord = {
    id,
    name: name.trim() || 'Created Boxer',
    createdAt: Date.now(),
    clean: blobs.clean,
    ooh: blobs.ooh,
    knockout: blobs.knockout,
    damage: blobs.damage,
    clown: blobs.clown,
  };

  onProgress?.('Saving…', 0.98);
  await saveCustomBoxerPack(record);
  onProgress?.('Done!', 1);
  return record;
}
