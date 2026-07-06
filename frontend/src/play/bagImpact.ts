import * as THREE from 'three';
import type { GlovePosition } from '../types/game';

export interface BagPunchImpact {
  id: number;
  glove: 'left' | 'right';
  knuckle: GlovePosition;
  time: number;
}

export interface BagDent {
  localPoint: THREE.Vector3;
  depth: number;
  radius: number;
}

const _ndc = new THREE.Vector2();
const _ray = new THREE.Raycaster();
const _hit = new THREE.Vector3();

export const BAG_WORLD_Z = -3.8;

export function screenNormToNdc(pos: GlovePosition): THREE.Vector2 {
  _ndc.set(pos.x * 2 - 1, -(pos.y * 2 - 1));
  return _ndc;
}

export interface BagHitResult {
  localPoint: THREE.Vector3;
  localNormal: THREE.Vector3;
}

/** Raycast from screen knuckle position onto the bag body mesh (mesh local space). */
export function raycastBagBodyHit(
  knuckle: GlovePosition,
  camera: THREE.Camera,
  bodyMesh: THREE.Mesh
): BagHitResult | null {
  _ray.setFromCamera(screenNormToNdc(knuckle), camera);
  const hits = _ray.intersectObject(bodyMesh, false);
  if (!hits.length || !hits[0].face) return null;
  _hit.copy(hits[0].point);
  bodyMesh.worldToLocal(_hit);
  const localNormal = hits[0].face.normal.clone();
  return {
    localPoint: _hit.clone(),
    localNormal,
  };
}

export function applyBagDents(
  geometry: THREE.BufferGeometry,
  originalPositions: Float32Array,
  dents: BagDent[]
): void {
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  arr.set(originalPositions);

  for (const dent of dents) {
    const { localPoint, depth, radius } = dent;
    for (let i = 0; i < arr.length; i += 3) {
      const vx = arr[i];
      const vy = arr[i + 1];
      const vz = arr[i + 2];
      const dx = vx - localPoint.x;
      const dy = vy - localPoint.y;
      const dz = vz - localPoint.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist >= radius) continue;

      const t = 1 - dist / radius;
      const falloff = t * t;
      const radial = Math.hypot(vx, vz) || 1e-6;
      arr[i] -= (vx / radial) * depth * falloff * 0.55;
      arr[i + 2] -= (vz / radial) * depth * falloff * 0.55;
      arr[i + 2] += depth * falloff * 0.65;
    }
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}
