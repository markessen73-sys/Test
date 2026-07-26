import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CartoonFace } from './CartoonFace';

interface EquipmentProps {
  highlighted: boolean;
  position?: [number, number, number];
}

const DIM = 0.35;

export function Speedball({ highlighted, position = [0, 0, 0] }: EquipmentProps) {
  const ballRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ballRef.current || !highlighted) return;
    const idle = Math.sin(Date.now() * 0.004) * 0.08;
    ballRef.current.position.x = idle;
    ballRef.current.rotation.z = idle * 2;
  });

  return (
    <group position={position}>
      <mesh position={[0, 2.6, -0.35]}>
        <boxGeometry args={[1.0, 0.14, 0.2]} />
        <meshStandardMaterial color="#4A3728" />
      </mesh>
      <mesh position={[0, 2.15, -0.25]}>
        <cylinderGeometry args={[0.03, 0.03, 0.8, 8]} />
        <meshStandardMaterial color="#777" metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[1.2, 0.08, 1.0]} />
        <meshStandardMaterial color="#5C4033" />
      </mesh>

      <group ref={ballRef} position={[0, 1.65, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.3, 24, 24]} />
          <meshStandardMaterial
            color="#D42020"
            roughness={0.45}
            transparent={!highlighted}
            opacity={highlighted ? 1 : DIM}
          />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[0.3, 0.04, 8, 24]} />
          <meshStandardMaterial color="#EEE" transparent={!highlighted} opacity={highlighted ? 1 : DIM} />
        </mesh>
      </group>

      {highlighted && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[0.65, 0.85, 32]} />
          <meshBasicMaterial color="#E8C840" transparent opacity={0.45} />
        </mesh>
      )}
    </group>
  );
}

export function HeavyBag({ highlighted, position = [0, 0, 0] }: EquipmentProps) {
  const bagRef = useRef<THREE.Group>(null);
  const [swing, setSwing] = useState(0);

  useFrame((_, delta) => {
    if (!bagRef.current) return;
    const idle = highlighted ? Math.sin(Date.now() * 0.002) * 0.03 : 0;
    const hit = swing > 0 ? Math.sin(swing) * 0.2 : 0;
    bagRef.current.rotation.z = idle + hit;
    if (swing > 0) setSwing((s) => Math.max(0, s - delta * 2));
  });

  return (
    <group position={position}>
      <mesh position={[0, 3.5, 0]}>
        <boxGeometry args={[0.5, 0.1, 0.5]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[0, 3.1, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.7, 6]} />
        <meshStandardMaterial color="#555" metalness={0.5} />
      </mesh>

      <group ref={bagRef} position={[0, 1.3, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.38, 0.44, 2.0, 20]} />
          <meshStandardMaterial
            color="#1a1a28"
            roughness={0.9}
            transparent={!highlighted}
            opacity={highlighted ? 1 : DIM}
          />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <cylinderGeometry args={[0.39, 0.39, 0.12, 20]} />
          <meshStandardMaterial color="#2a2a3a" />
        </mesh>
      </group>

      {highlighted && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[0.75, 0.95, 32]} />
          <meshBasicMaterial color="#E8C840" transparent opacity={0.45} />
        </mesh>
      )}
    </group>
  );
}

export function BoboDoll({ highlighted, position = [0, 0, 0] }: EquipmentProps) {
  const dollRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!dollRef.current || !highlighted) return;
    dollRef.current.rotation.z = Math.sin(Date.now() * 0.002) * 0.04;
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.62, 0.12, 24]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>

      <group ref={dollRef} position={[0, 0.12, 0]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.44, 1.1, 16]} />
          <meshStandardMaterial
            color="#D42020"
            roughness={0.5}
            transparent={!highlighted}
            opacity={highlighted ? 1 : DIM}
          />
        </mesh>
        <group position={[0, 1.25, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.4, 24, 24]} />
            <meshStandardMaterial
              color="#D42020"
              roughness={0.5}
              transparent={!highlighted}
              opacity={highlighted ? 1 : DIM}
            />
          </mesh>
          {highlighted && <CartoonFace scale={0.85} />}
        </group>
      </group>

      {highlighted && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[0.8, 1.0, 32]} />
          <meshBasicMaterial color="#E8C840" transparent opacity={0.45} />
        </mesh>
      )}
    </group>
  );
}
