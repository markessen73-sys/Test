import * as THREE from 'three';
import type { GloveId, GlovePosition } from '../types/game';

export interface PunchImpact {
  id: number;
  glove: GloveId;
  knuckle: GlovePosition;
  time: number;
}

const _projected = new THREE.Vector3();

/** Project a world point to normalized screen coords (0–1). */
export function projectWorldToScreenNorm(point: THREE.Vector3, camera: THREE.Camera): GlovePosition {
  _projected.copy(point).project(camera);
  return {
    x: (_projected.x + 1) * 0.5,
    y: (-_projected.y + 1) * 0.5,
  };
}

export function screenNormToNdc(pos: GlovePosition): THREE.Vector2 {
  return new THREE.Vector2(pos.x * 2 - 1, -(pos.y * 2 - 1));
}

/** Screen-space shift of a target between rest and current world positions. */
export function targetZoneScreenOffset(
  restWorld: THREE.Vector3,
  currentWorld: THREE.Vector3,
  camera: THREE.Camera
): GlovePosition {
  const rest = projectWorldToScreenNorm(restWorld, camera);
  const cur = projectWorldToScreenNorm(currentWorld, camera);
  return { x: cur.x - rest.x, y: cur.y - rest.y };
}
