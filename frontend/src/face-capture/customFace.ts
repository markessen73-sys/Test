/** Persist user-fitted photo faces (library) + feature marks. */

export const CUSTOM_FACE_STORAGE_KEY = 'mickeys-gym-custom-face';
export const CUSTOM_FACE_LIBRARY_KEY = 'mickeys-gym-custom-faces';
/** Lightweight eye/feature marks keyed by photo id — survives image quota pressure. */
export const CUSTOM_FACE_META_KEY = 'mickeys-gym-custom-face-meta';

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
  /** How the face was captured — selfie has no pop eyes. */
  captureSource?: 'selfie' | 'upload';
  /** Bottom neck alpha fade applied so the cutout blends into the body. */
  neckFaded?: boolean;
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
  if (parsed.captureSource === 'selfie' || parsed.captureSource === 'upload') {
    set.captureSource = parsed.captureSource;
  }
  if (parsed.neckFaded === true) set.neckFaded = true;
  if (Array.isArray(parsed.damageStages) && parsed.damageStages.every(isDataUrl)) {
    set.damageStages = parsed.damageStages;
  }
  if (isDataUrl(parsed.damageKnockout)) set.damageKnockout = parsed.damageKnockout;
  return set;
}

function slimSet(faces: CustomFaceSet): CustomFaceSet {
  const set: CustomFaceSet = {
    clean: faces.clean,
    ooh: faces.ooh,
    knockout: faces.knockout,
  };
  if (faces.features && Object.keys(faces.features).length) {
    set.features = faces.features;
  }
  if (faces.captureSource) set.captureSource = faces.captureSource;
  if (faces.neckFaded) set.neckFaded = true;
  return set;
}

type FaceMetaMap = Record<string, CustomFaceFeatures>;

function readFaceMetaMap(): FaceMetaMap {
  try {
    const raw = localStorage.getItem(CUSTOM_FACE_META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: FaceMetaMap = {};
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      const features = readFeatures(value);
      if (features) out[id] = features;
    }
    return out;
  } catch {
    return {};
  }
}

function writeFaceMetaMap(map: FaceMetaMap) {
  try {
    localStorage.setItem(CUSTOM_FACE_META_KEY, JSON.stringify(map));
  } catch {
    /* ignore — marks are tiny; failure is rare */
  }
}

/** Persist / merge highlighter marks for a photo face (separate from image blobs). */
export function writeFaceFeatures(id: string, features: CustomFaceFeatures | undefined) {
  if (!features || !Object.keys(features).length) return;
  const map = readFaceMetaMap();
  map[id] = features;
  writeFaceMetaMap(map);
}

export function readFaceFeatures(id: string): CustomFaceFeatures | undefined {
  return readFaceMetaMap()[id];
}

function deleteFaceFeatures(id: string) {
  const map = readFaceMetaMap();
  if (!(id in map)) return;
  delete map[id];
  writeFaceMetaMap(map);
}

/** Merge library features with the lightweight meta store (meta wins on conflict). */
export function resolveFaceFeatures(entry: {
  id: string;
  features?: CustomFaceFeatures;
}): CustomFaceFeatures | undefined {
  const meta = readFaceFeatures(entry.id);
  if (!meta && !entry.features) return undefined;
  return { ...entry.features, ...meta };
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
      const entry: CustomFaceEntry = { ...slimSet(set), id, name, createdAt };
      const resolved = resolveFaceFeatures(entry);
      if (resolved) entry.features = resolved;
      faces.push(entry);
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
  // Drop meta for faces that fall off the library cap
  const kept = new Set(next.map((f) => f.id));
  const meta = readFaceMetaMap();
  let metaChanged = false;
  for (const id of Object.keys(meta)) {
    if (!kept.has(id)) {
      delete meta[id];
      metaChanged = true;
    }
  }
  if (metaChanged) writeFaceMetaMap(meta);

  writeCustomFaceLibrary({ faces: next });
  // Always store marks in the tiny meta key so pop-eyes survive even if image write trims.
  writeFaceFeatures(entry.id, faces.features);
  // Re-attach features onto the returned entry from the resolved merge.
  const resolved = resolveFaceFeatures(entry);
  if (resolved) entry.features = resolved;
  return entry;
}

export function deleteCustomFace(id: string): CustomFaceLibrary {
  const lib = readCustomFaceLibrary();
  const faces = lib.faces.filter((f) => f.id !== id);
  writeCustomFaceLibrary({ faces });
  deleteFaceFeatures(id);
  return { faces };
}

export function getCustomFace(id: string): CustomFaceEntry | null {
  return readCustomFaceLibrary().faces.find((f) => f.id === id) ?? null;
}

/** Ensure every library face with eye marks also has a meta entry (tiny, durable). */
export function syncFaceFeaturesMeta(lib?: CustomFaceLibrary) {
  const faces = (lib ?? readCustomFaceLibrary()).faces;
  const map = readFaceMetaMap();
  let changed = false;
  for (const face of faces) {
    if (!face.features) continue;
    if (map[face.id]) continue;
    map[face.id] = face.features;
    changed = true;
  }
  if (changed) writeFaceMetaMap(map);
}

export function isPhotoCharacterId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith('photo-');
}

/**
 * One-time: fade the neck on older saved photo faces that predate bottom blending.
 * `applyFade` should return clean/ooh/knockout with the bottom fade applied.
 */
export async function migratePhotoNeckFade(
  applyFade: (faces: CustomFaceSet) => Promise<Pick<CustomFaceSet, 'clean' | 'ooh' | 'knockout'>>,
): Promise<boolean> {
  const lib = readCustomFaceLibrary();
  const needing = lib.faces.filter((f) => !f.neckFaded);
  if (!needing.length) return false;
  const updated: CustomFaceEntry[] = [];
  for (const face of lib.faces) {
    if (face.neckFaded) {
      updated.push(face);
      continue;
    }
    try {
      const faded = await applyFade(face);
      updated.push({ ...face, ...faded, neckFaded: true });
    } catch {
      updated.push(face);
    }
  }
  writeCustomFaceLibrary({ faces: updated });
  return updated.some((f, i) => f !== lib.faces[i]);
}
