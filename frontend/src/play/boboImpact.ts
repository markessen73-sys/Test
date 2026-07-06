import * as THREE from 'three';
import type { GlovePosition } from '../types/game';
import { BOBO_PLAY_TARGET } from './playCamera';
import { targetZoneScreenOffset } from './punchImpact';

const _rest = new THREE.Vector3();
const _current = new THREE.Vector3();

export const BOBO_WORLD_Z = BOBO_PLAY_TARGET[2];

/** Bobo torso centre in world space for a rock angle (radians). */
export function boboCenterAtSwing(angle: number): THREE.Vector3 {
  const baseY = 0.12;
  const torsoY = 0.85;
  const radius = torsoY - baseY;
  return new THREE.Vector3(
    radius * Math.sin(angle),
    baseY + radius * Math.cos(angle),
    BOBO_WORLD_Z
  );
}

/** Screen-space shift of the bobo hit zone as it rocks. */
export function boboZoneScreenOffset(angle: number, camera: THREE.Camera): GlovePosition {
  _rest.copy(boboCenterAtSwing(0));
  _current.copy(boboCenterAtSwing(angle));
  return targetZoneScreenOffset(_rest, _current, camera);
}
