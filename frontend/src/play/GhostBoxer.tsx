import { useMemo } from 'react';
import * as THREE from 'three';
import type { GlovePosition } from '../types/game';

interface GhostBoxerProps {
  leftPos: GlovePosition;
  rightPos: GlovePosition;
  screenToWorld: (pos: GlovePosition) => THREE.Vector3;
}

function Arm({ from, to, opacity }: { from: THREE.Vector3; to: THREE.Vector3; opacity: number }) {
  const mid = useMemo(() => from.clone().lerp(to, 0.5), [from, to]);
  const len = from.distanceTo(to);
  const dir = to.clone().sub(from).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

  return (
    <mesh position={mid} quaternion={quat}>
      <cylinderGeometry args={[0.06, 0.07, len, 8]} />
      <meshStandardMaterial color="#C49A6C" transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function Glove({ position }: { position: THREE.Vector3 }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial color="#8B0000" roughness={0.45} metalness={0.1} />
      </mesh>
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 0.14, 12]} />
        <meshStandardMaterial color="#6B0000" roughness={0.5} />
      </mesh>
    </group>
  );
}

export function GhostBoxer({ leftPos, rightPos, screenToWorld }: GhostBoxerProps) {
  const bodyOpacity = 0.18;
  const leftWorld = useMemo(() => screenToWorld(leftPos), [leftPos, screenToWorld]);
  const rightWorld = useMemo(() => screenToWorld(rightPos), [rightPos, screenToWorld]);

  const leftShoulder = useMemo(() => new THREE.Vector3(-0.35, 1.15, -0.1), []);
  const rightShoulder = useMemo(() => new THREE.Vector3(0.35, 1.15, -0.1), []);

  return (
    <group>
      {/* Torso — see-through */}
      <mesh position={[0, 0.75, 0.15]} castShadow>
        <boxGeometry args={[0.75, 1.0, 0.4]} />
        <meshStandardMaterial
          color="#C49A6C"
          transparent
          opacity={bodyOpacity}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Head hint */}
      <mesh position={[0, 1.45, 0.1]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#C49A6C" transparent opacity={bodyOpacity * 0.8} depthWrite={false} />
      </mesh>
      {/* Abdomen */}
      <mesh position={[0, 0.35, 0.12]}>
        <boxGeometry args={[0.65, 0.5, 0.35]} />
        <meshStandardMaterial color="#B8895A" transparent opacity={bodyOpacity} depthWrite={false} />
      </mesh>

      <Arm from={leftShoulder} to={leftWorld} opacity={bodyOpacity + 0.05} />
      <Arm from={rightShoulder} to={rightWorld} opacity={bodyOpacity + 0.05} />

      {/* Solid gloves — NOT transparent */}
      <Glove position={leftWorld} />
      <Glove position={rightWorld} />
    </group>
  );
}
