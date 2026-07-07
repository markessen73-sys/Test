import { Suspense, useEffect, useRef, useState, type RefObject } from 'react';
import type { GlovePosition } from '../types/game';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SparringPartner, RING_CANVAS_SURFACE_Y } from '../gym/SparringPartner';
import { ringZoneScreenOffset } from './ringImpact';
import { applyRingHitImpulse, createRingSwingState, stepRingSwing } from './ringSwing';
import { RING_PARTNER_FORWARD, RING_PARTNER_YAW, RING_PLAY_CAMERA } from './playCamera';
import type { PunchImpact } from './punchImpact';

function RingPlayEnvironment() {
  return (
    <>
      <ambientLight intensity={0.52} color="#FFE4B5" />
      <directionalLight position={[0, 7, -1]} intensity={1.15} color="#FFD699" castShadow />
      <pointLight position={[0, 4, -2.2]} intensity={9} color="#FFF0D0" distance={14} />
      <fog attach="fog" args={['#1a1208', 6, 20]} />
    </>
  );
}

function PlayRing({
  impacts,
  ringZoneOffsetRef,
}: {
  impacts: PunchImpact[];
  ringZoneOffsetRef: RefObject<GlovePosition>;
}) {
  const swingRef = useRef(createRingSwingState());
  const partnerRef = useRef<THREE.Group>(null);
  const [hitFlash, setHitFlash] = useState(0);
  const lastImpactIdRef = useRef(0);
  const { camera } = useThree();

  useEffect(() => {
    if (!impacts.length) return;
    const latest = impacts[impacts.length - 1];
    if (latest.id <= lastImpactIdRef.current) return;
    lastImpactIdRef.current = latest.id;

    applyRingHitImpulse(swingRef.current, latest.glove);
    setHitFlash(performance.now());
  }, [impacts]);

  useFrame((_, delta) => {
    stepRingSwing(swingRef.current, delta);
    if (partnerRef.current) {
      partnerRef.current.position.x = swingRef.current.offsetX;
    }
    const zoneOffset = ringZoneScreenOffset(swingRef.current, camera);
    ringZoneOffsetRef.current.x = zoneOffset.x;
    ringZoneOffsetRef.current.y = zoneOffset.y;
  });

  const flashAge = hitFlash > 0 ? (performance.now() - hitFlash) / 300 : 1;
  const rope = '#CC0000';
  const post = '#F0EAD6';

  return (
    <group position={[0, 0, -2.2]}>
      <mesh position={[0, 0.1, 0]} receiveShadow castShadow>
        <boxGeometry args={[5.2, 0.2, 5.2]} />
        <meshStandardMaterial color="#3D3428" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.22, 0]} receiveShadow>
        <boxGeometry args={[4.6, 0.04, 4.6]} />
        <meshStandardMaterial color="#4A5568" roughness={0.95} />
      </mesh>

      {([-2.2, 2.2] as const).flatMap((x) =>
        ([-2.2, 2.2] as const).map((z) => (
          <group key={`${x}-${z}`} position={[x, 0.22, z]}>
            <mesh position={[0, 0.75, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.1, 1.5, 8]} />
              <meshStandardMaterial color={post} roughness={0.5} />
            </mesh>
          </group>
        ))
      )}

      {[0.5, 0.95, 1.4].map((y, li) => (
        <group key={li} position={[0, y, 0]}>
          <mesh position={[0, 0, 2.2]}>
            <boxGeometry args={[4.4, 0.055, 0.055]} />
            <meshStandardMaterial color={li === 1 ? rope : '#990000'} />
          </mesh>
          <mesh position={[0, 0, -2.2]}>
            <boxGeometry args={[4.4, 0.055, 0.055]} />
            <meshStandardMaterial color={li === 1 ? rope : '#990000'} />
          </mesh>
          <mesh position={[2.2, 0, 0]}>
            <boxGeometry args={[0.055, 0.055, 4.4]} />
            <meshStandardMaterial color={li === 1 ? rope : '#990000'} />
          </mesh>
          <mesh position={[-2.2, 0, 0]}>
            <boxGeometry args={[0.055, 0.055, 4.4]} />
            <meshStandardMaterial color={li === 1 ? rope : '#990000'} />
          </mesh>
        </group>
      ))}

      {/* Player corner pad (back-right) */}
      <mesh position={[1.75, 0.24, -1.85]} rotation={[0, RING_PARTNER_YAW, 0]}>
        <boxGeometry args={[0.58, 0.035, 0.58]} />
        <meshStandardMaterial color="#B80000" roughness={0.85} />
      </mesh>

      <group ref={partnerRef} position={[0, RING_CANVAS_SURFACE_Y, RING_PARTNER_FORWARD]} rotation={[0, RING_PARTNER_YAW, 0]}>
        <SparringPartner hitFlashAge={flashAge} animate />
      </group>
    </group>
  );
}

interface RingPlaySceneProps {
  impacts: PunchImpact[];
  ringZoneOffsetRef: RefObject<GlovePosition>;
}

export function RingPlayScene({ impacts, ringZoneOffsetRef }: RingPlaySceneProps) {
  const cam = RING_PLAY_CAMERA;
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
      <RingPlayEnvironment />
      <Suspense fallback={null}>
        <PlayRing impacts={impacts} ringZoneOffsetRef={ringZoneOffsetRef} />
      </Suspense>
    </Canvas>
  );
}
