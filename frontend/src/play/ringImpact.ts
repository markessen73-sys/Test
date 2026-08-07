import * as THREE from 'three';
import type { GlovePosition } from '../types/game';
import { RING_PLAY_TARGET } from './playCamera';
import { targetZoneScreenOffset } from './punchImpact';
import { ringWeaveWorldDelta, type RingSwingState } from './ringSwing';

const _rest = new THREE.Vector3();
const _current = new THREE.Vector3();

export const RING_PARTNER_REST_WORLD = new THREE.Vector3(
  RING_PLAY_TARGET[0],
  RING_PLAY_TARGET[1],
  RING_PLAY_TARGET[2]
);

export function ringPartnerCenterAtSwing(state: RingSwingState): THREE.Vector3 {
  const delta = ringWeaveWorldDelta(
    state.worldOffsetX,
    state.worldOffsetY,
    state.worldOffsetZ
  );
  return new THREE.Vector3(
    RING_PLAY_TARGET[0] + delta.x,
    RING_PLAY_TARGET[1] + delta.y,
    RING_PLAY_TARGET[2] + delta.z
  );
}

export function ringZoneScreenOffset(state: RingSwingState, camera: THREE.Camera): GlovePosition {
  _rest.copy(RING_PARTNER_REST_WORLD);
  _current.copy(ringPartnerCenterAtSwing(state));
  return targetZoneScreenOffset(_rest, _current, camera);
}
