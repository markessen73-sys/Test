/** Sparring partner sway on punch. */
export interface RingSwingState {
  offsetX: number;
  velX: number;
}

const HIT_IMPULSE = 0.14;
const MAX_VEL = 0.9;
const SPRING = 12;
const DAMPING = 3.5;

export function createRingSwingState(): RingSwingState {
  return { offsetX: 0, velX: 0 };
}

export function applyRingHitImpulse(state: RingSwingState, glove: 'left' | 'right'): void {
  const impulse = glove === 'left' ? HIT_IMPULSE : -HIT_IMPULSE;
  state.velX = Math.max(-MAX_VEL, Math.min(MAX_VEL, state.velX + impulse));
}

export function stepRingSwing(state: RingSwingState, delta: number): void {
  const dt = Math.min(delta, 0.05);

  state.velX += -state.offsetX * SPRING * dt;
  state.velX *= Math.exp(-DAMPING * dt);
  state.offsetX += state.velX * dt;
}
