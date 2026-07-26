import { assetUrl } from '../assetUrl';
import type { AssetManifest, LayerCatalog, LayerKey } from './constants';
import { LAYER_FOLDER, LAYER_RENDER_ORDER } from './constants';

const MANIFEST_URL = assetUrl('/assets/manifest.json');

let cachedManifest: AssetManifest | null = null;
let cachedCatalog: LayerCatalog | null = null;

export async function loadAssetManifest(): Promise<AssetManifest> {
  if (cachedManifest) return cachedManifest;
  const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load asset manifest (${res.status})`);
  cachedManifest = (await res.json()) as AssetManifest;
  return cachedManifest;
}

/** Build per-layer index lists from manifest (no hardcoded counts). */
export function catalogFromManifest(manifest: AssetManifest): LayerCatalog {
  const catalog = {} as LayerCatalog;
  for (const key of LAYER_RENDER_ORDER) {
    const folder = LAYER_FOLDER[key];
    catalog[key] = manifest.layers[folder] ?? [];
  }
  return catalog;
}

export async function loadLayerCatalog(): Promise<LayerCatalog> {
  if (cachedCatalog) return cachedCatalog;
  const manifest = await loadAssetManifest();
  cachedCatalog = catalogFromManifest(manifest);
  return cachedCatalog;
}

/** Resolve asset URL candidates for a layer index (tries common extensions). */
export function layerAssetCandidates(layer: LayerKey, index: number): string[] {
  const folder = LAYER_FOLDER[layer];
  const base = assetUrl(`/assets/${folder}/${index}`);
  return [`${base}.png`, `${base}.webp`, `${base}.svg`, `${base}.jpg`];
}

export function invalidateAssetCache(): void {
  cachedManifest = null;
  cachedCatalog = null;
}
