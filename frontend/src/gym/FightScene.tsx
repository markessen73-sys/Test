import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, ContactShadows } from '@react-three/drei';
import { BoboDoll, HeavyBag, Speedball } from './Equipment';
import type { EquipmentType, PunchType } from '../types/game';

interface FightSceneProps {
  equipment: EquipmentType;
  caricatureUrl: string;
  onPunch: (type: PunchType) => void;
  lastPunch: PunchType | null;
  combo: number;
}

function GymRoom() {
  return (
    <>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#1a1520" roughness={0.9} />
      </mesh>
      {/* Floor mat */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[2.5, 32]} />
        <meshStandardMaterial color="#2d1f3d" roughness={0.8} />
      </mesh>
      {/* Ring ropes (simplified) */}
      {[0.6, 1.0, 1.4].map((y) => (
        <mesh key={y} position={[0, y, -2.2]}>
          <torusGeometry args={[2.3, 0.03, 8, 32, Math.PI]} />
          <meshStandardMaterial color="#7c3aed" />
        </mesh>
      ))}
      {/* Back wall */}
      <mesh position={[0, 2, -3]}>
        <planeGeometry args={[10, 5]} />
        <meshStandardMaterial color="#12101a" />
      </mesh>
      {/* Gym sign */}
      <mesh position={[0, 3.5, -2.95]}>
        <planeGeometry args={[3, 0.6]} />
        <meshStandardMaterial color="#7c3aed" emissive="#4c1d95" emissiveIntensity={0.3} />
      </mesh>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <pointLight position={[-3, 4, 2]} intensity={0.5} color="#a78bfa" />
      <ContactShadows position={[0, 0.02, 0]} opacity={0.5} scale={8} blur={2} />
    </>
  );
}

function EquipmentScene({
  equipment,
  caricatureUrl,
  onPunch,
  lastPunch,
  combo,
}: FightSceneProps) {
  const props = { caricatureUrl, onPunch, lastPunch, combo };

  return (
    <group position={[0, 0, 0]}>
      {equipment === 'speedball' && <Speedball {...props} />}
      {equipment === 'heavy-bag' && <HeavyBag {...props} />}
      {equipment === 'bobo-doll' && <BoboDoll {...props} />}
    </group>
  );
}

export function FightScene(props: FightSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 1.8, 4.5], fov: 50 }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <Environment preset="warehouse" />
        <GymRoom />
        <EquipmentScene {...props} />
        <OrbitControls
          enablePan={false}
          minDistance={2.5}
          maxDistance={7}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 1.2, 0]}
        />
      </Suspense>
    </Canvas>
  );
}
