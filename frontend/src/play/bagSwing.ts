/** Pendulum swing state for the chained heavy bag. */
export interface BagSwingState {
  angle: number;
  angularVelocity: number;
}

export const BAG_PIVOT_Y = 3.75;
export const BAG_CHAIN_LENGTH = 1.38;
export const BAG_HANG_OFFSET_Y = -(BAG_CHAIN_LENGTH + 1.05);

const HIT_IMPULSE = 0.18;
const MAX_ANGULAR_VELOCITY = 1.05;
const MAX_ANGLE = 0.32;
const RESTORE_STIFFNESS = 10;
const DAMPING = 2.8;

export function createBagSwingState(): BagSwingState {
  return { angle: 0, angularVelocity: 0 };
}

/** Small impulse per hit; opposite-side hits subtract from current swing. */
export function applyBagHitImpulse(
  state: BagSwingState,
  glove: 'left' | 'right',
  powerScale = 1
): void {
  const impulse = (glove === 'left' ? HIT_IMPULSE : -HIT_IMPULSE) * powerScale;
  const maxVel = MAX_ANGULAR_VELOCITY * powerScale;
  state.angularVelocity = Math.max(-maxVel, Math.min(maxVel, state.angularVelocity + impulse));
}

export function stepBagSwing(state: BagSwingState, delta: number, powerScale = 1): void {
  const dt = Math.min(delta, 0.05);
  const maxAngle = MAX_ANGLE * powerScale;

  state.angularVelocity += -state.angle * RESTORE_STIFFNESS * dt;
  state.angularVelocity *= Math.exp(-DAMPING * dt);

  state.angle += state.angularVelocity * dt;
  state.angle = Math.max(-maxAngle, Math.min(maxAngle, state.angle));

  if (Math.abs(state.angle) >= maxAngle * 0.98) {
    state.angularVelocity *= 0.35;
  }
}
