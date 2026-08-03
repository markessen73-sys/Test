import { Vector3, type Camera } from 'three';
import { RING_PARTNER_YAW } from './playCamera';
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
  /** Unused — kept for hit-zone compat; shuffle is pure translation. */
  leanZ: number;
}

const HIT_IMPULSE = 0.16;
const MAX_VEL = 1.05;
const PUNCH_SPRING = 14;
const PUNCH_DAMPING = 4;

/** Keep the sprite torso on screen — tuned for ring play camera. */
const SCREEN_MARGIN = 0.08;
const SCREEN_MAX = 1 - SCREEN_MARGIN;

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

/** Binary-search partner-local X so the chest aim point lands at a screen X. */
function solveOffsetXForScreenX(
  targetScreenX: number,
  restWorld: Vector3,
  camera: Camera,
  scale: number
): number {
  let lo = -1.4 * scale;
  let hi = 1.4 * scale;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) * 0.5;
    if (lateralScreenX(mid, restWorld, camera) < targetScreenX) lo = mid;
    else hi = mid;
  }
  return (lo + hi) * 0.5;
}

/** Target screen X for a slow side-to-side shuffle (0 = left edge, 1 = right). */
function shuffleTargetScreenX(t: number, intensity: number): number {
  const span = SCREEN_MAX - SCREEN_MARGIN;
  const inset = span * 0.06;
  const usable = span - inset * 2;
  const phase = (Math.sin(t * 0.68) + 1) * 0.5;
  const center = SCREEN_MARGIN + inset + usable * 0.5;
  const amplitude = (usable * 0.5) * intensity;
  return center + (phase - 0.5) * 2 * amplitude;
}

/**
 * Pull lateral offset back if the combined shuffle + punch recoil leaves the viewport.
 */
export function clampWeaveToScreen(
  state: RingSwingState,
  restWorld: Vector3,
  camera: Camera
): void {
  let fit = 1;
  for (let i = 0; i < 8; i++) {
    const delta = ringWeaveWorldDelta(state.offsetX * fit, 0, 0);
    _probeWorld.set(
      restWorld.x + delta.x,
      restWorld.y + delta.y,
      restWorld.z + delta.z
    );
    const screen = projectWorldToScreenNorm(_probeWorld, camera);
    const worst = Math.max(SCREEN_MARGIN - screen.x, screen.x - SCREEN_MAX);
    if (worst <= 0) break;
    fit *= clamp(1 - worst * 2.2, 0.45, 0.92);
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
    const targetX = shuffleTargetScreenX(state.time, intensity);
    shuffleX = solveOffsetXForScreenX(targetX, options.restWorld, options.camera, scale);
  }

  state.offsetX = shuffleX + state.punchOffsetX;
  state.offsetY = 0;
  state.offsetZ = 0;
  state.leanZ = 0;

  if (options.camera && options.restWorld) {
    clampWeaveToScreen(state, options.restWorld, options.camera);
  }
}
