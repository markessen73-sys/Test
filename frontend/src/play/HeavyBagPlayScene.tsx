import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { GlovePosition } from '../types/game';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getNutBrownLeatherMaps } from './leatherTexture';
import {
  applyBagDents,
  bagZoneScreenOffset,
  raycastBagBodyHit,
  type BagDent,
  type BagPunchImpact,
} from './bagImpact';
import {
  applyBagHitImpulse,
  BAG_HANG_OFFSET_Y,
  BAG_PIVOT_Y,
  createBagSwingState,
  stepBagSwing,
} from './bagSwing';

export const BAG_WORLD_Z = -3.8;
const BAG_Z = BAG_WORLD_Z;
const DENT_DECAY = 2.4;
const DENT_ADD_DEPTH = 0.11;
const DENT_RADIUS = 0.28;

function ImpactRing3D({
  point,
  normal,
  startTime,
  onDone,
}: {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  startTime: number;
  onDone: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const doneRef = useRef(false);
  const quat = useMemo(() => {
    const q = new THREE.Quaternion();
    const n = normal.clone().normalize();
    if (n.lengthSq() < 1e-6) n.set(0, 0, 1);
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    return q;
  }, [normal]);

  useFrame(() => {
    const age = (performance.now() - startTime) / 520;
    if (!meshRef.current || !matRef.current) return;
    const scale = 0.45 + age * 2.4;
    meshRef.current.scale.setScalar(scale);
    matRef.current.opacity = Math.max(0, 0.9 * (1 - age));
    if (age >= 1 && !doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  });

  return (
    <mesh ref={meshRef} position={point} quaternion={quat}>
      <ringGeometry args={[0.05, 0.075, 28]} />
      <meshBasicMaterial
        ref={matRef}
        color="#fff0d4"
        transparent
        opacity={0.9}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function PlayHeavyBag({
  impacts,
  bagZoneOffsetRef,
}: {
  impacts: BagPunchImpact[];
  bagZoneOffsetRef: RefObject<GlovePosition>;
}) {
  const leather = useMemo(() => getNutBrownLeatherMaps(), []);
  const swingRef = useRef(createBagSwingState());
  const pivotRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => new THREE.CylinderGeometry(0.42, 0.48, 2.1, 40, 20), []);
  const originalPositions = useMemo(
    () => new Float32Array(geometry.attributes.position.array as Float32Array),
    [geometry]
  );
  const dentsRef = useRef<BagDent[]>([]);
  const [activeRings, setActiveRings] = useState<
    { id: number; point: THREE.Vector3; normal: THREE.Vector3; time: number }[]
  >([]);
  const lastImpactIdRef = useRef(0);
  const { camera } = useThree();

  useEffect(() => {
    if (!impacts.length) return;
    const latest = impacts[impacts.length - 1];
    if (latest.id <= lastImpactIdRef.current) return;
    lastImpactIdRef.current = latest.id;

    applyBagHitImpulse(swingRef.current, latest.glove);

    const body = bodyRef.current;
    if (!body) return;

    body.updateWorldMatrix(true, false);
    const hit = raycastBagBodyHit(latest.knuckle, camera, body);
    if (!hit) return;

    dentsRef.current.push({
      localPoint: hit.localPoint,
      depth: DENT_ADD_DEPTH,
      radius: DENT_RADIUS,
    });
    if (dentsRef.current.length > 6) dentsRef.current.shift();

    setActiveRings((prev) => [
      ...prev,
      { id: latest.id, point: hit.localPoint.clone(), normal: hit.localNormal, time: latest.time },
    ]);
  }, [impacts, camera]);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    const pivot = pivotRef.current;
    if (!body || !pivot) return;

    stepBagSwing(swingRef.current, delta);
    pivot.rotation.z = swingRef.current.angle;

    const zoneOffset = bagZoneScreenOffset(swingRef.current.angle, camera);
    bagZoneOffsetRef.current.x = zoneOffset.x;
    bagZoneOffsetRef.current.y = zoneOffset.y;

    const dents = dentsRef.current;
    for (let i = dents.length - 1; i >= 0; i--) {
      dents[i].depth = Math.max(0, dents[i].depth - delta * DENT_DECAY * 0.08);
      if (dents[i].depth <= 0.001) dents.splice(i, 1);
    }

    applyBagDents(geometry, originalPositions, dents);
  });

  return (
    <group position={[0, 0, BAG_Z]}>
      <mesh position={[0, 3.85, 0]}>
        <boxGeometry args={[0.12, 0.08, 0.12]} />
        <meshStandardMaterial color="#333" metalness={0.4} />
      </mesh>
      <group ref={pivotRef} position={[0, BAG_PIVOT_Y, 0]}>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.4, 6]} />
          <meshStandardMaterial color="#444" metalness={0.5} />
        </mesh>
        <group position={[0, BAG_HANG_OFFSET_Y, 0]}>
          <mesh ref={bodyRef} castShadow receiveShadow geometry={geometry}>
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
          {activeRings.map((ring) => (
            <ImpactRing3D
              key={ring.id}
              point={ring.point}
              normal={ring.normal}
              startTime={ring.time}
              onDone={() => setActiveRings((prev) => prev.filter((r) => r.id !== ring.id))}
            />
          ))}
          <pointLight position={[0, 1.5, 0.6]} intensity={12} color="#ffdcb0" distance={5} />
        </group>
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
      <ambientLight intensity={0.55} color="#FFE4B5" />
      <directionalLight position={[2, 6, 2]} intensity={1.2} color="#FFD699" castShadow />
      <pointLight position={[0, 4, 0]} intensity={10} color="#FFE4B5" distance={10} />
      <fog attach="fog" args={['#1a1208', 5, 16]} />
    </>
  );
}

function PlayScene({
  impacts,
  bagZoneOffsetRef,
}: {
  impacts: BagPunchImpact[];
  bagZoneOffsetRef: RefObject<GlovePosition>;
}) {
  return (
    <>
      <PlayEnvironment />
      <PlayHeavyBag impacts={impacts} bagZoneOffsetRef={bagZoneOffsetRef} />
    </>
  );
}

interface HeavyBagPlaySceneProps {
  impacts: BagPunchImpact[];
  bagZoneOffsetRef: RefObject<GlovePosition>;
}

export function HeavyBagPlayScene({ impacts, bagZoneOffsetRef }: HeavyBagPlaySceneProps) {
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
      <PlayScene impacts={impacts} bagZoneOffsetRef={bagZoneOffsetRef} />
    </Canvas>
  );
}
