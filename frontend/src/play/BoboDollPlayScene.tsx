import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { GlovePosition } from '../types/game';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { boboZoneScreenOffset } from './boboImpact';
import { applyBoboHitImpulse, createBoboSwingState, stepBoboSwing } from './boboSwing';
import { BoboClownFaceDecal } from './face/BoboClownFaceDecal';
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
      <meshBasicMaterial color="#ffffff" transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function BoboDollBody({ material }: { material: THREE.MeshStandardMaterial }) {
  return (
    <group>
      {/* Weighted round base — pivot point is floor centre (0,0,0) */}
      <mesh position={[0, 0.52, 0]} castShadow receiveShadow material={material}>
        <sphereGeometry args={[0.52, 36, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      </mesh>
      {/* Tapered torso — full height to match heavy bag */}
      <mesh position={[0, 1.35, 0]} castShadow receiveShadow material={material}>
        <cylinderGeometry args={[0.4, 0.52, 1.45, 36]} />
      </mesh>
      {/* Round head */}
      <mesh position={[0, 2.28, 0]} castShadow receiveShadow material={material}>
        <sphereGeometry args={[0.44, 36, 36]} />
      </mesh>
      {/* Neck collar ring */}
      <mesh position={[0, 1.88, 0]} material={material}>
        <torusGeometry args={[0.28, 0.06, 12, 28]} />
      </mesh>
    </group>
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
  const [lastHitTime, setLastHitTime] = useState(0);
  const lastImpactIdRef = useRef(0);
  const { camera } = useThree();

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.14,
        metalness: 0.12,
        envMapIntensity: 1.2,
      }),
    []
  );

  useEffect(() => {
    if (!impacts.length) return;
    const latest = impacts[impacts.length - 1];
    if (latest.id <= lastImpactIdRef.current) return;
    lastImpactIdRef.current = latest.id;

    applyBoboHitImpulse(swingRef.current, latest.glove);
    setLastHitTime(latest.time);
    setFlashes((prev) => [
      ...prev,
      { id: latest.id, pos: [0, 1.35, 0.46], time: latest.time },
    ]);
  }, [impacts]);

  useFrame((_, delta) => {
    stepBoboSwing(swingRef.current, delta);
    const { tiltX, tiltZ } = swingRef.current;
    if (dollRef.current) {
      dollRef.current.rotation.x = tiltX;
      dollRef.current.rotation.z = tiltZ;
    }
    const zoneOffset = boboZoneScreenOffset(tiltX, tiltZ, camera);
    boboZoneOffsetRef.current.x = zoneOffset.x;
    boboZoneOffsetRef.current.y = zoneOffset.y;
  });

  return (
    <group position={[0, 0, -3.8]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[0.62, 32]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
      </mesh>

      <group ref={dollRef}>
        <BoboDollBody material={material} />
        <BoboClownFaceDecal lastHitTime={lastHitTime} />
        {flashes.map((flash) => (
          <ImpactFlash
            key={flash.id}
            position={flash.pos}
            startTime={flash.time}
            onDone={() => setFlashes((prev) => prev.filter((f) => f.id !== flash.id))}
          />
        ))}
      </group>
      <pointLight position={[1.2, 2.2, 1.5]} intensity={18} color="#ffffff" distance={6} />
      <pointLight position={[-1, 1.5, 2]} intensity={8} color="#e8f0ff" distance={5} />
    </group>
  );
}

interface BoboDollPlaySceneProps {
  impacts: PunchImpact[];
  boboZoneOffsetRef: RefObject<GlovePosition>;
}

export function BoboDollPlayScene({
  impacts,
  boboZoneOffsetRef,
}: BoboDollPlaySceneProps) {
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
