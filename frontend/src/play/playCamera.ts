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
export const RING_GROUP_ORIGIN_Z = -6.0;

/** Play-mode ring size multiplier (base canvas half-width was 2.2 m). */
export const RING_SCALE = 1.5;
const RING_BASE_HALF = 2.2;
export const RING_HALF = RING_BASE_HALF * RING_SCALE;
export const RING_FLOOR_SIZE = 5.2 * RING_SCALE;
export const RING_CANVAS_SIZE = 4.6 * RING_SCALE;
export const RING_ROPE_SPAN = 4.4 * RING_SCALE;
export const RING_ROPE_HEIGHTS = [0.5, 0.95, 1.4].map((h) => h * RING_SCALE);
export const RING_POST_HEIGHT = 1.5 * RING_SCALE;
export const RING_CORNER_PAD_SIZE = 0.58 * RING_SCALE;

/** Ring-local Z of partner feet — toward player corner (lower = closer to camera). */
export const RING_PARTNER_FORWARD = 0.2;
/** Drop soles onto the grey canvas (fine-tune below RING_CANVAS_SURFACE_Y). */
export const RING_PARTNER_LIFT = -0.16;
const RING_PARTNER_CHEST_ABOVE_FEET = 2.33;
export const RING_PARTNER_TARGET: PlayTarget = [
  0,
  RING_CANVAS_SURFACE_Y + RING_PARTNER_LIFT + RING_PARTNER_CHEST_ABOVE_FEET,
  RING_GROUP_ORIGIN_Z + RING_PARTNER_FORWARD,
];

/** Back-right corner pad on the canvas (ring-local). */
const RING_CORNER_PAD_INSET = 0.92;

/** Eye height for ring sparring camera (raised so view is level with the partner, not upward). */
const RING_CAMERA_Y = 2.45;

/** Nudge camera from the corner pad toward ring centre — keeps nearest ropes off-screen. */
const RING_CAMERA_CORNER_INSET = 0.12;

/** Player / camera corner in world space. */
export const RING_PLAYER_CORNER: PlayTarget = [
  RING_HALF * RING_CORNER_PAD_INSET,
  1.44,
  RING_GROUP_ORIGIN_Z - RING_HALF * RING_CORNER_PAD_INSET,
];

function ringCameraPosition(): [number, number, number] {
  const cornerX = RING_PLAYER_CORNER[0];
  const cornerZ = RING_PLAYER_CORNER[2];
  const toCentreX = -cornerX;
  const toCentreZ = RING_GROUP_ORIGIN_Z - cornerZ;
  const len = Math.hypot(toCentreX, toCentreZ) || 1;
  const inset = RING_CAMERA_CORNER_INSET;
  return [
    cornerX + (toCentreX / len) * inset,
    RING_CAMERA_Y,
    cornerZ + (toCentreZ / len) * inset,
  ];
}

/** Red corner pad on the canvas (ring-local coordinates). */
export const RING_PLAYER_CORNER_PAD: [number, number, number] = [
  RING_HALF * RING_CORNER_PAD_INSET,
  RING_CANVAS_SURFACE_Y,
  -RING_HALF * RING_CORNER_PAD_INSET,
];

/** Clearance between weave foot line and the corner pad (metres, toward camera). */
export const RING_CORNER_FEET_CLEARANCE = 0.35;

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
  position: ringCameraPosition(),
  lookAt: RING_PARTNER_TARGET,
  fov: 82,
};
