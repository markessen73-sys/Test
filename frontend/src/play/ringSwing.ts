import { Vector3, type Camera } from 'three';
import {
  RING_CANVAS_SURFACE_Y,
  RING_SPRITE_SCALE,
  SPARRING_SPRITE_BASE_HEIGHT,
} from '../gym/SparringPartner';
import { projectWorldToScreenNorm } from './punchImpact';
import { RING_PARTNER_FORWARD, RING_PARTNER_LIFT, RING_PARTNER_YAW } from './playCamera';

/** Sparring partner lateral shuffle and punch-recoil motion. */
export interface RingSwingState {
  time: number;
  /** Punch-driven lateral recoil (added on top of shuffle). */
  punchOffset: number;
  punchVel: number;
  /** World-space shuffle offset (figure-8 in camera right/forward plane). */
  worldOffsetX: number;
  worldOffsetY: number;
  worldOffsetZ: number;
}

const HIT_IMPULSE = 0.22;
const MAX_VEL = 1.2;
const PUNCH_SPRING = 14;
const PUNCH_DAMPING = 4;

/** Metres of lateral travel each side of centre — clamped to screen edges. */
const LATERAL_AMPLITUDE = 1.55;
/** Toward/away travel for the figure-8 (second harmonic along camera forward). */
const DEPTH_AMPLITUDE = 0.72;
const SHUFFLE_SPEED = 0.68;

/** Inset from the true screen edge — small so the sprite can use full width at rest. */
const SCREEN_EDGE_MARGIN = 0.008;

const RING_GROUP_Z = -2.2;
const FEET_SOLE_FRAC = 76 / 1536;
const SPRITE_PLANE_Z = 0.02;

const _cameraRight = new Vector3();
const _cameraUp = new Vector3();
const _cameraForward = new Vector3();
const _corner = new Vector3();
const _axisY = new Vector3(0, 1, 0);
const _restScreens: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];
const _curScreens: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];

interface RingSwingClampContext {
  partnerBaseWorld: [number, number, number];
  partnerYaw: number;
  spriteWidth: number;
  spriteCenterY: number;
  spriteHeight: number;
}

export function createRingSwingState(): RingSwingState {
  return {
    time: 0,
    punchOffset: 0,
    punchVel: 0,
    worldOffsetX: 0,
    worldOffsetY: 0,
    worldOffsetZ: 0,
  };
}

export function applyRingHitImpulse(state: RingSwingState, glove: 'left' | 'right'): void {
  const impulse = glove === 'left' ? HIT_IMPULSE : -HIT_IMPULSE;
  state.punchVel = Math.max(-MAX_VEL, Math.min(MAX_VEL, state.punchVel + impulse));
}

function stepPunchRecoil(state: RingSwingState, delta: number): void {
  const dt = Math.min(delta, 0.05);
  state.punchVel += -state.punchOffset * PUNCH_SPRING * dt;
  state.punchVel *= Math.exp(-PUNCH_DAMPING * dt);
  state.punchOffset += state.punchVel * dt;
}

/** World-space delta from shuffle offset. */
export function ringWeaveWorldDelta(
  offsetX: number,
  offsetY: number,
  offsetZ: number
): { x: number; y: number; z: number } {
  return { x: offsetX, y: offsetY, z: offsetZ };
}

function buildClampContext(scale: number): RingSwingClampContext {
  const height = SPARRING_SPRITE_BASE_HEIGHT * scale;
  const width = height * (1024 / 1536);
  const centerY = height * (0.5 - FEET_SOLE_FRAC);
  return {
    partnerBaseWorld: [
      0,
      RING_CANVAS_SURFACE_Y + RING_PARTNER_LIFT,
      RING_GROUP_Z + RING_PARTNER_FORWARD,
    ],
    partnerYaw: RING_PARTNER_YAW,
    spriteWidth: width,
    spriteHeight: height,
    spriteCenterY: centerY,
  };
}

function spriteCornerWorld(
  cornerLocalX: number,
  cornerLocalY: number,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  ctx: RingSwingClampContext,
  out: Vector3
): Vector3 {
  out.set(cornerLocalX, cornerLocalY, SPRITE_PLANE_Z);
  out.applyAxisAngle(_axisY, ctx.partnerYaw);
  out.x += offsetX + ctx.partnerBaseWorld[0];
  out.y += offsetY + ctx.partnerBaseWorld[1];
  out.z += offsetZ + ctx.partnerBaseWorld[2];
  return out;
}

function spriteCornerScreens(
  camera: Camera,
  ctx: RingSwingClampContext,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  out: { x: number; y: number }[]
): void {
  const halfW = ctx.spriteWidth * 0.5;
  const halfH = ctx.spriteHeight * 0.5;
  const cy = ctx.spriteCenterY;
  const locals: [number, number][] = [
    [-halfW, cy - halfH],
    [halfW, cy - halfH],
    [-halfW, cy + halfH],
    [halfW, cy + halfH],
  ];

  for (let i = 0; i < 4; i++) {
    const [lx, ly] = locals[i];
    spriteCornerWorld(lx, ly, offsetX, offsetY, offsetZ, ctx, _corner);
    const screen = projectWorldToScreenNorm(_corner, camera);
    out[i].x = screen.x;
    out[i].y = screen.y;
  }
}

