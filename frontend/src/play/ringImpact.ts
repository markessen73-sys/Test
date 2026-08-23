import * as THREE from 'three';
import type { GlovePosition } from '../types/game';
import { RING_PLAY_TARGET } from './playCamera';
import { targetZoneScreenOffset } from './punchImpact';
import type { RingSwingState } from './ringSwing';

const _rest = new THREE.Vector3();
const _current = new THREE.Vector3();

export function ringPartnerCenterAtSwing(state: RingSwingState): THREE.Vector3 {
  return new THREE.Vector3(
    RING_PLAY_TARGET[0] + state.offsetX,
    RING_PLAY_TARGET[1],
    RING_PLAY_TARGET[2]
  );
}

export function ringZoneScreenOffset(state: RingSwingState, camera: THREE.Camera): GlovePosition {
  _rest.set(RING_PLAY_TARGET[0], RING_PLAY_TARGET[1], RING_PLAY_TARGET[2]);
  _current.copy(ringPartnerCenterAtSwing(state));
  return targetZoneScreenOffset(_rest, _current, camera);
}
