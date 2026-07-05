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
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color="#B80000" roughness={0.35} metalness={0.15} emissive="#440000" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.11, 0.13, 0.16, 12]} />
        <meshStandardMaterial color="#8B0000" roughness={0.45} />
      </mesh>
    </group>
  );
}

export function GhostBoxer({ leftPos, rightPos, screenToWorld }: GhostBoxerProps) {
  const bodyOpacity = 0.42;
  const leftWorld = useMemo(() => screenToWorld(leftPos), [leftPos, screenToWorld]);
  const rightWorld = useMemo(() => screenToWorld(rightPos), [rightPos, screenToWorld]);

  const leftShoulder = useMemo(() => new THREE.Vector3(-0.35, 1.15, -0.1), []);
  const rightShoulder = useMemo(() => new THREE.Vector3(0.35, 1.15, -0.1), []);

  return (
    <group position={[0, -0.15, 0.35]}>
      {/* Torso — see-through silhouette */}
      <mesh position={[0, 0.75, 0.15]} castShadow>
        <boxGeometry args={[0.75, 1.0, 0.4]} />
        <meshStandardMaterial
          color="#E8C49A"
          transparent
          opacity={bodyOpacity}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.75, 0.15]}>
        <boxGeometry args={[0.77, 1.02, 0.42]} />
        <meshBasicMaterial color="#FFD9A0" wireframe transparent opacity={0.55} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.45, 0.1]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#E8C49A" transparent opacity={bodyOpacity} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1.45, 0.1]}>
        <sphereGeometry args={[0.23, 12, 12]} />
        <meshBasicMaterial color="#FFE4B8" wireframe transparent opacity={0.5} />
      </mesh>
      {/* Abdomen */}
      <mesh position={[0, 0.35, 0.12]}>
        <boxGeometry args={[0.65, 0.5, 0.35]} />
        <meshStandardMaterial color="#B8895A" transparent opacity={bodyOpacity} depthWrite={false} />
      </mesh>

      <Arm from={leftShoulder} to={leftWorld} opacity={bodyOpacity + 0.05} />
      <Arm from={rightShoulder} to={rightWorld} opacity={bodyOpacity + 0.05} />

      {/* Solid 3D gloves — hidden behind screen gloves but visible at bag depth */}
      <Glove position={leftWorld} />
      <Glove position={rightWorld} />
    </group>
  );
}
