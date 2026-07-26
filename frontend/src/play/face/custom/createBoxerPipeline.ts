import { transformPhoto, fetchHealth } from '../../../api';
import { bakeCustomBoxerPack } from '../bake/bakeCustomPack';
import {
  alignFaceToLandmarks,
  canvasToJpegFile,
  cropFaceToSquare,
  loadImageFromBlob,
  localCartoonize,
  synthesizeKnockout,
  synthesizeOoh,
} from './faceImage';
import { detectFaceLandmarks } from './faceDetect';
import {
  newCustomBoxerId,
  saveCustomBoxerPack,
  type CustomBoxerPackRecord,
} from './customBoxerStorage';

export type CreateBoxerProgress = (message: string, ratio: number) => void;

const GYM_STYLE_CANDIDATES = ['mickeys_gym', 'exaggerated', 'family_guy', 'comic', 'disney'];

async function caricatureFace(file: File, onProgress?: CreateBoxerProgress): Promise<Blob> {
  onProgress?.('Checking caricature service…', 0.12);
  try {
    const health = await fetchHealth();
    if (health.ai_available || !health.monetization_mode) {
      onProgress?.('Creating your caricature…', 0.18);
      let lastErr: Error | null = null;
      for (const styleId of GYM_STYLE_CANDIDATES) {
        try {
          const result = await transformPhoto(file, styleId, (msg) => onProgress?.(msg, 0.25));
          return result.blob;
        } catch (e) {
          lastErr = e instanceof Error ? e : new Error(String(e));
        }
      }
      if (lastErr) throw lastErr;
    }
  } catch {
    /* fall through to local */
  }
  onProgress?.('Caricature service offline — using local cartoon…', 0.22);
  return localCartoonize(file);
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
  const crop = cropFaceToSquare(sourceImage, faceBox, 0.6);
  const faceFile = await canvasToJpegFile(crop, 'boxer-face.jpg');

  const caricatureBlob = await caricatureFace(faceFile, onProgress);
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
