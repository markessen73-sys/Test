import { Suspense, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import type { Group } from 'three';
import * as THREE from 'three';

const SPARRING_BOXER_TEXTURE = '/boxer/sparring-boxer.png';

/** Full sprite plane height (2× original 1.72 m). */
export const SPARRING_SPRITE_HEIGHT = 3.44;
const SPRITE_WIDTH = SPARRING_SPRITE_HEIGHT * (1024 / 1536);

/** Transparent padding below the feet in the source image. */
const FEET_INSET_FRAC = 74 / 1536;

/** Ring canvas top surface — partner feet sit here (ring-local Y). */
export const RING_CANVAS_SURFACE_Y = 0.24;

/** Plane centre Y so visible feet rest on local Y=0. */
export const SPARRING_SPRITE_CENTER_Y = SPARRING_SPRITE_HEIGHT * (0.5 - FEET_INSET_FRAC);

interface SparringPartnerProps {
  dimmed?: boolean;
  /** 0 = full hit flash, 1+ = no flash */
  hitFlashAge?: number;
  /** Subtle side-to-side and weight-shift idle */
  animate?: boolean;
  innerRef?: RefObject<Group | null>;
}

function SparringPartnerSprite({
  dimmed = false,
  hitFlashAge = 1,
  animate = false,
  innerRef,
}: SparringPartnerProps) {
  const animRef = useRef<Group>(null);
  const texture = useTexture(SPARRING_BOXER_TEXTURE);
  const opacity = dimmed ? 0.35 : 1;
  const flash = hitFlashAge < 1;

  useFrame((state) => {
    if (!animate || !animRef.current) return;
    const t = state.clock.elapsedTime;
    animRef.current.position.set(
      Math.sin(t * 1.15) * 0.09,
      0,
      Math.sin(t * 0.85 + 0.4) * 0.1
    );
    animRef.current.rotation.z = Math.sin(t * 1.05) * 0.065;
  });

  return (
    <group ref={innerRef}>
      <group ref={animRef} position={[0, SPARRING_SPRITE_CENTER_Y, 0]}>
        <mesh castShadow position={[0, 0, 0.02]}>
          <planeGeometry args={[SPRITE_WIDTH, SPARRING_SPRITE_HEIGHT]} />
          <meshStandardMaterial
            map={texture}
            transparent
            alphaTest={0.06}
            opacity={opacity}
            emissive={flash ? '#ff6644' : '#000000'}
            emissiveIntensity={flash ? 0.4 * (1 - hitFlashAge) : 0}
            roughness={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Sparring boxer sprite with subtle stance movement. */
export function SparringPartner(props: SparringPartnerProps) {
  return (
    <Suspense fallback={null}>
      <SparringPartnerSprite {...props} />
    </Suspense>
  );
}

useTexture.preload(SPARRING_BOXER_TEXTURE);
