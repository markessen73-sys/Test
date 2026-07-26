import { transformPhoto, fetchHealth } from '../../../api';
import { bakeCustomBoxerPack } from '../bake/bakeCustomPack';
import {
  alignFaceToLandmarks,
  canvasToJpegFile,
  cropFaceToSquare,
  loadImageFromBlob,
  synthesizeKnockout,
  synthesizeOoh,
} from './faceImage';
import { detectFaceLandmarks } from './faceDetect';
import { paintFlatCaricature } from './paintFlatCaricature';
import {
  newCustomBoxerId,
  saveCustomBoxerPack,
  type CustomBoxerPackRecord,
} from './customBoxerStorage';

export type CreateBoxerProgress = (message: string, ratio: number) => void;

/**
 * Turn a photo face into a gym caricature (never leave it as a raw photo).
 * Prefer the studio AI API when configured; otherwise paint a flat boxing
 * caricature from face landmarks + sampled colours (Default-style).
 */
async function caricatureFace(
  faceFile: File,
  faceCanvas: HTMLCanvasElement,
  onProgress?: CreateBoxerProgress
): Promise<Blob> {
  onProgress?.('Checking caricature service…', 0.1);
  try {
    const health = await fetchHealth();
    if (health.ai_available || health.monetization_mode === false) {
      onProgress?.('Creating AI caricature…', 0.15);
      const result = await transformPhoto(faceFile, 'mickeys_gym', (msg) => onProgress?.(msg, 0.22));
      return result.blob;
    }
  } catch {
    /* fall through to on-device painter */
  }

  onProgress?.('Drawing boxing caricature…', 0.2);
  return paintFlatCaricature(faceCanvas);
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

  const caricatureBlob = await caricatureFace(faceFile, crop, onProgress);
  onProgress?.('Aligning to gym face layout…', 0.4);
  const caricatureImg = await loadImageFromBlob(caricatureBlob);
  // Flat painter already places features on LM; still run align for AI outputs / size match.
  const landmarks = await detectFaceLandmarks(caricatureImg).catch(() => null);
  const clean = await alignFaceToLandmarks(caricatureImg, landmarks);

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
