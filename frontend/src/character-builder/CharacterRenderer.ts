import { Character } from './Character';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  LAYER_RENDER_ORDER,
  OPTIONAL_LAYERS,
  type LayerKey,
} from './constants';
import { layerAssetCandidates, loadLayerCatalog } from './assetCatalog';
import { drawPlaceholderLayer } from './placeholders';

type ImageCacheKey = `${LayerKey}:${number}`;

/** Composites modular face layers onto a shared 512x512 canvas. */
export class CharacterRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private character: Character;
  private imageCache = new Map<ImageCacheKey, HTMLImageElement | null>();
  private loading = new Map<ImageCacheKey, Promise<HTMLImageElement | null>>();
  private unsubscribe: (() => void) | null = null;
  private renderGeneration = 0;

  constructor(character?: Character, canvas?: HTMLCanvasElement) {
    this.canvas = canvas ?? document.createElement('canvas');
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
    this.character = character ?? new Character();
    this.bindCharacter(this.character);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getCharacter(): Character {
    return this.character;
  }

  setCharacter(character: Character): void {
    if (this.character === character) return;
    this.unsubscribe?.();
    this.character = character;
    this.bindCharacter(character);
    void this.render();
  }

  async init(): Promise<void> {
    await loadLayerCatalog();
    await this.render();
  }

  async render(): Promise<void> {
    const gen = ++this.renderGeneration;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const layer of LAYER_RENDER_ORDER) {
      if (gen !== this.renderGeneration) return;
      await this.drawLayer(layer, gen);
    }
  }

  toDataURL(type = 'image/png'): string {
    return this.canvas.toDataURL(type);
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.imageCache.clear();
    this.loading.clear();
  }

  private bindCharacter(character: Character): void {
    this.unsubscribe = character.subscribe(() => {
      void this.render();
    });
  }

  private async drawLayer(layer: LayerKey, gen: number): Promise<void> {
    const index = this.character.getLayer(layer);
    if (index <= 0) {
      if (OPTIONAL_LAYERS.has(layer)) return;
      drawPlaceholderLayer(this.ctx, layer, 1);
      return;
    }

    const img = await this.loadLayerImage(layer, index);
    if (gen !== this.renderGeneration) return;

    if (img) {
      this.ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
      drawPlaceholderLayer(this.ctx, layer, index);
    }
  }

  private cacheKey(layer: LayerKey, index: number): ImageCacheKey {
    return `${layer}:${index}`;
  }

  private async loadLayerImage(layer: LayerKey, index: number): Promise<HTMLImageElement | null> {
    const key = this.cacheKey(layer, index);
    if (this.imageCache.has(key)) return this.imageCache.get(key) ?? null;
    if (this.loading.has(key)) return this.loading.get(key)!;

    const promise = this.fetchFirstAvailable(layer, index).then((img) => {
      this.imageCache.set(key, img);
      this.loading.delete(key);
      return img;
    });
    this.loading.set(key, promise);
    return promise;
  }

  private async fetchFirstAvailable(layer: LayerKey, index: number): Promise<HTMLImageElement | null> {
    for (const url of layerAssetCandidates(layer, index)) {
      const img = await tryLoadImage(url);
      if (img) return img;
    }
    return null;
  }
}

function tryLoadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
