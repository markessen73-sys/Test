import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFaceTexture } from './useFaceTexture';
import type { PunchType } from '../types/game';

interface FaceMeshProps {
  caricatureUrl: string;
  punchType: PunchType | null;
  combo: number;
  radius?: number;
  position?: [number, number, number];
}

export function FaceMesh({
  caricatureUrl,
  punchType,
  combo,
  radius = 0.35,
  position = [0, 0, 0],
}: FaceMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useFaceTexture({ caricatureUrl, punchType, combo });

  useFrame(() => {
    if (!meshRef.current) return;
    const bounce = punchType ? 1 + Math.sin(Date.now() * 0.02) * 0.03 : 0;
    meshRef.current.scale.setScalar(1 + bounce);
  });

  if (!texture) return null;

  return (
    <mesh ref={meshRef} position={position}>
      <circleGeometry args={[radius, 32]} />
      <meshStandardMaterial map={texture} transparent side={THREE.DoubleSide} />
    </mesh>
  );
}
