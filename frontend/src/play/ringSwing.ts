import { Vector3, type Camera } from 'three';
import {
  RING_CANVAS_SURFACE_Y,
  RING_SPRITE_SCALE,
  SPARRING_SPRITE_BASE_HEIGHT,
} from '../gym/SparringPartner';
import { projectWorldToScreenNorm } from './punchImpact';
import { RING_CORNER_FEET_CLEARANCE, RING_GROUP_ORIGIN_Z, RING_PARTNER_FORWARD, RING_PARTNER_LIFT, RING_PARTNER_YAW, RING_PLAYER_CORNER } from './playCamera';

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

const SHUFFLE_SPEED = 0.68;

const RING_GROUP_Z = RING_GROUP_ORIGIN_Z;
const FEET_SOLE_FRAC = 76 / 1536;
const SPRITE_PLANE_Z = 0.02;

const _cameraRight = new Vector3();
const _cameraUp = new Vector3();
const _cameraForward = new Vector3();
const _corner = new Vector3();
const _axisY = new Vector3(0, 1, 0);

interface RingSwingClampContext {
  partnerBaseWorld: [number, number, number];
  partnerYaw: number;
  spriteWidth: number;
  spriteCenterY: number;
  spriteHeight: number;
}

interface ScreenBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
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

function spriteScreenBounds(
  camera: Camera,
  ctx: RingSwingClampContext,
  offsetX: number,
  offsetY: number,
  offsetZ: number
): ScreenBounds {
  const halfW = ctx.spriteWidth * 0.5;
  const halfH = ctx.spriteHeight * 0.5;
  const cy = ctx.spriteCenterY;
  const locals: [number, number][] = [
    [-halfW, cy - halfH],
    [halfW, cy - halfH],
    [-halfW, cy + halfH],
    [halfW, cy + halfH],
  ];

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;

  for (const [lx, ly] of locals) {
    spriteCornerWorld(lx, ly, offsetX, offsetY, offsetZ, ctx, _corner);
    const screen = projectWorldToScreenNorm(_corner, camera);
    minX = Math.min(minX, screen.x);
    maxX = Math.max(maxX, screen.x);
    minY = Math.min(minY, screen.y);
    maxY = Math.max(maxY, screen.y);
  }

  return { minX, maxX, minY, maxY };
}

/** World offset scale along axis where the left body edge touches the screen. */
function findEdgeTouchScale(
  camera: Camera,
  ctx: RingSwingClampContext,
  axis: Vector3,
  edge: 'left' | 'right'
): number {
  let lo = -6;
  let hi = 6;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) * 0.5;
    const bounds = spriteScreenBounds(
      camera,
      ctx,
      axis.x * mid,
      axis.y * mid,
      axis.z * mid
    );
    if (edge === 'left') {
      if (bounds.minX < 0) lo = mid;
      else hi = mid;
    } else if (bounds.maxX > 1) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return (lo + hi) * 0.5;
}

/** Max toward-camera depth that keeps the sprite inside the horizontal screen edges. */
function findMaxTowardDepth(
  camera: Camera,
  ctx: RingSwingClampContext,
  baseX: number,
  baseY: number,
  baseZ: number,
  forward: Vector3
): number {
  let lo = 0;
  let hi = 4;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) * 0.5;
    const bounds = spriteScreenBounds(
      camera,
      ctx,
      baseX + forward.x * mid,
      baseY + forward.y * mid,
      baseZ + forward.z * mid
    );
    if (bounds.minX >= 0 && bounds.maxX <= 1) lo = mid;
    else hi = mid;
  }
  return lo;
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
  const lateralWave = (Math.sin(phase) + 1) * 0.5;
  const depthWave = (Math.sin(phase * 2) + 1) * 0.5;

  if (options.camera) {
    const { right, forward } = cameraBasis(options.camera);
    const ctx = buildClampContext(scale);

    const leftScale = findEdgeTouchScale(options.camera, ctx, right, 'left');
    const rightScale = findEdgeTouchScale(options.camera, ctx, right, 'right');
    const lateralScale =
      (rightScale + lateralWave * (leftScale - rightScale) + state.punchOffset) * intensity;

    const baseX = right.x * lateralScale;
    const baseY = right.y * lateralScale;
    const baseZ = right.z * lateralScale;

    const maxToward = findMaxTowardDepth(options.camera, ctx, baseX, baseY, baseZ, forward);
    let depthScale = depthWave * maxToward * intensity;

    let ox = baseX + forward.x * depthScale;
    let oy = baseY + forward.y * depthScale;
    let oz = baseZ + forward.z * depthScale;

    const minFeetZ = RING_PLAYER_CORNER[2] + RING_CORNER_FEET_CLEARANCE;
    const minOz = minFeetZ - ctx.partnerBaseWorld[2];
    if (oz < minOz) {
      const allowedDepth = minOz - baseZ;
      if (Math.abs(forward.z) > 1e-6) {
        depthScale = Math.max(0, allowedDepth / forward.z);
      } else {
        depthScale = 0;
      }
      ox = baseX + forward.x * depthScale;
      oy = baseY + forward.y * depthScale;
      oz = baseZ + forward.z * depthScale;
    }

    state.worldOffsetX = ox;
    state.worldOffsetY = oy;
    state.worldOffsetZ = oz;
  } else {
    const lateral = (lateralWave * 2 - 1) * 1.55 * scale * intensity + state.punchOffset;
    const depth = depthWave * 0.72 * scale * intensity;
    state.worldOffsetX = lateral;
    state.worldOffsetY = 0;
    state.worldOffsetZ = depth;
  }
}
