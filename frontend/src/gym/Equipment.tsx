import { useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { FaceMesh } from './FaceMesh';
import type { PunchType } from '../types/game';

interface EquipmentProps {
  caricatureUrl: string;
  onPunch: (type: PunchType) => void;
  lastPunch: PunchType | null;
  combo: number;
}

function detectPunchType(point: THREE.Vector3, center: THREE.Vector3): PunchType {
  const dy = point.y - center.y;
  const dx = point.x - center.x;
  if (dy > 0.3) return 'uppercut';
  if (dy < -0.2) return 'body';
  if (Math.abs(dx) > 0.25) return 'hook';
  if (dx > 0) return 'cross';
  return 'jab';
}

export function Speedball({ caricatureUrl, onPunch, lastPunch, combo }: EquipmentProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ballRef = useRef<THREE.Mesh>(null);
  const [swing, setSwing] = useState(0);

  useFrame((_, delta) => {
    if (ballRef.current) {
      const base = Math.sin(Date.now() * 0.003) * 0.15;
      const hit = swing > 0 ? Math.sin(swing) * 0.8 : 0;
      ballRef.current.position.x = base + hit;
      ballRef.current.rotation.z = base * 2 + hit;
      if (swing > 0) setSwing((s) => Math.max(0, s - delta * 4));
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const point = e.point;
    onPunch(detectPunchType(point, new THREE.Vector3(0, 1.6, 0)));
    setSwing(Math.PI);
  };

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Mount */}
      <mesh position={[0, 2.4, 0]}>
        <boxGeometry args={[0.6, 0.1, 0.3]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      {/* Spring */}
      <mesh position={[0, 2.0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      {/* Ball */}
      <group ref={ballRef} position={[0, 1.6, 0]}>
        <mesh onClick={handleClick}>
          <sphereGeometry args={[0.28, 24, 24]} />
          <meshStandardMaterial color="#cc2222" roughness={0.6} />
        </mesh>
        <FaceMesh
          caricatureUrl={caricatureUrl}
          punchType={lastPunch}
          combo={combo}
          radius={0.22}
          position={[0, 0, 0.26]}
        />
      </group>
      <Text position={[0, 0.8, 0]} fontSize={0.12} color="#aaa" anchorX="center">
        Speedball
      </Text>
    </group>
  );
}

export function HeavyBag({ caricatureUrl, onPunch, lastPunch, combo }: EquipmentProps) {
  const bagRef = useRef<THREE.Group>(null);
  const [swing, setSwing] = useState(0);

  useFrame((_, delta) => {
    if (bagRef.current) {
      const hit = swing > 0 ? Math.sin(swing) * 0.35 : 0;
      bagRef.current.rotation.z = hit;
      bagRef.current.position.x = hit * 0.3;
      if (swing > 0) setSwing((s) => Math.max(0, s - delta * 2.5));
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const point = e.point;
    onPunch(detectPunchType(point, new THREE.Vector3(0, 1.2, 0)));
    setSwing(Math.PI);
  };

  return (
    <group position={[0, 0, 0]}>
      {/* Chain */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.5, 6]} />
        <meshStandardMaterial color="#666" />
      </mesh>
      <group ref={bagRef} position={[0, 1.2, 0]}>
        <mesh onClick={handleClick} position={[0, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.4, 1.8, 16]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
        </mesh>
        {/* Top cap */}
        <mesh position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.1, 16]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <FaceMesh
          caricatureUrl={caricatureUrl}
          punchType={lastPunch}
          combo={combo}
          radius={0.3}
          position={[0, 0.3, 0.38]}
        />
      </group>
      <Text position={[0, 0.1, 0]} fontSize={0.12} color="#aaa" anchorX="center">
        Heavy Bag
      </Text>
    </group>
  );
}

export function BoboDoll({ caricatureUrl, onPunch, lastPunch, combo }: EquipmentProps) {
  const dollRef = useRef<THREE.Group>(null);
  const [wobble, setWobble] = useState(0);

  useFrame((_, delta) => {
    if (dollRef.current) {
      const hit = wobble > 0 ? Math.sin(wobble * 3) * 0.4 * (wobble / Math.PI) : 0;
      dollRef.current.rotation.z = hit;
      if (wobble > 0) setWobble((w) => Math.max(0, w - delta * 2));
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const point = e.point;
    onPunch(detectPunchType(point, new THREE.Vector3(0, 1.1, 0)));
    setWobble(Math.PI);
  };

  return (
    <group position={[0, 0, 0]}>
      {/* Base */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.45, 0.55, 0.1, 24]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <group ref={dollRef} position={[0, 0.1, 0]}>
        {/* Body */}
        <mesh onClick={handleClick} position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.32, 0.42, 1.0, 16]} />
          <meshStandardMaterial color="#cc2222" roughness={0.5} />
        </mesh>
        {/* Head */}
        <group position={[0, 1.15, 0]}>
          <mesh onClick={handleClick}>
            <sphereGeometry args={[0.38, 24, 24]} />
            <meshStandardMaterial color="#cc2222" roughness={0.5} />
          </mesh>
          <FaceMesh
            caricatureUrl={caricatureUrl}
            punchType={lastPunch}
            combo={combo}
            radius={0.32}
            position={[0, 0, 0.35]}
          />
        </group>
      </group>
      <Text position={[0, -0.1, 0]} fontSize={0.12} color="#aaa" anchorX="center">
        Bobo Doll
      </Text>
    </group>
  );
}
