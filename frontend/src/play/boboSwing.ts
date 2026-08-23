/** 3-axis rocking bobo — pinned at floor centre, wobbles side-to-side and toward camera. */
export interface BoboSwingState {
  tiltX: number;
  tiltZ: number;
  velX: number;
  velZ: number;
  time: number;
}

const HIT_IMPULSE_Z = 1.8;
const HIT_IMPULSE_X = 0.81;
const MAX_VEL = 12.15;
const MAX_TILT = 3.42;
const RESTORE = 11;
const DAMPING = 3.0;
const IDLE_X_AMP = 0.016;
const IDLE_Z_AMP = 0.02;
const IDLE_FREQ = 1.35;

export function createBoboSwingState(): BoboSwingState {
  return { tiltX: 0, tiltZ: 0, velX: 0, velZ: 0, time: 0 };
}

export function applyBoboHitImpulse(state: BoboSwingState, glove: 'left' | 'right'): void {
  // Every hit: sideways in punch direction + lean away from camera.
  const zImpulse = glove === 'right' ? HIT_IMPULSE_Z : -HIT_IMPULSE_Z;
  state.velZ = Math.max(-MAX_VEL, Math.min(MAX_VEL, state.velZ + zImpulse));
  state.velX = Math.max(-MAX_VEL, Math.min(MAX_VEL, state.velX + HIT_IMPULSE_X));
}

export function stepBoboSwing(state: BoboSwingState, delta: number): void {
  const dt = Math.min(delta, 0.05);
  state.time += dt;

  const idleX = Math.sin(state.time * IDLE_FREQ) * IDLE_X_AMP;
  const idleZ = Math.sin(state.time * IDLE_FREQ * 0.88 + 0.9) * IDLE_Z_AMP;

  state.velX += (-state.tiltX + idleX) * RESTORE * dt;
  state.velZ += (-state.tiltZ + idleZ) * RESTORE * dt;
  state.velX *= Math.exp(-DAMPING * dt);
  state.velZ *= Math.exp(-DAMPING * dt);

  state.tiltX += state.velX * dt;
  state.tiltZ += state.velZ * dt;
  state.tiltX = Math.max(-MAX_TILT, Math.min(MAX_TILT, state.tiltX));
  state.tiltZ = Math.max(-MAX_TILT, Math.min(MAX_TILT, state.tiltZ));
}

/** Torso centre height when upright (pivot at floor). */
export const BOBO_TORSO_HEIGHT = 1.35;
