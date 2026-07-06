import type { CameraShot } from '../types/game';

/** Matches HeavyBagPlayScene — camera sits back from the target so equipment is not too close. */
export const PLAY_CAMERA_FORWARD = 4.25;
export const PLAY_CAMERA_Y_OFFSET = 0.08;
export const PLAY_CAMERA_FOV = 52;

export type PlayTarget = [number, number, number];

export function playCameraForTarget(lookAt: PlayTarget): CameraShot {
  return {
    position: [lookAt[0], lookAt[1] + PLAY_CAMERA_Y_OFFSET, lookAt[2] + PLAY_CAMERA_FORWARD],
    lookAt,
    fov: PLAY_CAMERA_FOV,
  };
}

/** Heavy bag body centre in play mode (world space). */
export const HEAVY_BAG_PLAY_TARGET: PlayTarget = [0, 1.3, -3.8];

/** Bobo doll torso centre in play mode. */
export const BOBO_PLAY_TARGET: PlayTarget = [0, 1.35, -3.8];

/** Speedball centre in play mode. */
export const SPEEDBALL_PLAY_TARGET: PlayTarget = [0, 1.55, -3.8];

/** Sparring partner centre in ring play mode. */
export const RING_PLAY_TARGET: PlayTarget = [0, 1.15, -2.2];

export const HEAVY_BAG_PLAY_CAMERA = playCameraForTarget(HEAVY_BAG_PLAY_TARGET);
export const BOBO_PLAY_CAMERA = playCameraForTarget(BOBO_PLAY_TARGET);
export const SPEEDBALL_PLAY_CAMERA = playCameraForTarget(SPEEDBALL_PLAY_TARGET);
export const RING_PLAY_CAMERA = playCameraForTarget(RING_PLAY_TARGET);
