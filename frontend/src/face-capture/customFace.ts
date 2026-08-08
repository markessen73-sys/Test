/** Persist user-fitted photo faces (library) + feature marks. */

export const CUSTOM_FACE_STORAGE_KEY = 'mickeys-gym-custom-face';
export const CUSTOM_FACE_LIBRARY_KEY = 'mickeys-gym-custom-faces';

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

/** One saved photo face in the library. */
export type CustomFaceEntry = CustomFaceSet & {
  id: string;
  name: string;
  createdAt: number;
};

export type CustomFaceLibrary = {
  faces: CustomFaceEntry[];
};

const MAX_PHOTO_FACES = 8;

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

function parseFaceSet(parsed: Partial<CustomFaceSet>): CustomFaceSet | null {
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
}

function slimSet(faces: CustomFaceSet): CustomFaceSet {
  return {
    clean: faces.clean,
    ooh: faces.ooh,
    knockout: faces.knockout,
    features: faces.features,
  };
}

function newPhotoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `photo-${crypto.randomUUID()}`;
  }
  return `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nextFaceName(existing: CustomFaceEntry[]): string {
  const n = existing.length + 1;
  return n === 1 ? 'My face' : `My face ${n}`;
}

/** Migrate legacy single-face key into the library (once). */
function migrateLegacySingleFace(): CustomFaceLibrary {
  try {
    const raw = localStorage.getItem(CUSTOM_FACE_STORAGE_KEY);
    if (!raw) return { faces: [] };
    let set: CustomFaceSet | null = null;
    if (raw.startsWith('data:image/')) {
      set = { clean: raw, ooh: raw, knockout: raw };
    } else {
      set = parseFaceSet(JSON.parse(raw) as Partial<CustomFaceSet>);
    }
    if (!set) return { faces: [] };
    const entry: CustomFaceEntry = {
      ...slimSet(set),
      id: newPhotoId(),
      name: 'My face',
      createdAt: Date.now(),
    };
    const lib: CustomFaceLibrary = { faces: [entry] };
    writeCustomFaceLibrary(lib);
    try {
      localStorage.removeItem(CUSTOM_FACE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return lib;
  } catch {
    return { faces: [] };
  }
}

export function readCustomFaceLibrary(): CustomFaceLibrary {
  try {
    const raw = localStorage.getItem(CUSTOM_FACE_LIBRARY_KEY);
    if (!raw) return migrateLegacySingleFace();
    const parsed = JSON.parse(raw) as Partial<CustomFaceLibrary>;
    if (!Array.isArray(parsed.faces)) return migrateLegacySingleFace();
    const faces: CustomFaceEntry[] = [];
    for (const item of parsed.faces) {
      if (!item || typeof item !== 'object') continue;
      const set = parseFaceSet(item);
      if (!set) continue;
      const id = typeof item.id === 'string' && item.id.startsWith('photo-') ? item.id : newPhotoId();
      const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'My face';
      const createdAt = typeof item.createdAt === 'number' ? item.createdAt : Date.now();
      faces.push({ ...slimSet(set), id, name, createdAt });
    }
    return { faces };
  } catch {
    return { faces: [] };
  }
}

export function writeCustomFaceLibrary(lib: CustomFaceLibrary) {
  const payload: CustomFaceLibrary = {
    faces: lib.faces.map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: f.createdAt,
      ...slimSet(f),
    })),
  };
  try {
    localStorage.setItem(CUSTOM_FACE_LIBRARY_KEY, JSON.stringify(payload));
  } catch {
    /* quota — drop oldest until it fits */
    const faces = [...payload.faces];
    while (faces.length > 0) {
      faces.shift();
      try {
        localStorage.setItem(CUSTOM_FACE_LIBRARY_KEY, JSON.stringify({ faces }));
        return;
      } catch {
        /* keep trimming */
      }
    }
  }
}

/** Add a new photo face; returns the created entry (selected afterwards by caller). */
export function addCustomFace(faces: CustomFaceSet, name?: string): CustomFaceEntry {
  const lib = readCustomFaceLibrary();
  const entry: CustomFaceEntry = {
    ...slimSet(faces),
    id: newPhotoId(),
    name: name?.trim() || nextFaceName(lib.faces),
    createdAt: Date.now(),
  };
  const next = [...lib.faces, entry].slice(-MAX_PHOTO_FACES);
  writeCustomFaceLibrary({ faces: next });
  return entry;
}

export function deleteCustomFace(id: string): CustomFaceLibrary {
  const lib = readCustomFaceLibrary();
  const faces = lib.faces.filter((f) => f.id !== id);
  writeCustomFaceLibrary({ faces });
  return { faces };
}

export function getCustomFace(id: string): CustomFaceEntry | null {
  return readCustomFaceLibrary().faces.find((f) => f.id === id) ?? null;
}

/** @deprecated Prefer readCustomFaceLibrary — returns the newest face only. */
export function readCustomFaceSet(): CustomFaceSet | null {
  const faces = readCustomFaceLibrary().faces;
  return faces.length ? faces[faces.length - 1]! : null;
}

/** @deprecated Prefer readCustomFaceLibrary. */
export function readCustomFaceDataUrl(): string | null {
  return readCustomFaceSet()?.clean ?? null;
}

/** @deprecated Prefer addCustomFace — overwrites library with a single face. */
export function writeCustomFaceSet(faces: CustomFaceSet) {
  addCustomFace(faces);
}

/** Upload / single-shot: use one cutout for every expression. */
export function writeCustomFaceDataUrl(dataUrl: string) {
  addCustomFace({ clean: dataUrl, ooh: dataUrl, knockout: dataUrl });
}

export function clearCustomFaceDataUrl() {
  try {
    localStorage.removeItem(CUSTOM_FACE_STORAGE_KEY);
    localStorage.removeItem(CUSTOM_FACE_LIBRARY_KEY);
  } catch {
    /* ignore */
  }
}

export function isPhotoCharacterId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('photo-');
}
