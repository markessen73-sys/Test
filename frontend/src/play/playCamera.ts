import type { CameraShot } from '../types/game';
import { RING_CANVAS_SURFACE_Y } from '../gym/SparringPartner';

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

/** Speedball ball centre in play mode (world Y). */
export const SPEEDBALL_BALL_Y = 2.15;
export const SPEEDBALL_PLAY_TARGET: PlayTarget = [0, SPEEDBALL_BALL_Y, -3.8];

/** Fixed camera aim — same as heavy bag/bobo so a raised ball reads higher on screen. */
const SPEEDBALL_CAMERA_LOOK_AT: PlayTarget = [0, 1.35, -3.8];

/** Ring group origin in world space — pulled back so the player corner sits behind max weave reach. */
export const RING_GROUP_ORIGIN_Z = -4.2;

/** Sparring partner chest height in ring play mode (world space). */
export const RING_PARTNER_FORWARD = 0.8;
/** Soles anchor on the canvas via SparringPartner spriteCenterY — no extra lift. */
export const RING_PARTNER_LIFT = 0;
export const RING_PARTNER_TARGET: PlayTarget = [
  0,
  2.57,
  RING_GROUP_ORIGIN_Z + RING_PARTNER_FORWARD,
];

/** Player / camera corner in world space (fixed — does not move with ring group shifts). */
export const RING_PLAYER_CORNER: PlayTarget = [3.44, 1.44, -5.84];

/** Red corner pad on the canvas (ring-local coordinates, derived from world corner). */
export const RING_PLAYER_CORNER_PAD: [number, number, number] = [
  RING_PLAYER_CORNER[0],
  RING_CANVAS_SURFACE_Y,
  RING_PLAYER_CORNER[2] - RING_GROUP_ORIGIN_Z,
];

/** Clearance between weave foot line and the corner pad (metres, toward camera). */
export const RING_CORNER_FEET_CLEARANCE = 0.35;

/** Eye height for ring sparring camera (raised so view is level with the partner, not upward). */
const RING_CAMERA_Y = 2.45;

/** Partner faces the player corner. */
export const RING_PARTNER_YAW = Math.atan2(
  RING_PLAYER_CORNER[0] - RING_PARTNER_TARGET[0],
  RING_PLAYER_CORNER[2] - RING_PARTNER_TARGET[2]
);

/** @deprecated Use RING_PARTNER_TARGET */
export const RING_PLAY_TARGET: PlayTarget = RING_PARTNER_TARGET;

export const HEAVY_BAG_PLAY_CAMERA = playCameraForTarget(HEAVY_BAG_PLAY_TARGET);
export const BOBO_PLAY_CAMERA = playCameraForTarget(BOBO_PLAY_TARGET);
export const SPEEDBALL_PLAY_CAMERA = playCameraForTarget(SPEEDBALL_CAMERA_LOOK_AT);
export const RING_PLAY_CAMERA: CameraShot = {
  position: [RING_PLAYER_CORNER[0], RING_CAMERA_Y, RING_PLAYER_CORNER[2]],
  lookAt: RING_PARTNER_TARGET,
  fov: 78,
};
