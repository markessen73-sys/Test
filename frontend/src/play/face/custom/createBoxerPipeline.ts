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
import { stylizeFaceToCaricature } from './faceStylize';
import {
  newCustomBoxerId,
  saveCustomBoxerPack,
  type CustomBoxerPackRecord,
} from './customBoxerStorage';

export type CreateBoxerProgress = (message: string, ratio: number) => void;

/**
 * Turn a photo face into a gym caricature.
 * Prefer the studio API when configured; otherwise MediaPipe Face Stylizer
 * (real cartoon stylization — not a photo filter).
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
    /* fall through to on-device stylizer */
  }

  onProgress?.('Drawing caricature (on-device)…', 0.18);
  return stylizeFaceToCaricature(faceCanvas);
}

/**
 * Turn a confirmed face crop into a full playable pack and persist it.
 */
export async function createBoxerFromFaceSource(opts: {
  /** Image element that was used for detection (full photo). */
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
