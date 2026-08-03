import * as THREE from 'three';
import { BOBO_HEAD_Y, BOBO_HEAD_RADIUS } from './boboFacePlacement';

/** Mid-torso band centre (world y on the doll). */
export const BOBO_BAND_Y = 1.42;
/** Band sits slightly proud of the tapered torso. */
export const BOBO_BAND_RADIUS = 0.455;
export const BOBO_BAND_HEIGHT = 0.28;

/** Hat sits on the crown; slight back tilt so the point reads. */
export const BOBO_HAT_POS: [number, number, number] = [
  0,
  BOBO_HEAD_Y + BOBO_HEAD_RADIUS * 0.72,
  -0.02,
];
export const BOBO_HAT_ROT: [number, number, number] = [0.22, 0, 0];

const STRIPE_COLORS = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa'];

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

  // Soft dark band behind the lettering so it stays readable on stripes.
  const labelW = w * 0.52;
  const labelX = (w - labelW) / 2;
  const labelY = h * 0.18;
  const labelH = h * 0.64;
  ctx.fillStyle = 'rgba(20, 12, 8, 0.55)';
  roundRect(ctx, labelX, labelY, labelW, labelH, 18);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 72px "Arial Black", Impact, sans-serif';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(20, 10, 0, 0.85)';
  ctx.fillStyle = '#fffef5';
  const cx = w / 2;
  const cy = h / 2 + 4;
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
  // Soft highlight toward the tip
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
