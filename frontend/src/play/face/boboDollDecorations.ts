import * as THREE from 'three';
import { BOBO_HEAD_Y, BOBO_HEAD_RADIUS } from './boboFacePlacement';

/** Mid-torso band centre (world y on the doll). */
export const BOBO_BAND_Y = 1.42;
/** Band sits slightly proud of the tapered torso. */
export const BOBO_BAND_RADIUS = 0.47;
export const BOBO_BAND_HEIGHT = 0.26;
/** Tilt the sash across the torso (radians around Z). */
export const BOBO_BAND_TILT_Z = 0.52;

/** Hat sits on the crown; slight back tilt so the point reads. */
export const BOBO_HAT_POS: [number, number, number] = [
  0,
  BOBO_HEAD_Y + BOBO_HEAD_RADIUS * 0.72,
  -0.02,
];
export const BOBO_HAT_ROT: [number, number, number] = [0.22, 0, 0];

const STRIPE_COLORS = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa'];

/** Odd-pointed carnival star colours (above / below the sash). */
export const BOBO_STAR_COLORS = ['#ff1744', '#ffea00', '#2979ff', '#00e676', '#ff9100'];

/** Canvas texture: vertical carnival stripes + “BOBO THE CLOWN” on the front. */
export function createBoboBandTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const stripeW = w / 18;
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = STRIPE_COLORS[i % STRIPE_COLORS.length]!;
    ctx.fillRect(i * stripeW, 0, stripeW + 1, h);
  }

  // Nameplate sized for the camera-facing arc (~90° ≈ ¼ of the belt).
  // Texture u=0.5 faces the camera after the band mesh is yawed 180°.
  const labelW = w * 0.26;
  const labelX = (w - labelW) / 2;
  const labelY = h * 0.16;
  const labelH = h * 0.68;
  ctx.fillStyle = 'rgba(18, 10, 6, 0.92)';
  roundRect(ctx, labelX, labelY, labelW, labelH, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 248, 220, 0.6)';
  ctx.lineWidth = 3;
  roundRect(ctx, labelX + 3, labelY + 3, labelW - 6, labelH - 6, 12);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 36px Impact, "Arial Black", sans-serif';
  const cx = w / 2;
  const cy = h / 2 + 1;
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#1a0a00';
  ctx.fillStyle = '#fffef5';
  ctx.strokeText('BOBO THE CLOWN', cx, cy);
  ctx.fillText('BOBO THE CLOWN', cx, cy);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Triangular clown-hat panels (red / yellow / blue). */
export function createBoboHatTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const panels = ['#e53935', '#fdd835', '#1e88e5'];
  const panelW = w / 3;
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = panels[i]!;
    ctx.fillRect(i * panelW, 0, panelW + 1, h);
  }
  const g = ctx.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0.25)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Flat odd-pointed star (default 5 tips) for carnival accents.
 * Shared geometry — dispose once from the parent component.
 */
export function createOddStarGeometry(points = 5, outerR = 0.055, innerR = 0.024) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.computeVertexNormals();
  return geo;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
