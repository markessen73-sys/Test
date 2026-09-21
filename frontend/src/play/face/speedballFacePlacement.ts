/** Shared speedball ball / face-wrap sizing. */

/** Visual leather ball radius (metres) — matches Equipment + PlayScene meshes. */
export const SPEEDBALL_BALL_RADIUS = 0.3

/** Face shell sits slightly proud so it clears the leather mesh. */
export function speedballFaceRadius(ballRadius: number): number {
  return ballRadius * 1.012
}

export const SPEEDBALL_FACE_RADIUS = speedballFaceRadius(SPEEDBALL_BALL_RADIUS)
