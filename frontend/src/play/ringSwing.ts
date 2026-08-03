import { Vector3, type Camera } from 'three';

/** Sparring partner lateral shuffle and punch-recoil motion. */
export interface RingSwingState {
  time: number;
  /** Punch-driven lateral recoil (added on top of shuffle). */
  punchOffset: number;
  punchVel: number;
  /** World-space shuffle offset (along camera right). */
  worldOffsetX: number;
  worldOffsetY: number;
  worldOffsetZ: number;
  /** Subtle lean into the shuffle (radians). */
  leanZ: number;
}

const HIT_IMPULSE = 0.22;
const MAX_VEL = 1.2;
const PUNCH_SPRING = 14;
const PUNCH_DAMPING = 4;

/** Metres of travel each side of centre — scales with ring sprite size. */
const SHUFFLE_AMPLITUDE = 1.55;
const SHUFFLE_SPEED = 0.68;

const LEAN_INTO_SHUFFLE = 0.29;
const LEAN_WOBBLE = 0.03;

const _cameraRight = new Vector3();
const _cameraUp = new Vector3();
const _cameraForward = new Vector3();

export function createRingSwingState(): RingSwingState {
  return {
    time: 0,
    punchOffset: 0,
    punchVel: 0,
    worldOffsetX: 0,
    worldOffsetY: 0,
    worldOffsetZ: 0,
    leanZ: 0,
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

/** Unit vector pointing to the camera's right (screen-left → screen-right in world space). */
function cameraRightUnit(camera: Camera, out: Vector3): Vector3 {
  camera.updateMatrixWorld();
  camera.matrixWorld.extractBasis(out, _cameraUp, _cameraForward);
  return out.normalize();
}

export function stepRingSwing(
  state: RingSwingState,
  delta: number,
  scale = 1,
  options: { knockedOut?: boolean; camera?: Camera } = {}
): void {
  const dt = Math.min(delta, 0.05);
  state.time += dt;
  const intensity = options.knockedOut ? 0.2 : 1;

  stepPunchRecoil(state, dt);

  const shuffle =
    Math.sin(state.time * SHUFFLE_SPEED) * SHUFFLE_AMPLITUDE * scale * intensity +
    state.punchOffset;

  if (options.camera) {
    const right = cameraRightUnit(options.camera, _cameraRight);
    state.worldOffsetX = right.x * shuffle;
    state.worldOffsetY = right.y * shuffle;
    state.worldOffsetZ = right.z * shuffle;
  } else {
    state.worldOffsetX = shuffle;
    state.worldOffsetY = 0;
    state.worldOffsetZ = 0;
  }

  state.leanZ =
    shuffle * LEAN_INTO_SHUFFLE +
    Math.sin(state.time * 1.48 + 0.8) * LEAN_WOBBLE * intensity;
}
