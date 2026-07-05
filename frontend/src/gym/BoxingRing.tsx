import { useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CartoonFace } from './CartoonFace';

interface BoxingRingProps {
  onHit: () => void;
  active: boolean;
}

export function BoxingRing({ onHit, active }: BoxingRingProps) {
  const partnerRef = useRef<THREE.Group>(null);
  const [hitAnim, setHitAnim] = useState(0);

  useFrame((_, delta) => {
    if (partnerRef.current && hitAnim > 0) {
      partnerRef.current.rotation.z = Math.sin(hitAnim * 5) * 0.2 * (hitAnim / Math.PI);
      partnerRef.current.position.x = Math.sin(hitAnim * 4) * 0.15 * (hitAnim / Math.PI);
      setHitAnim((h) => Math.max(0, h - delta * 3));
    }
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return;
    e.stopPropagation();
    onHit();
    setHitAnim(Math.PI);
  };

  const rope = '#CC0000';
  const post = '#F0EAD6';
  const dim = 0.45;

  return (
    <group>
      {/* Ring platform */}
      <mesh position={[0, 0.1, 0]} receiveShadow castShadow>
        <boxGeometry args={[5.2, 0.2, 5.2]} />
        <meshStandardMaterial color="#3D3428" roughness={0.9} />
      </mesh>
      {/* Canvas mat */}
      <mesh position={[0, 0.22, 0]} receiveShadow>
        <boxGeometry args={[4.6, 0.04, 4.6]} />
        <meshStandardMaterial color="#4A5568" roughness={0.95} />
      </mesh>
      {/* Mat border tape */}
      {[[0, 2.28], [0, -2.28], [2.28, 0], [-2.28, 0]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.24, z]}>
          <boxGeometry args={[x === 0 ? 4.6 : 0.06, 0.02, z === 0 ? 4.6 : 0.06]} />
          <meshStandardMaterial color="#FFF" />
        </mesh>
      ))}

      {/* Corner posts */}
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

      {/* Ropes — full rectangle, 4 sides × 3 levels */}
      {[0.5, 0.95, 1.4].map((y, li) => (
        <group key={li} position={[0, y, 0]}>
          <mesh position={[0, 0, 2.2]}>
            <boxGeometry args={[4.4, 0.055, 0.055]} />
            <meshStandardMaterial color={li === 1 ? rope : '#990000'} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, -2.2]}>
            <boxGeometry args={[4.4, 0.055, 0.055]} />
            <meshStandardMaterial color={li === 1 ? rope : '#990000'} roughness={0.4} />
          </mesh>
          <mesh position={[2.2, 0, 0]}>
            <boxGeometry args={[0.055, 0.055, 4.4]} />
            <meshStandardMaterial color={li === 1 ? rope : '#990000'} roughness={0.4} />
          </mesh>
          <mesh position={[-2.2, 0, 0]}>
            <boxGeometry args={[0.055, 0.055, 4.4]} />
            <meshStandardMaterial color={li === 1 ? rope : '#990000'} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Corner pads */}
      {([-2.15, 2.15] as const).flatMap((x) =>
        ([-2.15, 2.15] as const).map((z) => (
          <mesh key={`pad-${x}-${z}`} position={[x, 0.7, z]}>
            <boxGeometry args={[0.15, 0.9, 0.15]} />
            <meshStandardMaterial color="#1a1a8b" />
          </mesh>
        ))
      )}

      {/* Sparring partner */}
      <group ref={partnerRef} position={[0, 0.22, 0]}>
        <mesh position={[0, 0.5, 0]} onClick={click} castShadow>
          <boxGeometry args={[0.6, 0.4, 0.38]} />
          <meshStandardMaterial color="#1a1a8b" transparent={!active} opacity={active ? 1 : dim} />
        </mesh>
        <mesh position={[0, 1.0, 0]} onClick={click} castShadow>
          <boxGeometry args={[0.7, 0.75, 0.4]} />
          <meshStandardMaterial color="#C49A6C" transparent={!active} opacity={active ? 1 : dim} />
        </mesh>
        {[-0.48, 0.48].map((x) => (
          <mesh key={x} position={[x, 1.05, 0.18]} onClick={click}>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial color="#8B0000" />
          </mesh>
        ))}
        <group position={[0, 1.55, 0]}>
          <mesh onClick={click} castShadow>
            <sphereGeometry args={[0.34, 20, 20]} />
            <meshStandardMaterial color="#C49A6C" transparent={!active} opacity={active ? 1 : dim} />
          </mesh>
          {active && <CartoonFace scale={0.9} />}
        </group>
      </group>

      {/* Corner stool */}
      <group position={[-2.35, 0.22, 2.35]}>
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.22, 0.24, 0.55, 10]} />
          <meshStandardMaterial color="#8B0000" />
        </mesh>
      </group>

      {/* Stairs into ring */}
      <group position={[0, 0, 2.8]}>
        {[0, 1].map((i) => (
          <mesh key={i} position={[0, 0.06 + i * 0.1, i * 0.15]}>
            <boxGeometry args={[1.2, 0.1, 0.3]} />
            <meshStandardMaterial color="#5C4033" />
          </mesh>
        ))}
      </group>

      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[2.5, 2.8, 48]} />
          <meshBasicMaterial color="#E8C840" transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}
