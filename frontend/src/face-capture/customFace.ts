/** Persist the user-fitted face photo (PNG data URL) for gym playback. */

export const CUSTOM_FACE_STORAGE_KEY = 'mickeys-gym-custom-face';

export function readCustomFaceDataUrl(): string | null {
  try {
    const raw = localStorage.getItem(CUSTOM_FACE_STORAGE_KEY);
    if (raw && raw.startsWith('data:image/')) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeCustomFaceDataUrl(dataUrl: string) {
  try {
    localStorage.setItem(CUSTOM_FACE_STORAGE_KEY, dataUrl);
  } catch {
    /* ignore quota */
  }
}

export function clearCustomFaceDataUrl() {
  try {
    localStorage.removeItem(CUSTOM_FACE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