function spriteOffsetAllowedAtScale(
  camera: Camera,
  ctx: RingSwingClampContext,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  scale: number,
  portrait: boolean
): boolean {
  if (scale <= 1e-9) return true;

  spriteCornerScreens(camera, ctx, 0, 0, 0, _restScreens);
  spriteCornerScreens(camera, ctx, offsetX * scale, offsetY * scale, offsetZ * scale, _curScreens);

  let restMinX = 1;
  let restMaxX = 0;
  let restMinY = 1;
  let restMaxY = 0;
  for (let i = 0; i < 4; i++) {
    restMinX = Math.min(restMinX, _restScreens[i].x);
    restMaxX = Math.max(restMaxX, _restScreens[i].x);
    restMinY = Math.min(restMinY, _restScreens[i].y);
    restMaxY = Math.max(restMaxY, _restScreens[i].y);
  }

  let curMinX = 1;
  let curMaxX = 0;
  let curMinY = 1;
  let curMaxY = 0;
  for (let i = 0; i < 4; i++) {
    curMinX = Math.min(curMinX, _curScreens[i].x);
    curMaxX = Math.max(curMaxX, _curScreens[i].x);
    curMinY = Math.min(curMinY, _curScreens[i].y);
    curMaxY = Math.max(curMaxY, _curScreens[i].y);
  }

  const min = SCREEN_EDGE_MARGIN;
  const max = 1 - SCREEN_EDGE_MARGIN;
  const leftLimit = Math.min(restMinX, min);
  const rightLimit = Math.max(restMaxX, max);

  if (curMinX < leftLimit || curMaxX > rightLimit) return false;

  if (!portrait) {
    const bottomLimit = Math.min(restMinY, min);
    const topLimit = Math.max(restMaxY, max);
    if (curMinY < bottomLimit || curMaxY > topLimit) return false;
  }

  return true;
}

/** Scale offset down until sprite corners stay inside the viewport. */
function clampOffsetToScreen(
  camera: Camera,
  ctx: RingSwingClampContext,
  offsetX: number,
  offsetY: number,
  offsetZ: number,
  portrait: boolean
): { x: number; y: number; z: number } {
  if (spriteOffsetAllowedAtScale(camera, ctx, offsetX, offsetY, offsetZ, 1, portrait)) {
    return { x: offsetX, y: offsetY, z: offsetZ };
  }

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) * 0.5;
    if (spriteOffsetAllowedAtScale(camera, ctx, offsetX, offsetY, offsetZ, mid, portrait)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return { x: offsetX * lo, y: offsetY * lo, z: offsetZ * lo };
}

/** Unit vector pointing to the camera's right (screen-left → screen-right in world space). */
function cameraBasis(camera: Camera): {
  right: Vector3;
  forward: Vector3;
} {
  camera.updateMatrixWorld();
  camera.matrixWorld.extractBasis(_cameraRight, _cameraUp, _cameraForward);
  _cameraForward.multiplyScalar(-1).normalize();
  _cameraRight.normalize();
  return { right: _cameraRight, forward: _cameraForward };
}

export function stepRingSwing(
  state: RingSwingState,
  delta: number,
  scale = RING_SPRITE_SCALE,
  options: { knockedOut?: boolean; camera?: Camera; portrait?: boolean } = {}
): void {
  const dt = Math.min(delta, 0.05);
  state.time += dt;
  const intensity = options.knockedOut ? 0.2 : 1;

  stepPunchRecoil(state, dt);

  const phase = state.time * SHUFFLE_SPEED;
  const lateral =
    Math.sin(phase) * LATERAL_AMPLITUDE * scale * intensity + state.punchOffset;
  const depth = Math.sin(phase * 2) * DEPTH_AMPLITUDE * scale * intensity;

  if (options.camera) {
    const { right, forward } = cameraBasis(options.camera);
    const unclampedX = right.x * lateral + forward.x * depth;
    const unclampedY = right.y * lateral + forward.y * depth;
    const unclampedZ = right.z * lateral + forward.z * depth;

    const ctx = buildClampContext(scale);
    const clamped = clampOffsetToScreen(
      options.camera,
      ctx,
      unclampedX,
      unclampedY,
      unclampedZ,
      options.portrait ?? false
    );
    state.worldOffsetX = clamped.x;
    state.worldOffsetY = clamped.y;
    state.worldOffsetZ = clamped.z;
  } else {
    state.worldOffsetX = lateral;
    state.worldOffsetY = 0;
    state.worldOffsetZ = depth;
  }
}
