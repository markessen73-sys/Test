import { useMemo } from 'react';
import * as THREE from 'three';
import type { GlovePosition } from '../types/game';

interface GhostBoxerProps {
  leftPos: GlovePosition;
  rightPos: GlovePosition;
  screenToWorld: (pos: GlovePosition) => THREE.Vector3;
}

/** Subtle 3D arm depth behind screen gloves — body outline is 2D overlay. */
export function GhostBoxer({ leftPos, rightPos, screenToWorld }: GhostBoxerProps) {
  const leftWorld = useMemo(() => screenToWorld(leftPos), [leftPos, screenToWorld]);
  const rightWorld = useMemo(() => screenToWorld(rightPos), [rightPos, screenToWorld]);
  const leftShoulder = useMemo(() => new THREE.Vector3(-0.35, 1.05, -0.25), []);
  const rightShoulder = useMemo(() => new THREE.Vector3(0.35, 1.05, -0.25), []);

  return (
    <group position={[0, -0.1, 0.1]}>
      <ArmSegment from={leftShoulder} to={leftWorld} />
      <ArmSegment from={rightShoulder} to={rightWorld} />
    </group>
  );
}

function ArmSegment({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const mid = useMemo(() => from.clone().lerp(to, 0.5), [from, to]);
  const len = from.distanceTo(to);
  const dir = to.clone().sub(from).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

  return (
    <mesh position={mid} quaternion={quat}>
      <cylinderGeometry args={[0.05, 0.06, len, 8]} />
      <meshBasicMaterial color="#E8C49A" transparent opacity={0.12} depthWrite={false} />
    </mesh>
  );
}
