import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { getNutBrownLeatherMaps } from './leatherTexture';

const BAG_Z = -3.8;

function PlayHeavyBag() {
  const leather = useMemo(() => getNutBrownLeatherMaps(), []);

  return (
    <group position={[0, 0, BAG_Z]}>
      <mesh position={[0, 3.2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
        <meshStandardMaterial color="#444" metalness={0.5} />
      </mesh>
      <group position={[0, 1.35, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.42, 0.48, 2.1, 32]} />
          <meshStandardMaterial
            map={leather.map}
            roughnessMap={leather.roughnessMap}
            bumpMap={leather.bumpMap}
            bumpScale={0.035}
            color="#ffffff"
            roughness={0.88}
            metalness={0.02}
          />
        </mesh>
        <mesh position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.43, 0.43, 0.14, 32]} />
          <meshStandardMaterial
            map={leather.map}
            roughnessMap={leather.roughnessMap}
            bumpMap={leather.bumpMap}
            bumpScale={0.03}
            color="#d4b896"
            roughness={0.92}
            metalness={0.01}
          />
        </mesh>
        <mesh position={[0, -1.08, 0]}>
          <cylinderGeometry args={[0.38, 0.32, 0.16, 32]} />
          <meshStandardMaterial
            map={leather.map}
            roughnessMap={leather.roughnessMap}
            bumpMap={leather.bumpMap}
            bumpScale={0.03}
            color="#8a5c32"
            roughness={0.95}
            metalness={0.01}
          />
        </mesh>
      </group>
      <pointLight position={[0, 1.5, 0.6]} intensity={12} color="#ffdcb0" distance={5} />
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
      <ambientLight intensity={0.55} color="#FFE4B5" />
      <directionalLight position={[2, 6, 2]} intensity={1.2} color="#FFD699" castShadow />
      <pointLight position={[0, 4, 0]} intensity={10} color="#FFE4B5" distance={10} />
      <fog attach="fog" args={['#1a1208', 5, 16]} />
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
