import { useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CartoonFace } from './CartoonFace';

interface HitProps {
  onHit: () => void;
  active: boolean;
  position?: [number, number, number];
}

const DIM = 0.4;

export function Speedball({ onHit, active, position = [0, 0, 0] }: HitProps) {
  const ballRef = useRef<THREE.Group>(null);
  const [swing, setSwing] = useState(0);

  useFrame((_, delta) => {
    if (!ballRef.current) return;
    const idle = active ? Math.sin(Date.now() * 0.004) * 0.1 : 0;
    const hit = swing > 0 ? Math.sin(swing) * 1.0 : 0;
    ballRef.current.position.x = idle + hit;
    ballRef.current.rotation.z = (idle + hit) * 2.5;
    if (swing > 0) setSwing((s) => Math.max(0, s - delta * 3.5));
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return;
    e.stopPropagation();
    onHit();
    setSwing(Math.PI);
  };

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
        <mesh onClick={click} castShadow>
          <sphereGeometry args={[0.3, 24, 24]} />
          <meshStandardMaterial color="#D42020" roughness={0.45} transparent={!active} opacity={active ? 1 : DIM} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[0.3, 0.04, 8, 24]} />
          <meshStandardMaterial color="#EEE" roughness={0.6} transparent={!active} opacity={active ? 1 : DIM} />
        </mesh>
      </group>

      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[0.65, 0.85, 32]} />
          <meshBasicMaterial color="#E8C840" transparent opacity={0.4} />
        </mesh>
      )}
    </group>
  );
}

export function HeavyBag({ onHit, active, position = [0, 0, 0] }: HitProps) {
  const bagRef = useRef<THREE.Group>(null);
  const [swing, setSwing] = useState(0);

  useFrame((_, delta) => {
    if (!bagRef.current) return;
    const hit = swing > 0 ? Math.sin(swing) * 0.45 : 0;
    bagRef.current.rotation.z = hit;
    bagRef.current.position.x = hit * 0.4;
    if (swing > 0) setSwing((s) => Math.max(0, s - delta * 2.2));
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return;
    e.stopPropagation();
    onHit();
    setSwing(Math.PI);
  };

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
      {[2.8, 2.5].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[0.08, 0.015, 6, 12]} />
          <meshStandardMaterial color="#888" metalness={0.7} />
        </mesh>
      ))}

      <group ref={bagRef} position={[0, 1.3, 0]}>
        <mesh onClick={click} castShadow>
          <cylinderGeometry args={[0.38, 0.44, 2.0, 20]} />
          <meshStandardMaterial color="#1a1a28" roughness={0.9} transparent={!active} opacity={active ? 1 : DIM} />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <cylinderGeometry args={[0.39, 0.39, 0.12, 20]} />
          <meshStandardMaterial color="#2a2a3a" />
        </mesh>
        <mesh position={[0, -1.05, 0]}>
          <cylinderGeometry args={[0.35, 0.3, 0.15, 20]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </group>

      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[0.75, 0.95, 32]} />
          <meshBasicMaterial color="#E8C840" transparent opacity={0.4} />
        </mesh>
      )}
    </group>
  );
}

export function BoboDoll({ onHit, active, position = [0, 0, 0] }: HitProps) {
  const dollRef = useRef<THREE.Group>(null);
  const [wobble, setWobble] = useState(0);

  useFrame((_, delta) => {
    if (!dollRef.current) return;
    const hit = wobble > 0 ? Math.sin(wobble * 3) * 0.5 * (wobble / Math.PI) : 0;
    dollRef.current.rotation.z = hit;
    if (wobble > 0) setWobble((w) => Math.max(0, w - delta * 1.8));
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return;
    e.stopPropagation();
    onHit();
    setWobble(Math.PI);
  };

  return (
    <group position={position}>
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.62, 0.12, 24]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>

      <group ref={dollRef} position={[0, 0.12, 0]}>
        <mesh onClick={click} position={[0, 0.6, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.44, 1.1, 16]} />
          <meshStandardMaterial color="#D42020" roughness={0.5} transparent={!active} opacity={active ? 1 : DIM} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.08, 16]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        <group position={[0, 1.25, 0]}>
          <mesh onClick={click} castShadow>
            <sphereGeometry args={[0.4, 24, 24]} />
            <meshStandardMaterial color="#D42020" roughness={0.5} transparent={!active} opacity={active ? 1 : DIM} />
          </mesh>
          {active && <CartoonFace scale={0.85} />}
        </group>
      </group>

      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[0.8, 1.0, 32]} />
          <meshBasicMaterial color="#E8C840" transparent opacity={0.4} />
        </mesh>
      )}
    </group>
  );
}
