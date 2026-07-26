import { transformPhoto, fetchHealth, bakeCharacterPack } from '../../../api';
import { bakeCustomBoxerPack } from '../bake/bakeCustomPack';
import {
  alignCharacterPack,
  alignFaceToLandmarks,
  canvasToJpegFile,
  cropFaceToSquare,
  imageDataToPngBlob,
  loadImageFromBlob,
  synthesizeKnockout,
  synthesizeOoh,
} from './faceImage';
import { detectFaceLandmarks } from './faceDetect';
import { paintFlatCaricature } from './paintFlatCaricature';
import { stylizeFaceToCaricature } from './faceStylize';
import {
  newCustomBoxerId,
  saveCustomBoxerPack,
  type CustomBoxerPackRecord,
} from './customBoxerStorage';

export type CreateBoxerProgress = (message: string, ratio: number) => void;

type ExpressionId = 'clean' | 'ooh' | 'knockout';

/**
 * Generate clean / ooh / knockout caricatures via studio AI (same methodology as built-in boxers).
 */
async function generateExpressionPack(
  faceFile: File,
  onProgress?: CreateBoxerProgress
): Promise<{ clean: Blob; ooh: Blob; knockout: Blob }> {
  const steps: { id: ExpressionId; ratio: number; label: string }[] = [
    { id: 'clean', ratio: 0.12, label: 'Creating clean expression…' },
    { id: 'ooh', ratio: 0.22, label: 'Creating ooh expression…' },
    { id: 'knockout', ratio: 0.32, label: 'Creating knockout expression…' },
  ];

  const out: Partial<Record<ExpressionId, Blob>> = {};
  for (const step of steps) {
    onProgress?.(step.label, step.ratio);
    const result = await transformPhoto(
      faceFile,
      'mickeys_gym',
      (msg) => onProgress?.(msg, step.ratio + 0.04),
      step.id
    );
    out[step.id] = result.blob;
  }

  return {
    clean: out.clean!,
    ooh: out.ooh!,
    knockout: out.knockout!,
  };
}

/** On-device fallback when studio AI is unavailable. */
async function generateOnDevicePack(
  faceCanvas: HTMLCanvasElement,
  onProgress?: CreateBoxerProgress
): Promise<{ clean: ImageData; ooh: ImageData; knockout: ImageData }> {
  onProgress?.('Stylizing face into a caricature…', 0.16);
  let caricatureBlob: Blob;
  try {
    caricatureBlob = await stylizeFaceToCaricature(faceCanvas);
  } catch {
    onProgress?.('Drawing boxing caricature…', 0.2);
    caricatureBlob = await paintFlatCaricature(faceCanvas);
  }

  const caricatureImg = await loadImageFromBlob(caricatureBlob);
  const landmarks = await detectFaceLandmarks(caricatureImg).catch(() => null);
  const clean = await alignFaceToLandmarks(caricatureImg, landmarks);
  onProgress?.('Building expressions…', 0.45);
  return {
    clean,
    ooh: synthesizeOoh(clean),
    knockout: synthesizeKnockout(clean),
  };
}

async function bakePack(
  clean: ImageData,
  ooh: ImageData,
  knockout: ImageData,
  onProgress?: CreateBoxerProgress
) {
  onProgress?.('Baking damage & clown packs…', 0.55);
  try {
    const cleanBlob = await imageDataToPngBlob(clean);
    const oohBlob = await imageDataToPngBlob(ooh);
    const koBlob = await imageDataToPngBlob(knockout);
    return await bakeCharacterPack(cleanBlob, oohBlob, koBlob, (msg) =>
      onProgress?.(msg, 0.7)
    );
  } catch (err) {
    console.warn('Server bake unavailable, using browser bake', err);
    return bakeCustomBoxerPack(clean, ooh, knockout, onProgress);
  }
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

  onProgress?.('Checking caricature service…', 0.08);
  let studioAi = false;
  try {
    const health = await fetchHealth();
    studioAi = !!health.ai_available || health.monetization_mode === false;
  } catch {
    /* on-device fallback */
  }

  let clean: ImageData;
  let ooh: ImageData;
  let knockout: ImageData;

  if (studioAi) {
    const expressions = await generateExpressionPack(faceFile, onProgress);
    onProgress?.('Aligning face pack to gym layout…', 0.42);
    const cleanImg = await loadImageFromBlob(expressions.clean);
    const oohImg = await loadImageFromBlob(expressions.ooh);
    const koImg = await loadImageFromBlob(expressions.knockout);
    ({ clean, ooh, knockout } = await alignCharacterPack(cleanImg, oohImg, koImg));
  } else {
    ({ clean, ooh, knockout } = await generateOnDevicePack(crop, onProgress));
  }

  const blobs = await bakePack(clean, ooh, knockout, onProgress);

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
