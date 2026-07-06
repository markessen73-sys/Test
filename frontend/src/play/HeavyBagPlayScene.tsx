import { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { createNutBrownLeatherTexture } from './leatherTexture';

const BAG_Z = -3.8;

const LEATHER_MAT = {
  color: '#8B5A2B',
  roughness: 0.84,
  metalness: 0.02,
} as const;

function PlayHeavyBag() {
  const leatherMap = useMemo(() => createNutBrownLeatherTexture(), []);

  useEffect(() => () => leatherMap.dispose(), [leatherMap]);

  return (
    <group position={[0, 0, BAG_Z]}>
      <mesh position={[0, 3.2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
        <meshStandardMaterial color="#444" metalness={0.5} />
      </mesh>
      <group position={[0, 1.35, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.42, 0.48, 2.1, 24]} />
          <meshStandardMaterial map={leatherMap} {...LEATHER_MAT} />
        </mesh>
        <mesh position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.43, 0.43, 0.14, 24]} />
          <meshStandardMaterial map={leatherMap} color="#6B4423" roughness={0.9} metalness={0.01} />
        </mesh>
        <mesh position={[0, -1.08, 0]}>
          <cylinderGeometry args={[0.38, 0.32, 0.16, 24]} />
          <meshStandardMaterial map={leatherMap} color="#4A2F18" roughness={0.92} metalness={0.01} />
        </mesh>
      </group>
    </group>
  );
}

function PlayEnvironment() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#8B6914" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3, -6]} receiveShadow>
        <planeGeometry args={[12, 7]} />
        <meshStandardMaterial color="#9B4E32" roughness={1} />
      </mesh>
      <ambientLight intensity={0.45} color="#FFE4B5" />
      <directionalLight position={[2, 6, 2]} intensity={1} color="#FFD699" castShadow />
      <pointLight position={[0, 4, 0]} intensity={8} color="#FFE4B5" distance={10} />
      <fog attach="fog" args={['#1a1208', 4, 14]} />
    </>
  );
}

function PlayScene() {
  return (
    <>
      <PlayEnvironment />
      <PlayHeavyBag />
    </>
  );
}

export function HeavyBagPlayScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 1.38, 0.45], fov: 52, near: 0.1, far: 30 }}
      onCreated={({ camera }) => {
        camera.lookAt(0, 1.3, BAG_Z);
      }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={['#1a1208']} />
      <PlayScene />
    </Canvas>
  );
}
