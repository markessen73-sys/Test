import { useEffect, useRef, useState, type RefObject } from 'react';
import type { GlovePosition } from '../types/game';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CartoonFace } from '../gym/CartoonFace';
import { boboZoneScreenOffset } from './boboImpact';
import { applyBoboHitImpulse, createBoboSwingState, stepBoboSwing } from './boboSwing';
import { BOBO_PLAY_CAMERA } from './playCamera';
import { PlayEnvironment } from './PlayEnvironment';
import type { PunchImpact } from './punchImpact';

function ImpactFlash({
  position,
  startTime,
  onDone,
}: {
  position: [number, number, number];
  startTime: number;
  onDone: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const doneRef = useRef(false);

  useFrame(() => {
    const age = (performance.now() - startTime) / 420;
    if (!meshRef.current) return;
    meshRef.current.scale.setScalar(0.5 + age * 1.8);
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, 0.85 * (1 - age));
    if (age >= 1 && !doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <ringGeometry args={[0.08, 0.12, 24]} />
      <meshBasicMaterial color="#fff0d4" transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function PlayBoboDoll({
  impacts,
  boboZoneOffsetRef,
}: {
  impacts: PunchImpact[];
  boboZoneOffsetRef: RefObject<GlovePosition>;
}) {
  const swingRef = useRef(createBoboSwingState());
  const dollRef = useRef<THREE.Group>(null);
  const [flashes, setFlashes] = useState<{ id: number; pos: [number, number, number]; time: number }[]>([]);
  const lastImpactIdRef = useRef(0);
  const { camera } = useThree();

  useEffect(() => {
    if (!impacts.length) return;
    const latest = impacts[impacts.length - 1];
    if (latest.id <= lastImpactIdRef.current) return;
    lastImpactIdRef.current = latest.id;

    applyBoboHitImpulse(swingRef.current, latest.glove);
    setFlashes((prev) => [
      ...prev,
      { id: latest.id, pos: [0, 1.35, 0.42], time: latest.time },
    ]);
  }, [impacts]);

  useFrame((_, delta) => {
    stepBoboSwing(swingRef.current, delta);
    if (dollRef.current) {
      dollRef.current.rotation.z = swingRef.current.angle;
    }
    const zoneOffset = boboZoneScreenOffset(swingRef.current.angle, camera);
    boboZoneOffsetRef.current.x = zoneOffset.x;
    boboZoneOffsetRef.current.y = zoneOffset.y;
  });

  return (
    <group position={[0, 0, -3.8]}>
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.62, 0.12, 24]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>

      <group ref={dollRef} position={[0, 0.12, 0]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.44, 1.1, 16]} />
          <meshStandardMaterial color="#D42020" roughness={0.5} />
        </mesh>
        <group position={[0, 1.25, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.4, 24, 24]} />
            <meshStandardMaterial color="#D42020" roughness={0.5} />
          </mesh>
          <CartoonFace scale={0.85} />
        </group>
        {flashes.map((flash) => (
          <ImpactFlash
            key={flash.id}
            position={flash.pos}
            startTime={flash.time}
            onDone={() => setFlashes((prev) => prev.filter((f) => f.id !== flash.id))}
          />
        ))}
      </group>
    </group>
  );
}

interface BoboDollPlaySceneProps {
  impacts: PunchImpact[];
  boboZoneOffsetRef: RefObject<GlovePosition>;
}

export function BoboDollPlayScene({ impacts, boboZoneOffsetRef }: BoboDollPlaySceneProps) {
  const cam = BOBO_PLAY_CAMERA;
  return (
    <Canvas
      shadows
      camera={{ position: cam.position, fov: cam.fov, near: 0.1, far: 30 }}
      onCreated={({ camera }) => {
        camera.lookAt(...cam.lookAt);
      }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={['#1a1208']} />
      <PlayEnvironment />
      <PlayBoboDoll impacts={impacts} boboZoneOffsetRef={boboZoneOffsetRef} />
    </Canvas>
  );
}
