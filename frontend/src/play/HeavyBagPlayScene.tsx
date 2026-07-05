import { useRef, useEffect, useCallback, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GhostBoxer } from './GhostBoxer';
import type { GlovePosition } from '../types/game';

const BAG_Z = -3.8;

function PlayHeavyBag({ punchImpulse }: { punchImpulse: number }) {
  const bagRef = useRef<THREE.Group>(null);
  const swingRef = useRef(0);
  const lastImpulseRef = useRef(0);

  useEffect(() => {
    if (punchImpulse > lastImpulseRef.current) {
      swingRef.current = Math.min((punchImpulse - lastImpulseRef.current) * 0.55, 1) * Math.PI;
      lastImpulseRef.current = punchImpulse;
    }
  }, [punchImpulse]);

  useFrame((_, delta) => {
    if (bagRef.current && swingRef.current > 0) {
      const hit = Math.sin(swingRef.current) * 0.5;
      bagRef.current.rotation.z = hit;
      bagRef.current.position.x = hit * 0.45;
      swingRef.current = Math.max(0, swingRef.current - delta * 2.5);
    }
  });

  return (
    <group position={[0, 0, BAG_Z]}>
      <mesh position={[0, 3.2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 6]} />
        <meshStandardMaterial color="#444" metalness={0.5} />
      </mesh>
      <group ref={bagRef} position={[0, 1.35, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.42, 0.48, 2.1, 24]} />
          <meshStandardMaterial color="#1a1a28" roughness={0.88} />
        </mesh>
        <mesh position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.43, 0.43, 0.14, 24]} />
          <meshStandardMaterial color="#252535" />
        </mesh>
        <mesh position={[0, -1.08, 0]}>
          <cylinderGeometry args={[0.38, 0.32, 0.16, 24]} />
          <meshStandardMaterial color="#111" />
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

function PlayScene({
  leftPos,
  rightPos,
  punchImpulse,
}: {
  leftPos: GlovePosition;
  rightPos: GlovePosition;
  punchImpulse: number;
}) {
  const { camera } = useThree();
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.6), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);

  const screenToWorld = useCallback(
    (pos: GlovePosition) => {
      ndc.set(pos.x * 2 - 1, -(pos.y * 2 - 1));
      raycaster.setFromCamera(ndc, camera);
      raycaster.ray.intersectPlane(plane, target);
      return target.clone();
    },
    [camera, ndc, plane, raycaster, target]
  );

  return (
    <>
      <PlayEnvironment />
      <PlayHeavyBag punchImpulse={punchImpulse} />
      <GhostBoxer leftPos={leftPos} rightPos={rightPos} screenToWorld={screenToWorld} />
    </>
  );
}

interface HeavyBagPlaySceneProps {
  leftPos: GlovePosition;
  rightPos: GlovePosition;
  punchImpulse: number;
}

export function HeavyBagPlayScene({ leftPos, rightPos, punchImpulse }: HeavyBagPlaySceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 1.45, 0.2], fov: 55, near: 0.1, far: 30 }}
      onCreated={({ camera }) => {
        camera.lookAt(0, 1.35, BAG_Z);
      }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={['#1a1208']} />
      <PlayScene leftPos={leftPos} rightPos={rightPos} punchImpulse={punchImpulse} />
    </Canvas>
  );
}
