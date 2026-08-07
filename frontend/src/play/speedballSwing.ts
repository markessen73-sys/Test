/** Speedball rebound swing on punch. */
export interface SpeedballSwingState {
  offsetX: number;
  offsetZ: number;
  velX: number;
  velZ: number;
}

const HIT_IMPULSE = 0.55;
const MAX_VEL = 2.8;
const SPRING = 18;
const DAMPING = 4.5;

export function createSpeedballSwingState(): SpeedballSwingState {
  return { offsetX: 0, offsetZ: 0, velX: 0, velZ: 0 };
}

export function applySpeedballHitImpulse(
  state: SpeedballSwingState,
  glove: 'left' | 'right',
  powerScale = 1
): void {
  const impulse = (glove === 'left' ? HIT_IMPULSE : -HIT_IMPULSE) * powerScale;
  const maxVel = MAX_VEL * powerScale;
  state.velX = Math.max(-maxVel, Math.min(maxVel, state.velX + impulse));
  state.velZ = Math.max(-maxVel, Math.min(maxVel, state.velZ + impulse * 0.35));
}

export function stepSpeedballSwing(state: SpeedballSwingState, delta: number): void {
  const dt = Math.min(delta, 0.05);

  state.velX += -state.offsetX * SPRING * dt;
  state.velZ += -state.offsetZ * SPRING * dt;
  state.velX *= Math.exp(-DAMPING * dt);
  state.velZ *= Math.exp(-DAMPING * dt);

  state.offsetX += state.velX * dt;
  state.offsetZ += state.velZ * dt;
}
