import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CartoonFace } from './CartoonFace';

interface BoxingRingProps {
  highlighted: boolean;
}

export function BoxingRing({ highlighted }: BoxingRingProps) {
  const partnerRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!partnerRef.current || !highlighted) return;
    partnerRef.current.position.x = Math.sin(Date.now() * 0.0015) * 0.05;
  });

  const rope = '#CC0000';
  const post = '#F0EAD6';
  const dim = 0.35;

  return (
    <group>
      <mesh position={[0, 0.1, 0]} receiveShadow castShadow>
        <boxGeometry args={[5.2, 0.2, 5.2]} />
        <meshStandardMaterial color="#3D3428" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.22, 0]} receiveShadow>
        <boxGeometry args={[4.6, 0.04, 4.6]} />
        <meshStandardMaterial color="#4A5568" roughness={0.95} />
      </mesh>

      {([-2.2, 2.2] as const).flatMap((x) =>
        ([-2.2, 2.2] as const).map((z) => (
          <group key={`${x}-${z}`} position={[x, 0.22, z]}>
            <mesh position={[0, 0.75, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.1, 1.5, 8]} />
              <meshStandardMaterial color={post} roughness={0.5} />
            </mesh>
            <mesh position={[0, 1.55, 0]}>
              <sphereGeometry args={[0.11, 10, 10]} />
              <meshStandardMaterial color={post} />
            </mesh>
          </group>
        ))
      )}

      {[0.5, 0.95, 1.4].map((y, li) => (
        <group key={li} position={[0, y, 0]}>
          <mesh position={[0, 0, 2.2]}>
            <boxGeometry args={[4.4, 0.055, 0.055]} />
            <meshStandardMaterial color={li === 1 ? rope : '#990000'} />
          </mesh>
          <mesh position={[0, 0, -2.2]}>
            <boxGeometry args={[4.4, 0.055, 0.055]} />
            <meshStandardMaterial color={li === 1 ? rope : '#990000'} />
          </mesh>
          <mesh position={[2.2, 0, 0]}>
            <boxGeometry args={[0.055, 0.055, 4.4]} />
            <meshStandardMaterial color={li === 1 ? rope : '#990000'} />
          </mesh>
          <mesh position={[-2.2, 0, 0]}>
            <boxGeometry args={[0.055, 0.055, 4.4]} />
            <meshStandardMaterial color={li === 1 ? rope : '#990000'} />
          </mesh>
        </group>
      ))}

      <group ref={partnerRef} position={[0, 0.22, 0]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.6, 0.4, 0.38]} />
          <meshStandardMaterial color="#1a1a8b" transparent={!highlighted} opacity={highlighted ? 1 : dim} />
        </mesh>
        <mesh position={[0, 1.0, 0]} castShadow>
          <boxGeometry args={[0.7, 0.75, 0.4]} />
          <meshStandardMaterial color="#C49A6C" transparent={!highlighted} opacity={highlighted ? 1 : dim} />
        </mesh>
        {[-0.48, 0.48].map((x) => (
          <mesh key={x} position={[x, 1.05, 0.18]}>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial color="#8B0000" />
          </mesh>
        ))}
        <group position={[0, 1.55, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.34, 20, 20]} />
            <meshStandardMaterial color="#C49A6C" transparent={!highlighted} opacity={highlighted ? 1 : dim} />
          </mesh>
          {highlighted && <CartoonFace scale={0.9} />}
        </group>
      </group>

      {highlighted && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[2.5, 2.8, 48]} />
          <meshBasicMaterial color="#E8C840" transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}
