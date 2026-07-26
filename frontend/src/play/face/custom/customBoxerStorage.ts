/** IndexedDB persistence for user-created boxers (full face packs). */

export const CUSTOM_BOXER_META_KEY = 'mickeys-gym-custom-boxers';

export interface CustomBoxerMeta {
  id: string;
  name: string;
  createdAt: number;
}

export interface CustomBoxerPackRecord {
  id: string;
  name: string;
  createdAt: number;
  clean: Blob;
  ooh: Blob;
  knockout: Blob;
  damage: Record<string, Blob>;
  clown: Record<string, Blob>;
}

const DB_NAME = 'mickeys-gym-custom-boxers';
const DB_VERSION = 1;
const STORE = 'packs';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

export function readCustomBoxerMeta(): CustomBoxerMeta[] {
  try {
    const raw = localStorage.getItem(CUSTOM_BOXER_META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomBoxerMeta[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m) => m && typeof m.id === 'string' && typeof m.name === 'string');
  } catch {
    return [];
  }
}

function writeCustomBoxerMeta(list: CustomBoxerMeta[]) {
  try {
    localStorage.setItem(CUSTOM_BOXER_META_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

export async function listCustomBoxerPacks(): Promise<CustomBoxerPackRecord[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const all = await idbReq(store.getAll() as IDBRequest<CustomBoxerPackRecord[]>);
    return (all || []).sort((a, b) => b.createdAt - a.createdAt);
  } finally {
    db.close();
  }
}

export async function getCustomBoxerPack(id: string): Promise<CustomBoxerPackRecord | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const row = await idbReq(store.get(id) as IDBRequest<CustomBoxerPackRecord | undefined>);
    return row ?? null;
  } finally {
    db.close();
  }
}

export async function saveCustomBoxerPack(pack: CustomBoxerPackRecord): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    await idbReq(store.put(pack));
  } finally {
    db.close();
  }
  const meta = readCustomBoxerMeta().filter((m) => m.id !== pack.id);
  meta.unshift({ id: pack.id, name: pack.name, createdAt: pack.createdAt });
  writeCustomBoxerMeta(meta);
}

export async function deleteCustomBoxerPack(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    await idbReq(store.delete(id));
  } finally {
    db.close();
  }
  writeCustomBoxerMeta(readCustomBoxerMeta().filter((m) => m.id !== id));
}

export function newCustomBoxerId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `custom:${crypto.randomUUID()}`;
  }
  return `custom:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isCustomCharacterId(id: string | null | undefined): id is `custom:${string}` {
  return typeof id === 'string' && id.startsWith('custom:');
}
