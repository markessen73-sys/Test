/** Persist user-fitted face photos + feature marks for damage placement. */

export const CUSTOM_FACE_STORAGE_KEY = 'mickeys-gym-custom-face';

/** Normalized ellipse on the 1024 face image (0–1, top-left origin). */
export type FaceFeatureMark = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

export type FaceFeatureId =
  | 'leftEye'
  | 'rightEye'
  | 'nose'
  | 'mouth'
  | 'leftEar'
  | 'rightEar'
  | 'forehead'
  | 'chin';

export type CustomFaceFeatures = Partial<Record<FaceFeatureId, FaceFeatureMark>>;

export type CustomFaceSet = {
  /** Smiling / normal */
  clean: string;
  /** “Ooh!” / punched */
  ooh: string;
  /** Sad / knockout */
  knockout: string;
  /** User-highlighted feature anchors (from marker pass). */
  features?: CustomFaceFeatures;
  /** Baked cumulative injury faces for the damage HUD (8 PNGs). */
  damageStages?: string[];
  /** KO face for the damage HUD (usually same as knockout expression). */
  damageKnockout?: string;
};

function isDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function isMark(value: unknown): value is FaceFeatureMark {
  if (!value || typeof value !== 'object') return false;
  const m = value as FaceFeatureMark;
  return (
    typeof m.cx === 'number' &&
    typeof m.cy === 'number' &&
    typeof m.rx === 'number' &&
    typeof m.ry === 'number'
  );
}

function readFeatures(raw: unknown): CustomFaceFeatures | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: CustomFaceFeatures = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isMark(v)) out[k as FaceFeatureId] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function readCustomFaceSet(): CustomFaceSet | null {
  try {
    const raw = localStorage.getItem(CUSTOM_FACE_STORAGE_KEY);
    if (!raw) return null;
    if (raw.startsWith('data:image/')) {
      return { clean: raw, ooh: raw, knockout: raw };
    }
    const parsed = JSON.parse(raw) as Partial<CustomFaceSet>;
    if (!isDataUrl(parsed.clean)) return null;
    const set: CustomFaceSet = {
      clean: parsed.clean,
      ooh: isDataUrl(parsed.ooh) ? parsed.ooh : parsed.clean,
      knockout: isDataUrl(parsed.knockout) ? parsed.knockout : parsed.clean,
    };
    const features = readFeatures(parsed.features);
    if (features) set.features = features;
    if (Array.isArray(parsed.damageStages) && parsed.damageStages.every(isDataUrl)) {
      set.damageStages = parsed.damageStages;
    }
    if (isDataUrl(parsed.damageKnockout)) set.damageKnockout = parsed.damageKnockout;
    return set;
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
    /* ignore quota — damage stages can be large; try without stages */
    try {
      const slim: CustomFaceSet = {
        clean: faces.clean,
        ooh: faces.ooh,
        knockout: faces.knockout,
        features: faces.features,
      };
      localStorage.setItem(CUSTOM_FACE_STORAGE_KEY, JSON.stringify(slim));
    } catch {
      /* ignore */
    }
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
