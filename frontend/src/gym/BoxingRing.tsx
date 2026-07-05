import { useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { FaceMesh } from './FaceMesh';
import type { PunchType } from '../types/game';

interface BoxingRingProps {
  caricatureUrl: string;
  onPunch: (type: PunchType) => void;
  lastPunch: PunchType | null;
  combo: number;
  active: boolean;
}

function detectPunch(point: THREE.Vector3, center: THREE.Vector3): PunchType {
  const dy = point.y - center.y;
  const dx = point.x - center.x;
  if (dy > 0.35) return 'uppercut';
  if (dy < -0.15) return 'body';
  if (Math.abs(dx) > 0.2) return 'hook';
  if (dx > 0) return 'cross';
  return 'jab';
}

export function BoxingRing({ caricatureUrl, onPunch, lastPunch, combo, active }: BoxingRingProps) {
  const partnerRef = useRef<THREE.Group>(null);
  const hitRef = useRef(0);

  useFrame((_, delta) => {
    if (partnerRef.current && hitRef.current > 0) {
      partnerRef.current.rotation.z = Math.sin(hitRef.current * 4) * 0.15 * (hitRef.current / Math.PI);
      partnerRef.current.position.x = Math.sin(hitRef.current * 3) * 0.1 * (hitRef.current / Math.PI);
      hitRef.current = Math.max(0, hitRef.current - delta * 3);
    }
  });

  const handlePunch = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return;
    e.stopPropagation();
    onPunch(detectPunch(e.point, new THREE.Vector3(0, 1.35, 0)));
    hitRef.current = Math.PI;
  };

  const ropeColor = '#CC0000';
  const postColor = '#F5F5DC';
  const matColor = '#4A5568';

  return (
    <group position={[0, 0, 0]}>
      {/* Ring platform */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[4.8, 0.24, 4.8]} />
        <meshStandardMaterial color="#3D3428" roughness={0.9} />
      </mesh>
      {/* Canvas */}
      <mesh position={[0, 0.26, 0]} receiveShadow>
        <boxGeometry args={[4.4, 0.04, 4.4]} />
        <meshStandardMaterial color={matColor} roughness={0.95} />
      </mesh>

      {/* Corner posts */}
      {[
        [-2.1, -2.1],
        [2.1, -2.1],
        [-2.1, 2.1],
        [2.1, 2.1],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.07, 0.09, 1.4, 8]} />
            <meshStandardMaterial color={postColor} roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.45, 0]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color={postColor} />
          </mesh>
        </group>
      ))}

      {/* Ropes — 4 sides × 3 levels */}
      {[0.55, 0.95, 1.35].map((y, li) => (
        <group key={li}>
          {/* Front/back */}
          {[-2.1, 2.1].map((z) => (
            <mesh key={`z${z}`} position={[0, y, z]}>
              <boxGeometry args={[4.2, 0.05, 0.05]} />
              <meshStandardMaterial color={li === 1 ? ropeColor : '#AA0000'} roughness={0.5} />
            </mesh>
          ))}
          {/* Left/right */}
          {[-2.1, 2.1].map((x) => (
            <mesh key={`x${x}`} position={[x, y, 0]}>
              <boxGeometry args={[0.05, 0.05, 4.2]} />
              <meshStandardMaterial color={li === 1 ? ropeColor : '#AA0000'} roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Sparring partner — cartoon boxer dummy */}
      <group ref={partnerRef} position={[0, 0.26, 0]}>
        {/* Shorts */}
        <mesh position={[0, 0.55, 0]} onClick={handlePunch}>
          <boxGeometry args={[0.55, 0.35, 0.35]} />
          <meshStandardMaterial color="#1a1a8b" roughness={0.7} />
        </mesh>
        {/* Torso */}
        <mesh position={[0, 0.95, 0]} onClick={handlePunch}>
          <boxGeometry args={[0.65, 0.7, 0.38]} />
          <meshStandardMaterial color="#8B7355" roughness={0.8} />
        </mesh>
        {/* Gloves */}
        {[-0.45, 0.45].map((x) => (
          <mesh key={x} position={[x, 1.05, 0.15]} onClick={handlePunch}>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshStandardMaterial color="#8B0000" roughness={0.6} />
          </mesh>
        ))}
        {/* Head */}
        <group position={[0, 1.45, 0]}>
          <mesh onClick={handlePunch}>
            <sphereGeometry args={[0.32, 20, 20]} />
            <meshStandardMaterial color="#8B7355" roughness={0.7} />
          </mesh>
          <FaceMesh
            caricatureUrl={caricatureUrl}
            punchType={lastPunch}
            combo={combo}
            radius={0.28}
            position={[0, 0, 0.3]}
          />
        </group>
      </group>

      {/* Corner stool */}
      <group position={[-2.3, 0.26, 2.3]}>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.2, 0.22, 0.5, 8]} />
          <meshStandardMaterial color="#8B0000" />
        </mesh>
      </group>
    </group>
  );
}
