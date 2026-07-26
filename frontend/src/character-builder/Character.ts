import {
  LAYER_RENDER_ORDER,
  OPTIONAL_LAYERS,
  type CharacterData,
  type LayerKey,
} from './constants';

const DEFAULT_CHARACTER: CharacterData = {
  head: 1,
  skin: 1,
  ears: 1,
  eyes: 1,
  eyebrows: 1,
  nose: 1,
  mouth: 1,
  hair: 1,
  beard: 0,
  glasses: 0,
  accessories: 0,
};

type ChangeListener = (character: Character, layer: LayerKey) => void;

/**
 * Modular character — stored only as layer indices (JSON-serialisable).
 */
export class Character {
  private data: CharacterData;
  private listeners = new Set<ChangeListener>();

  constructor(initial?: Partial<CharacterData>) {
    this.data = { ...DEFAULT_CHARACTER, ...initial };
  }

  static fromJSON(json: CharacterData | string): Character {
    const data = typeof json === 'string' ? (JSON.parse(json) as CharacterData) : json;
    return new Character(data);
  }

  toJSON(): CharacterData {
    return { ...this.data };
  }

  clone(): Character {
    return new Character(this.data);
  }

  getLayer(layer: LayerKey): number {
    return this.data[layer];
  }

  setLayer(layer: LayerKey, index: number): void {
    const value = Math.max(0, Math.floor(index));
    if (this.data[layer] === value) return;
    this.data = { ...this.data, [layer]: value };
    this.notify(layer);
  }

  /** Replace all layers at once (single render tick). */
  apply(data: Partial<CharacterData>): void {
    this.data = { ...this.data, ...data };
    this.notify('head');
  }

  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Layers that should be drawn for the current config. */
  activeLayers(): LayerKey[] {
    return LAYER_RENDER_ORDER.filter((layer) => {
      const index = this.data[layer];
      if (index <= 0) return !OPTIONAL_LAYERS.has(layer);
      return true;
    });
  }

  private notify(layer: LayerKey): void {
    for (const fn of this.listeners) fn(this, layer);
  }
}

export { DEFAULT_CHARACTER };
