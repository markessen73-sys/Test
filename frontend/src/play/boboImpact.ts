import * as THREE from 'three';
import type { GlovePosition } from '../types/game';
import { BOBO_TORSO_HEIGHT } from './boboSwing';
import { BOBO_PLAY_TARGET } from './playCamera';
import { targetZoneScreenOffset } from './punchImpact';

const _euler = new THREE.Euler();
const _point = new THREE.Vector3();
const _rest = new THREE.Vector3();
const _current = new THREE.Vector3();

export const BOBO_WORLD_Z = BOBO_PLAY_TARGET[2];

/** Bobo torso centre in world space for current tilt (radians). Pivot is floor centre. */
export function boboCenterAtTilt(tiltX: number, tiltZ: number): THREE.Vector3 {
  _euler.set(tiltX, 0, tiltZ, 'YXZ');
  _point.set(0, BOBO_TORSO_HEIGHT, 0).applyEuler(_euler);
  return new THREE.Vector3(_point.x, _point.y, BOBO_WORLD_Z + _point.z);
}

/** Screen-space shift of the bobo hit zone as it wobbles. */
export function boboZoneScreenOffset(tiltX: number, tiltZ: number, camera: THREE.Camera): GlovePosition {
  _rest.copy(boboCenterAtTilt(0, 0));
  _current.copy(boboCenterAtTilt(tiltX, tiltZ));
  return targetZoneScreenOffset(_rest, _current, camera);
}
