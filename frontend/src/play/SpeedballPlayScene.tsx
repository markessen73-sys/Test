import { useEffect, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { computeSpeedballHitZone } from './speedballImpact';
import { applySpeedballHitImpulse, createSpeedballSwingState, stepSpeedballSwing } from './speedballSwing';
import { SpeedballFaceDecal } from './face/SpeedballFaceDecal';
import { SPEEDBALL_BALL_Y, SPEEDBALL_PLAY_CAMERA } from './playCamera';
import { PlayEnvironment } from './PlayEnvironment';
import type { PunchImpact } from './punchImpact';
import type { HitZoneCorners } from './targetZone';

function PlaySpeedball({
  impacts,
  speedballZoneCornersRef,
  knockedOut,
}: {
  impacts: PunchImpact[];
  speedballZoneCornersRef: RefObject<HitZoneCorners>;
  knockedOut: boolean;
}) {
  const swingRef = useRef(createSpeedballSwingState());
  const ballRef = useRef<THREE.Group>(null);
  const [hitFlash, setHitFlash] = useState(0);
  const [lastHitTime, setLastHitTime] = useState(0);
  const lastImpactIdRef = useRef(0);
  const { camera } = useThree();

  useEffect(() => {
    if (!impacts.length) return;
    const latest = impacts[impacts.length - 1];
    if (latest.id <= lastImpactIdRef.current) return;
    lastImpactIdRef.current = latest.id;

    applySpeedballHitImpulse(swingRef.current, latest.glove);
    setHitFlash(performance.now());
    setLastHitTime(latest.time);
  }, [impacts]);

  useFrame((_, delta) => {
    stepSpeedballSwing(swingRef.current, delta);
    const state = swingRef.current;
    if (ballRef.current) {
      ballRef.current.position.set(state.offsetX, SPEEDBALL_BALL_Y, state.offsetZ);
    }
    const zone = computeSpeedballHitZone(camera, state.offsetX, state.offsetZ);
    speedballZoneCornersRef.current = zone;
  });

  const flashAge = hitFlash > 0 ? (performance.now() - hitFlash) / 300 : 1;

  return (
    <group position={[0, 0, -3.8]}>
      <mesh position={[0, 3.05, -0.35]}>
        <boxGeometry args={[1.0, 0.14, 0.2]} />
        <meshStandardMaterial color="#4A3728" />
      </mesh>
      <mesh position={[0, 2.6, -0.25]}>
        <cylinderGeometry args={[0.03, 0.03, 0.9, 8]} />
        <meshStandardMaterial color="#777" metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[1.2, 0.08, 1.0]} />
        <meshStandardMaterial color="#5C4033" />
      </mesh>

      <group ref={ballRef} position={[0, SPEEDBALL_BALL_Y, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.3, 24, 24]} />
          <meshStandardMaterial
            color={flashAge < 1 ? '#ff5555' : '#D42020'}
            roughness={0.45}
            emissive={flashAge < 1 ? '#ff2222' : '#000000'}
            emissiveIntensity={flashAge < 1 ? 0.4 * (1 - flashAge) : 0}
          />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[0.3, 0.04, 8, 24]} />
          <meshStandardMaterial color="#EEE" />
        </mesh>
        <SpeedballFaceDecal lastHitTime={lastHitTime} knockedOut={knockedOut} />
      </group>
    </group>
  );
}

interface SpeedballPlaySceneProps {
  impacts: PunchImpact[];
  speedballZoneCornersRef: RefObject<HitZoneCorners>;
  knockedOut: boolean;
}

export function SpeedballPlayScene({
  impacts,
  speedballZoneCornersRef,
  knockedOut,
}: SpeedballPlaySceneProps) {
  const cam = SPEEDBALL_PLAY_CAMERA;
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
      <PlaySpeedball
        impacts={impacts}
        speedballZoneCornersRef={speedballZoneCornersRef}
        knockedOut={knockedOut}
      />
    </Canvas>
  );
}
