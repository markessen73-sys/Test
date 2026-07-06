import * as THREE from 'three';
import type { GlovePosition } from '../types/game';
import { SPEEDBALL_PLAY_TARGET } from './playCamera';
import { projectWorldToScreenNorm, targetZoneScreenOffset } from './punchImpact';
import type { SpeedballSwingState } from './speedballSwing';

const _rest = new THREE.Vector3();
const _current = new THREE.Vector3();

export const SPEEDBALL_WORLD_Z = SPEEDBALL_PLAY_TARGET[2];

export function speedballCenterAtSwing(state: SpeedballSwingState): THREE.Vector3 {
  return new THREE.Vector3(
    state.offsetX,
    SPEEDBALL_PLAY_TARGET[1],
    SPEEDBALL_WORLD_Z + state.offsetZ
  );
}

export function speedballZoneScreenOffset(state: SpeedballSwingState, camera: THREE.Camera): GlovePosition {
  _rest.set(SPEEDBALL_PLAY_TARGET[0], SPEEDBALL_PLAY_TARGET[1], SPEEDBALL_WORLD_Z);
  _current.copy(speedballCenterAtSwing(state));
  return targetZoneScreenOffset(_rest, _current, camera);
}

export { projectWorldToScreenNorm };
