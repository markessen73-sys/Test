/** Pendulum swing state for the chained heavy bag. */
export interface BagSwingState {
  angle: number;
  angularVelocity: number;
}

export const BAG_PIVOT_Y = 3.5;
export const BAG_HANG_OFFSET_Y = -2.15;

const HIT_IMPULSE = 0.18;
const MAX_ANGULAR_VELOCITY = 1.05;
const MAX_ANGLE = 0.32;
const RESTORE_STIFFNESS = 10;
const DAMPING = 2.8;

export function createBagSwingState(): BagSwingState {
  return { angle: 0, angularVelocity: 0 };
}

/** Small impulse per hit; opposite-side hits subtract from current swing. */
export function applyBagHitImpulse(state: BagSwingState, glove: 'left' | 'right'): void {
  const impulse = glove === 'left' ? HIT_IMPULSE : -HIT_IMPULSE;
  state.angularVelocity = Math.max(
    -MAX_ANGULAR_VELOCITY,
    Math.min(MAX_ANGULAR_VELOCITY, state.angularVelocity + impulse)
  );
}

export function stepBagSwing(state: BagSwingState, delta: number): void {
  const dt = Math.min(delta, 0.05);

  state.angularVelocity += -state.angle * RESTORE_STIFFNESS * dt;
  state.angularVelocity *= Math.exp(-DAMPING * dt);

  state.angle += state.angularVelocity * dt;
  state.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, state.angle));

  if (Math.abs(state.angle) >= MAX_ANGLE * 0.98) {
    state.angularVelocity *= 0.35;
  }
}
