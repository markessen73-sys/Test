/** Persist user-fitted face photos (PNG data URLs) for gym playback. */

export const CUSTOM_FACE_STORAGE_KEY = 'mickeys-gym-custom-face';

export type CustomFaceSet = {
  /** Smiling / normal */
  clean: string;
  /** “Ooh!” / punched */
  ooh: string;
  /** Sad / knockout */
  knockout: string;
};

function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/');
}

export function readCustomFaceSet(): CustomFaceSet | null {
  try {
    const raw = localStorage.getItem(CUSTOM_FACE_STORAGE_KEY);
    if (!raw) return null;
    // Legacy: single data URL used for every expression
    if (raw.startsWith('data:image/')) {
      return { clean: raw, ooh: raw, knockout: raw };
    }
    const parsed = JSON.parse(raw) as Partial<CustomFaceSet>;
    if (isDataUrl(parsed.clean) && isDataUrl(parsed.ooh) && isDataUrl(parsed.knockout)) {
      return { clean: parsed.clean, ooh: parsed.ooh, knockout: parsed.knockout };
    }
    if (isDataUrl(parsed.clean)) {
      return {
        clean: parsed.clean,
        ooh: isDataUrl(parsed.ooh) ? parsed.ooh : parsed.clean,
        knockout: isDataUrl(parsed.knockout) ? parsed.knockout : parsed.clean,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** @deprecated Prefer readCustomFaceSet — returns the clean/normal face only. */
export function readCustomFaceDataUrl(): string | null {
  return readCustomFaceSet()?.clean ?? null;
}

export function writeCustomFaceSet(faces: CustomFaceSet) {
  try {
    localStorage.setItem(CUSTOM_FACE_STORAGE_KEY, JSON.stringify(faces));
  } catch {
    /* ignore quota */
  }
}

/** Upload / single-shot: use one cutout for every expression. */
export function writeCustomFaceDataUrl(dataUrl: string) {
  writeCustomFaceSet({ clean: dataUrl, ooh: dataUrl, knockout: dataUrl });
}

export function clearCustomFaceDataUrl() {
  try {
    localStorage.removeItem(CUSTOM_FACE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
