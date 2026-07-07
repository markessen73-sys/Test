import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { SparringPartner } from './SparringPartner';

interface BoxingRingProps {
  highlighted: boolean;
}

export function BoxingRing({ highlighted }: BoxingRingProps) {
  const partnerRef = useRef<Group>(null);

  useFrame(() => {
    if (!partnerRef.current || !highlighted) return;
    partnerRef.current.position.x = Math.sin(Date.now() * 0.0015) * 0.05;
  });

  const rope = '#CC0000';
  const post = '#F0EAD6';

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
        <SparringPartner dimmed={!highlighted} />
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
