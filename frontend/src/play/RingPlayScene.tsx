import { Suspense, useEffect, useRef, useState, type RefObject } from 'react';
import type { GlovePosition } from '../types/game';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SparringPartner, RING_CANVAS_SURFACE_Y, RING_SPRITE_SCALE } from '../gym/SparringPartner';
import { ringZoneScreenOffset } from './ringImpact';
import { applyRingHitImpulse, createRingSwingState, stepRingSwing } from './ringSwing';
import {
  RING_CANVAS_SIZE,
  RING_CORNER_PAD_SIZE,
  RING_FLOOR_SIZE,
  RING_GROUP_ORIGIN_Z,
  RING_HALF,
  RING_PARTNER_FORWARD,
  RING_PARTNER_LIFT,
  RING_PARTNER_YAW,
  RING_PLAY_CAMERA,
  RING_PLAYER_CORNER_PAD,
  RING_POST_HEIGHT,
  RING_ROPE_HEIGHTS,
  RING_ROPE_SPAN,
} from './playCamera';
import type { PunchImpact } from './punchImpact';
import { useCharacter } from './face/CharacterContext';

function RingPlayEnvironment({ themed = false }: { themed?: boolean }) {
  return (
    <>
      <ambientLight intensity={themed ? 0.58 : 0.52} color={themed ? '#FFD4B8' : '#FFE4B5'} />
      <directionalLight
        position={[0, 7, -1]}
        intensity={themed ? 1.15 : 1.15}
        color={themed ? '#FFC98A' : '#FFD699'}
        castShadow
      />
      <pointLight
        position={[0, 4, RING_GROUP_ORIGIN_Z]}
        intensity={themed ? 8 : 9}
        color={themed ? '#FFE0B8' : '#FFF0D0'}
        distance={22}
      />
      {/* No far fog when themed — CSS backdrop must stay crisp behind the transparent canvas */}
      {themed ? null : <fog attach="fog" args={['#1a1208', 8, 28]} />}
    </>
  );
}

function PlayRing({
  impacts,
  ringZoneOffsetRef,
  knockedOut,
}: {
  impacts: PunchImpact[];
  ringZoneOffsetRef: RefObject<GlovePosition>;
  knockedOut: boolean;
}) {
  const swingRef = useRef(createRingSwingState());
  const weaveRef = useRef<THREE.Group>(null);
  const leanRef = useRef<THREE.Group>(null);
  const [hitFlash, setHitFlash] = useState(0);
  const lastImpactIdRef = useRef(0);
  const { camera, size } = useThree();

  useEffect(() => {
    if (!impacts.length) return;
    const latest = impacts[impacts.length - 1];
    if (latest.id <= lastImpactIdRef.current) return;
    lastImpactIdRef.current = latest.id;

    applyRingHitImpulse(swingRef.current, latest.glove);
    setHitFlash(performance.now());
  }, [impacts]);

  useFrame((_, delta) => {
    stepRingSwing(swingRef.current, delta, RING_SPRITE_SCALE, {
      knockedOut,
      camera,
      portrait: size.height > size.width,
    });
    const s = swingRef.current;
    if (weaveRef.current) {
      weaveRef.current.position.set(s.worldOffsetX, s.worldOffsetY, s.worldOffsetZ);
    }
    if (leanRef.current) {
      leanRef.current.rotation.set(s.leanPitch, 0, s.leanRoll);
    }
    const zoneOffset = ringZoneScreenOffset(s, camera);
    ringZoneOffsetRef.current.x = zoneOffset.x;
    ringZoneOffsetRef.current.y = zoneOffset.y;
  });

  const flashAge = hitFlash > 0 ? (performance.now() - hitFlash) / 300 : 1;
  const rope = '#CC0000';
  const post = '#F0EAD6';
  const postInset = RING_HALF;
  const postPositions = [-postInset, postInset] as const;

  return (
    <group position={[0, 0, RING_GROUP_ORIGIN_Z]}>
      <mesh position={[0, 0.1, 0]} receiveShadow castShadow>
        <boxGeometry args={[RING_FLOOR_SIZE, 0.2, RING_FLOOR_SIZE]} />
        <meshStandardMaterial color="#3D3428" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.22, 0]} receiveShadow>
        <boxGeometry args={[RING_CANVAS_SIZE, 0.04, RING_CANVAS_SIZE]} />
        <meshStandardMaterial color="#4A5568" roughness={0.95} />
      </mesh>

      {postPositions.flatMap((x) =>
        postPositions.map((z) => {
          if (x > 0 && z < 0) return null;
          return (
            <group key={`${x}-${z}`} position={[x, 0.22, z]}>
              <mesh position={[0, RING_POST_HEIGHT * 0.5, 0]} castShadow>
                <cylinderGeometry args={[0.08 * (RING_HALF / 2.2), 0.1 * (RING_HALF / 2.2), RING_POST_HEIGHT, 8]} />
                <meshStandardMaterial color={post} roughness={0.5} />
              </mesh>
            </group>
          );
        })
      )}

      {RING_ROPE_HEIGHTS.map((y, li) => (
        <group key={li} position={[0, y, 0]}>
          <mesh position={[0, 0, postInset]}>
            <boxGeometry args={[RING_ROPE_SPAN, 0.055, 0.055]} />
            <meshStandardMaterial color={li === 1 ? rope : '#990000'} />
          </mesh>
          <mesh position={[-postInset, 0, 0]}>
            <boxGeometry args={[0.055, 0.055, RING_ROPE_SPAN]} />
            <meshStandardMaterial color={li === 1 ? rope : '#990000'} />
          </mesh>
        </group>
      ))}

      <mesh position={[...RING_PLAYER_CORNER_PAD]} rotation={[0, RING_PARTNER_YAW, 0]}>
        <boxGeometry args={[RING_CORNER_PAD_SIZE, 0.035, RING_CORNER_PAD_SIZE]} />
        <meshStandardMaterial color="#B80000" roughness={0.85} />
      </mesh>

      <group position={[0, RING_CANVAS_SURFACE_Y + RING_PARTNER_LIFT, RING_PARTNER_FORWARD]}>
        <group ref={weaveRef}>
          <group rotation={[0, RING_PARTNER_YAW, 0]}>
            <group ref={leanRef}>
              <SparringPartner
                hitFlashAge={flashAge}
                scale={RING_SPRITE_SCALE}
                showFace
                lastHitTime={hitFlash}
                knockedOut={knockedOut}
              />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

interface RingPlaySceneProps {
  impacts: PunchImpact[];
  ringZoneOffsetRef: RefObject<GlovePosition>;
  knockedOut?: boolean;
}

export function RingPlayScene({
  impacts,
  ringZoneOffsetRef,
  knockedOut = false,
}: RingPlaySceneProps) {
  const cam = RING_PLAY_CAMERA;
  const { character } = useCharacter();
  const themed = Boolean(character.ringBackdropSrc);

  return (
    <Canvas
      shadows
      camera={{ position: cam.position, fov: cam.fov, near: 0.1, far: 40 }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(...cam.lookAt);
        if (themed) {
          gl.setClearColor(0x000000, 0);
        }
      }}
      style={{ width: '100%', height: '100%', touchAction: 'none', background: 'transparent' }}
      gl={{ antialias: true, alpha: themed }}
    >
      {themed ? null : <color attach="background" args={['#1a1208']} />}
      <RingPlayEnvironment themed={themed} />
      <Suspense fallback={null}>
        <PlayRing
          impacts={impacts}
          ringZoneOffsetRef={ringZoneOffsetRef}
          knockedOut={knockedOut}
        />
      </Suspense>
    </Canvas>
  );
}
