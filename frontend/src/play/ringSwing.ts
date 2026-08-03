import { Vector3, type Camera } from 'three';
import { RING_PARTNER_YAW } from './playCamera';
import { SPARRING_SPRITE_BASE_HEIGHT } from '../gym/SparringPartner';
import { projectWorldToScreenNorm } from './punchImpact';

/** Sparring partner lateral shuffle and punch-recoil motion. */
export interface RingSwingState {
  time: number;
  /** Punch-driven lateral recoil (added on top of shuffle). */
  punchOffsetX: number;
  punchVelX: number;
  /** Combined world-space weave offsets in partner-local axes. */
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  /** Subtle lean into the shuffle (radians). */
  leanZ: number;
}

const HIT_IMPULSE = 0.16;
const MAX_VEL = 1.05;
const PUNCH_SPRING = 14;
const PUNCH_DAMPING = 4;

/** Screen edges — body centre targets inside these, accounting for sprite width. */
const SCREEN_EDGE_MIN = 0.03;
const SCREEN_EDGE_MAX = 0.97;

const SPRITE_ASPECT = 1024 / 1536;
const LEAN_INTO_SHUFFLE = 0.29;
const LEAN_WOBBLE = 0.03;

const _local = { x: 0, y: 0, z: 0 };
const _probeWorld = new Vector3();

export function createRingSwingState(): RingSwingState {
  return {
    time: 0,
    punchOffsetX: 0,
    punchVelX: 0,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    leanZ: 0,
  };
}

export function applyRingHitImpulse(state: RingSwingState, glove: 'left' | 'right'): void {
  const impulse = glove === 'left' ? HIT_IMPULSE : -HIT_IMPULSE;
  state.punchVelX = Math.max(-MAX_VEL, Math.min(MAX_VEL, state.punchVelX + impulse));
}

function stepPunchRecoil(state: RingSwingState, delta: number): void {
  const dt = Math.min(delta, 0.05);
  state.punchVelX += -state.punchOffsetX * PUNCH_SPRING * dt;
  state.punchVelX *= Math.exp(-PUNCH_DAMPING * dt);
  state.punchOffsetX += state.punchVelX * dt;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Transform partner-local offset to world-space delta from rest aim point. */
export function ringWeaveWorldDelta(
  offsetX: number,
  offsetY: number,
  offsetZ: number
): { x: number; y: number; z: number } {
  _local.x = offsetX;
  _local.y = offsetY;
  _local.z = offsetZ;
  const cos = Math.cos(RING_PARTNER_YAW);
  const sin = Math.sin(RING_PARTNER_YAW);
  return {
    x: _local.x * cos + _local.z * sin,
    y: _local.y,
    z: -_local.x * sin + _local.z * cos,
  };
}

function lateralScreenX(offsetX: number, restWorld: Vector3, camera: Camera): number {
  const delta = ringWeaveWorldDelta(offsetX, 0, 0);
  _probeWorld.set(
    restWorld.x + delta.x,
    restWorld.y + delta.y,
    restWorld.z + delta.z
  );
  return projectWorldToScreenNorm(_probeWorld, camera).x;
}

function spriteHalfWidth(scale: number): number {
  return SPARRING_SPRITE_BASE_HEIGHT * scale * SPRITE_ASPECT * 0.5;
}

/** How wide half the boxer sprite is in screen space (for edge clamping). */
function bodyHalfWidthScreen(restWorld: Vector3, camera: Camera, scale: number): number {
  const hw = spriteHalfWidth(scale);
  const center = lateralScreenX(0, restWorld, camera);
  const edge = lateralScreenX(hw, restWorld, camera);
  return Math.abs(edge - center);
}

/**
 * Find partner-local X that places the torso near a target screen X.
 * Scans then refines — robust regardless of camera yaw direction.
 */
function solveOffsetXForScreenX(
  targetScreenX: number,
  restWorld: Vector3,
  camera: Camera,
  scale: number
): number {
  const range = 3.2 * scale;
  let best = 0;
  let bestErr = Infinity;
  const scanSteps = 48;
  for (let i = 0; i <= scanSteps; i++) {
    const ox = -range + (2 * range * i) / scanSteps;
    const err = Math.abs(lateralScreenX(ox, restWorld, camera) - targetScreenX);
    if (err < bestErr) {
      bestErr = err;
      best = ox;
    }
  }

  let lo = best - range / scanSteps;
  let hi = best + range / scanSteps;
  const increasing = lateralScreenX(hi, restWorld, camera) > lateralScreenX(lo, restWorld, camera);
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) * 0.5;
    const screen = lateralScreenX(mid, restWorld, camera);
    if (increasing ? screen < targetScreenX : screen > targetScreenX) lo = mid;
    else hi = mid;
  }
  return (lo + hi) * 0.5;
}

/** Shuffle the body centre from the left screen edge to the right. */
function shuffleTargetScreenX(
  t: number,
  intensity: number,
  halfBodyScreen: number
): number {
  const phase = (Math.sin(t * 0.62) + 1) * 0.5;
  const left = SCREEN_EDGE_MIN + halfBodyScreen;
  const right = SCREEN_EDGE_MAX - halfBodyScreen;
  const span = Math.max(0.12, right - left);
  return left + phase * span * intensity;
}

/**
 * Pull lateral offset back only when punch recoil pushes past the screen edge.
 */
export function clampWeaveToScreen(
  state: RingSwingState,
  restWorld: Vector3,
  camera: Camera,
  scale: number
): void {
  const halfBody = bodyHalfWidthScreen(restWorld, camera, scale);
  let fit = 1;
  for (let i = 0; i < 6; i++) {
    const delta = ringWeaveWorldDelta(state.offsetX * fit, 0, 0);
    _probeWorld.set(
      restWorld.x + delta.x,
      restWorld.y + delta.y,
      restWorld.z + delta.z
    );
    const screen = projectWorldToScreenNorm(_probeWorld, camera).x;
    const worst = Math.max(
      SCREEN_EDGE_MIN + halfBody - screen,
      screen - (SCREEN_EDGE_MAX - halfBody)
    );
    if (worst <= 0) break;
    fit *= clamp(1 - worst * 3, 0.5, 0.9);
  }

  if (fit < 1) {
    state.offsetX *= fit;
    state.punchOffsetX *= fit;
  }
}

export function stepRingSwing(
  state: RingSwingState,
  delta: number,
  scale = 1,
  options: { knockedOut?: boolean; camera?: Camera; restWorld?: Vector3 } = {}
): void {
  const dt = Math.min(delta, 0.05);
  state.time += dt;
  const intensity = options.knockedOut ? 0.2 : 1;

  stepPunchRecoil(state, dt);

  let shuffleX = 0;
  if (options.camera && options.restWorld) {
    const halfBody = bodyHalfWidthScreen(options.restWorld, options.camera, scale);
    const targetX = shuffleTargetScreenX(state.time, intensity, halfBody);
    shuffleX = solveOffsetXForScreenX(targetX, options.restWorld, options.camera, scale);
  }

  state.offsetX = shuffleX + state.punchOffsetX;
  state.offsetY = 0;
  state.offsetZ = 0;
  state.leanZ =
    shuffleX * LEAN_INTO_SHUFFLE +
    Math.sin(state.time * 1.48 + 0.8) * LEAN_WOBBLE * intensity;

  if (options.camera && options.restWorld) {
    clampWeaveToScreen(state, options.restWorld, options.camera, scale);
  }
}
