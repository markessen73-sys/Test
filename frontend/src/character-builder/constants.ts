/** Shared canvas + anchor for every character layer. */
export const CANVAS_WIDTH = 512;
export const CANVAS_HEIGHT = 512;

/** Normalised anchor — identical for all layers (canvas centre). */
export const ANCHOR_X = 0.5;
export const ANCHOR_Y = 0.5;

export type LayerKey =
  | 'head'
  | 'skin'
  | 'ears'
  | 'eyes'
  | 'eyebrows'
  | 'nose'
  | 'mouth'
  | 'hair'
  | 'beard'
  | 'glasses'
  | 'accessories';

/** Render stack order (bottom → top). */
export const LAYER_RENDER_ORDER = [
  'head',
  'skin',
  'ears',
  'eyes',
  'eyebrows',
  'nose',
  'mouth',
  'hair',
  'beard',
  'glasses',
  'accessories',
] as const;

/** Folder name on disk for each character JSON key. */
export const LAYER_FOLDER: Record<LayerKey, string> = {
  head: 'head',
  skin: 'skin',
  ears: 'ears',
  eyes: 'eyes',
  eyebrows: 'eyebrows',
  nose: 'noses',
  mouth: 'mouths',
  hair: 'hair',
  beard: 'beards',
  glasses: 'glasses',
  accessories: 'accessories',
};

/** Layers where index 0 means “none”. */
export const OPTIONAL_LAYERS = new Set<LayerKey>(['beard', 'glasses', 'accessories']);

export interface CharacterData {
  head: number;
  skin: number;
  ears: number;
  eyes: number;
  eyebrows: number;
  nose: number;
  mouth: number;
  hair: number;
  beard: number;
  glasses: number;
  accessories: number;
}

export interface AssetManifest {
  version: number;
  canvas: { width: number; height: number; anchorX: number; anchorY: number };
  layers: Record<string, number[]>;
  generatedAt: string;
}

export type LayerCatalog = Record<LayerKey, number[]>;
