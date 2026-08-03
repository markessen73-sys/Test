import { Vector3, type Camera } from 'three';
import { RING_PARTNER_YAW } from './playCamera';
import { projectWorldToScreenNorm } from './punchImpact';

/** Sparring partner bob, weave, and punch-recoil motion. */
export interface RingSwingState {
  time: number;
  /** Punch-driven lateral recoil (added on top of idle weave). */
  punchOffsetX: number;
  punchVelX: number;
  /** Combined world-space weave offsets in partner-local axes. */
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  /** Lean into slips (radians, partner-local Z). */
  leanZ: number;
}

const HIT_IMPULSE = 0.16;
const MAX_VEL = 1.05;
const PUNCH_SPRING = 14;
const PUNCH_DAMPING = 4;

/** Keep the sprite torso on screen — tuned for ring play camera. */
const SCREEN_MARGIN = 0.07;
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

/** Layered idle slips, ducks, and leans — scale with ring sprite size. */
function idleWeave(t: number, scale: number, intensity: number) {
  const slipX =
    (Math.sin(t * 1.35) * 0.22 + Math.sin(t * 2.2 + 1.15) * 0.1 + Math.sin(t * 0.72 + 2.4) * 0.05) *
    scale *
    intensity;
  const duckY =
    (Math.sin(t * 1.72 + 0.55) * 0.16 + Math.sin(t * 3.05 + 1.9) * 0.06 + Math.sin(t * 0.95) * 0.04) *
    scale *
    intensity;
  const depthZ =
    (Math.sin(t * 1.08 + 1.75) * 0.12 + Math.sin(t * 1.85 + 0.3) * 0.05) * scale * intensity;
  const leanZ = slipX * 0.58 + Math.sin(t * 1.48 + 0.8) * 0.06 * intensity;
  return { slipX, duckY, depthZ, leanZ };
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

/**
 * Scale weave down if the partner aim point would leave the viewport.
 * Uses the rest chest position as anchor.
 */
export function clampWeaveToScreen(
  state: RingSwingState,
  restWorld: Vector3,
  camera: Camera,
  scale: number
): void {
  const maxX = 0.34 * scale;
  const maxY = 0.2 * scale;
  const maxZ = 0.15 * scale;
  state.offsetX = clamp(state.offsetX, -maxX, maxX);
  state.offsetY = clamp(state.offsetY, -maxY, maxY);
  state.offsetZ = clamp(state.offsetZ, -maxZ, maxZ);

  let fit = 1;
  for (let i = 0; i < 8; i++) {
    const delta = ringWeaveWorldDelta(
      state.offsetX * fit,
      state.offsetY * fit,
      state.offsetZ * fit
    );
    _probeWorld.set(
      restWorld.x + delta.x,
      restWorld.y + delta.y,
      restWorld.z + delta.z
    );
    const screen = projectWorldToScreenNorm(_probeWorld, camera);
    const worst = Math.max(
      SCREEN_MARGIN - screen.x,
      screen.x - SCREEN_MAX,
      SCREEN_MARGIN - screen.y,
      screen.y - SCREEN_MAX
    );
    if (worst <= 0) break;
    fit *= clamp(1 - worst * 2.2, 0.45, 0.92);
  }

  if (fit < 1) {
    state.offsetX *= fit;
    state.offsetY *= fit;
    state.offsetZ *= fit;
    state.leanZ *= fit;
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
  const intensity = options.knockedOut ? 0.12 : 1;

  stepPunchRecoil(state, dt);
  const idle = idleWeave(state.time, scale, intensity);

  state.offsetX = idle.slipX + state.punchOffsetX;
  state.offsetY = idle.duckY;
  state.offsetZ = idle.depthZ;
  state.leanZ = idle.leanZ;

  if (options.camera && options.restWorld) {
    clampWeaveToScreen(state, options.restWorld, options.camera, scale);
  }
}
