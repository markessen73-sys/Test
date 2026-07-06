import * as THREE from 'three';

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Procedural worn nut-brown leather with occasional patches. */
export function createNutBrownLeatherTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  const img = ctx.createImageData(w, h);
  const data = img.data;

  const baseR = 94;
  const baseG = 58;
  const baseB = 28;

  const patches = Array.from({ length: 6 }, (_, i) => ({
    x: hash(i * 17.3, 1.1) * w,
    y: hash(2.7, i * 23.1) * h,
    radius: 36 + hash(i, i * 1.7) * 72,
    tone: hash(i * 5.1, i * 3.3) > 0.45 ? 1.14 : 0.82,
  }));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const grain = (hash(x * 0.18, y * 0.18) - 0.5) * 0.14;
      const fine = (hash(x * 0.9, y * 0.9) - 0.5) * 0.07;
      const crease = Math.sin((x + y) * 0.04) * 0.03;

      let patchMix = 0;
      for (const p of patches) {
        const dist = Math.hypot(x - p.x, y - p.y);
        if (dist < p.radius) {
          const t = 1 - dist / p.radius;
          patchMix += (p.tone - 1) * t * t;
        }
      }

      const shade = 1 + grain + fine + crease + patchMix;
      const i = (y * w + x) * 4;
      data[i] = Math.min(255, Math.max(0, baseR * shade));
      data[i + 1] = Math.min(255, Math.max(0, baseG * shade));
      data[i + 2] = Math.min(255, Math.max(0, baseB * shade));
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.2, 3.4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
