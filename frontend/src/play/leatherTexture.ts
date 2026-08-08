import * as THREE from 'three';

export interface LeatherMaps {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function buildLeatherCanvas(size: number): {
  color: Uint8ClampedArray;
  roughness: Uint8ClampedArray;
  bump: Uint8ClampedArray;
} {
  const color = new Uint8ClampedArray(size * size * 4);
  const roughness = new Uint8ClampedArray(size * size * 4);
  const bump = new Uint8ClampedArray(size * size * 4);

  const baseR = 118;
  const baseG = 72;
  const baseB = 38;

  const patches = Array.from({ length: 8 }, (_, i) => ({
    x: hash(i * 17.3, 1.1) * size,
    y: hash(2.7, i * 23.1) * size,
    radius: 42 + hash(i, i * 1.7) * 88,
    tone: hash(i * 5.1, i * 3.3) > 0.5 ? 1.22 : 0.78,
    rough: hash(i * 2.1, i * 4.3) > 0.5 ? 1.15 : 0.88,
  }));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const grain = (hash(x * 0.22, y * 0.22) - 0.5) * 0.22;
      const fine = (hash(x * 1.1, y * 1.1) - 0.5) * 0.1;
      const crease = Math.sin((x + y) * 0.055) * 0.05;
      const stitchBand = Math.abs((y + x * 0.35) % 48 - 24) < 1.2 ? 0.08 : 0;

      let patchMix = 0;
      let roughMix = 0;
      for (const p of patches) {
        const dist = Math.hypot(x - p.x, y - p.y);
        if (dist < p.radius) {
          const t = 1 - dist / p.radius;
          const w = t * t;
          patchMix += (p.tone - 1) * w;
          roughMix += (p.rough - 1) * w;
        }
      }

      const shade = 1 + grain + fine + crease + stitchBand + patchMix;
      const i = (y * size + x) * 4;
      color[i] = Math.min(255, Math.max(0, baseR * shade));
      color[i + 1] = Math.min(255, Math.max(0, baseG * shade));
      color[i + 2] = Math.min(255, Math.max(0, baseB * shade));
      color[i + 3] = 255;

      const roughVal = Math.min(255, Math.max(0, (0.72 + roughMix + grain * 0.15) * 255));
      roughness[i] = roughVal;
      roughness[i + 1] = roughVal;
      roughness[i + 2] = roughVal;
      roughness[i + 3] = 255;

      const bumpVal = Math.min(255, Math.max(0, (0.5 + grain * 0.8 + stitchBand * 2) * 255));
      bump[i] = bumpVal;
      bump[i + 1] = bumpVal;
      bump[i + 2] = bumpVal;
      bump[i + 3] = 255;
    }
  }

  return { color, roughness, bump };
}

function canvasFromRgba(data: Uint8ClampedArray, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.putImageData(new ImageData(data, size, size), 0, 0);
  return canvas;
}

function makeTexture(canvas: HTMLCanvasElement, repeatX: number, repeatY: number): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/** Procedural worn nut-brown leather with grain, stitches, and patches. */
export function createNutBrownLeatherMaps(): LeatherMaps {
  const size = 512;
  const { color, roughness, bump } = buildLeatherCanvas(size);
  return {
    map: makeTexture(canvasFromRgba(color, size), 2.4, 3.6),
    roughnessMap: makeTexture(canvasFromRgba(roughness, size), 2.4, 3.6),
    bumpMap: makeTexture(canvasFromRgba(bump, size), 2.4, 3.6),
  };
}

let cachedLeatherMaps: LeatherMaps | null = null;

/** Cached singleton — avoids StrictMode dispose/recreate flicker. */
export function getNutBrownLeatherMaps(): LeatherMaps {
  if (!cachedLeatherMaps) cachedLeatherMaps = createNutBrownLeatherMaps();
  return cachedLeatherMaps;
}
