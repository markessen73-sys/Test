import * as THREE from 'three';
import type { GlovePosition } from '../types/game';
import { SPEEDBALL_BALL_Y } from './playCamera';
import { projectWorldToScreenNorm } from './punchImpact';
import type { HitZoneCorners } from './targetZone';

const _point = new THREE.Vector3();

/** Ball mesh radius + torus (world units). */
const BALL_RADIUS = 0.34;

export const SPEEDBALL_WORLD_Z = -3.8;

function projectAt(camera: THREE.Camera, x: number, y: number, z: number): GlovePosition {
  _point.set(x, y, z);
  return projectWorldToScreenNorm(_point, camera);
}

/** Screen-space hit box traced from the live ball position each frame. */
export function computeSpeedballHitZone(
  camera: THREE.Camera,
  offsetX = 0,
  offsetZ = 0
): HitZoneCorners {
  const wx = offsetX;
  const wy = SPEEDBALL_BALL_Y;
  const wz = SPEEDBALL_WORLD_Z + offsetZ;

  const center = projectAt(camera, wx, wy, wz);
  const right = projectAt(camera, wx + BALL_RADIUS, wy, wz);
  const left = projectAt(camera, wx - BALL_RADIUS, wy, wz);
  const top = projectAt(camera, wx, wy + BALL_RADIUS, wz);
  const bottom = projectAt(camera, wx, wy - BALL_RADIUS, wz);

  const halfW = Math.max(right.x - center.x, center.x - left.x) * 1.1;
  const halfH = Math.max(bottom.y - center.y, center.y - top.y) * 1.1;

  return [
    { x: center.x - halfW, y: center.y - halfH },
    { x: center.x + halfW, y: center.y - halfH },
    { x: center.x + halfW, y: center.y + halfH },
    { x: center.x - halfW, y: center.y + halfH },
  ];
}
