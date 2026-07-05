import { useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { FaceMesh } from './FaceMesh';
import type { PunchType } from '../types/game';

interface EquipmentProps {
  caricatureUrl: string;
  onPunch: (type: PunchType) => void;
  lastPunch: PunchType | null;
  combo: number;
  active: boolean;
  position: [number, number, number];
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

const inactiveOpacity = 0.45;

export function Speedball({
  caricatureUrl,
  onPunch,
  lastPunch,
  combo,
  active,
  position,
}: EquipmentProps) {
  const ballRef = useRef<THREE.Group>(null);
  const [swing, setSwing] = useState(0);
  const center = new THREE.Vector3(position[0], position[1] + 1.6, position[2]);

  useFrame((_, delta) => {
    if (ballRef.current) {
      const base = active ? Math.sin(Date.now() * 0.004) * 0.12 : 0;
      const hit = swing > 0 ? Math.sin(swing) * 0.9 : 0;
      ballRef.current.position.x = position[0] + base + hit;
      ballRef.current.rotation.z = (base + hit) * 2;
      if (swing > 0) setSwing((s) => Math.max(0, s - delta * 4));
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return;
    e.stopPropagation();
    onPunch(detectPunchType(e.point, center));
    setSwing(Math.PI);
  };

  return (
    <group position={position}>
      {/* Wall board mount */}
      <mesh position={[0, 2.5, -0.3]}>
        <boxGeometry args={[0.8, 0.12, 0.15]} />
        <meshStandardMaterial color="#4A3728" />
      </mesh>
      <mesh position={[0, 2.1, -0.2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.7, 6]} />
        <meshStandardMaterial color="#666" metalness={0.5} />
      </mesh>
      <group ref={ballRef} position={[0, 1.6, 0]}>
        <mesh onClick={handleClick}>
          <sphereGeometry args={[0.26, 20, 20]} />
          <meshStandardMaterial
            color="#CC2222"
            roughness={0.5}
            transparent={!active}
            opacity={active ? 1 : inactiveOpacity}
          />
        </mesh>
        {active && (
          <FaceMesh
            caricatureUrl={caricatureUrl}
            punchType={lastPunch}
            combo={combo}
            radius={0.2}
            position={[0, 0, 0.24]}
          />
        )}
      </group>
      {/* Highlight ring when active */}
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.6, 0.75, 32]} />
          <meshBasicMaterial color="#FFD700" transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  );
}

export function HeavyBag({
  caricatureUrl,
  onPunch,
  lastPunch,
  combo,
  active,
  position,
}: EquipmentProps) {
  const bagRef = useRef<THREE.Group>(null);
  const [swing, setSwing] = useState(0);
  const center = new THREE.Vector3(position[0], position[1] + 1.2, position[2]);

  useFrame((_, delta) => {
    if (bagRef.current) {
      const hit = swing > 0 ? Math.sin(swing) * 0.4 : 0;
      bagRef.current.rotation.z = hit;
      bagRef.current.position.x = position[0] + hit * 0.35;
      if (swing > 0) setSwing((s) => Math.max(0, s - delta * 2.5));
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return;
    e.stopPropagation();
    onPunch(detectPunchType(e.point, center));
    setSwing(Math.PI);
  };

  return (
    <group position={position}>
      <mesh position={[0, 3.2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
        <meshStandardMaterial color="#555" metalness={0.6} />
      </mesh>
      <group ref={bagRef} position={[0, 1.2, 0]}>
        <mesh onClick={handleClick}>
          <cylinderGeometry args={[0.32, 0.38, 1.7, 16]} />
          <meshStandardMaterial
            color="#1C1C28"
            roughness={0.85}
            transparent={!active}
            opacity={active ? 1 : inactiveOpacity}
          />
        </mesh>
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.33, 0.33, 0.1, 16]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        {active && (
          <FaceMesh
            caricatureUrl={caricatureUrl}
            punchType={lastPunch}
            combo={combo}
            radius={0.28}
            position={[0, 0.25, 0.36]}
          />
        )}
      </group>
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.7, 0.9, 32]} />
          <meshBasicMaterial color="#FFD700" transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  );
}

export function BoboDoll({
  caricatureUrl,
  onPunch,
  lastPunch,
  combo,
  active,
  position,
}: EquipmentProps) {
  const dollRef = useRef<THREE.Group>(null);
  const [wobble, setWobble] = useState(0);
  const center = new THREE.Vector3(position[0], position[1] + 1.15, position[2]);

  useFrame((_, delta) => {
    if (dollRef.current) {
      const hit = wobble > 0 ? Math.sin(wobble * 3) * 0.45 * (wobble / Math.PI) : 0;
      dollRef.current.rotation.z = hit;
      if (wobble > 0) setWobble((w) => Math.max(0, w - delta * 2));
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return;
    e.stopPropagation();
    onPunch(detectPunchType(e.point, center));
    setWobble(Math.PI);
  };

  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.42, 0.52, 0.1, 20]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      <group ref={dollRef} position={[0, 0.1, 0]}>
        <mesh onClick={handleClick} position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.3, 0.4, 1.0, 16]} />
          <meshStandardMaterial
            color="#CC2222"
            roughness={0.5}
            transparent={!active}
            opacity={active ? 1 : inactiveOpacity}
          />
        </mesh>
        <group position={[0, 1.15, 0]}>
          <mesh onClick={handleClick}>
            <sphereGeometry args={[0.36, 20, 20]} />
            <meshStandardMaterial
              color="#CC2222"
              roughness={0.5}
              transparent={!active}
              opacity={active ? 1 : inactiveOpacity}
            />
          </mesh>
          {active && (
            <FaceMesh
              caricatureUrl={caricatureUrl}
              punchType={lastPunch}
              combo={combo}
              radius={0.3}
              position={[0, 0, 0.34]}
            />
          )}
        </group>
      </group>
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.75, 0.95, 32]} />
          <meshBasicMaterial color="#FFD700" transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  );
}
