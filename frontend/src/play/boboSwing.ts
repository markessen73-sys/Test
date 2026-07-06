/** Rocking bobo doll — weighted base spring. */
export interface BoboSwingState {
  angle: number;
  angularVelocity: number;
}

const HIT_IMPULSE = 0.16;
const MAX_ANGULAR_VELOCITY = 1.2;
const MAX_ANGLE = 0.42;
const RESTORE_STIFFNESS = 14;
const DAMPING = 3.2;

export function createBoboSwingState(): BoboSwingState {
  return { angle: 0, angularVelocity: 0 };
}

export function applyBoboHitImpulse(state: BoboSwingState, glove: 'left' | 'right'): void {
  const impulse = glove === 'left' ? HIT_IMPULSE : -HIT_IMPULSE;
  state.angularVelocity = Math.max(
    -MAX_ANGULAR_VELOCITY,
    Math.min(MAX_ANGULAR_VELOCITY, state.angularVelocity + impulse)
  );
}

export function stepBoboSwing(state: BoboSwingState, delta: number): void {
  const dt = Math.min(delta, 0.05);

  state.angularVelocity += -state.angle * RESTORE_STIFFNESS * dt;
  state.angularVelocity *= Math.exp(-DAMPING * dt);

  state.angle += state.angularVelocity * dt;
  state.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, state.angle));

  if (Math.abs(state.angle) >= MAX_ANGLE * 0.98) {
    state.angularVelocity *= 0.35;
  }
}
