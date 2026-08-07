import { Suspense, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import type { Group } from 'three';
import * as THREE from 'three';
import { PartnerFaceDecal } from '../play/face/PartnerFaceDecal';
import { useBody } from '../play/BodyContext';
import type { BodyStyle } from '../play/bodyStyles';
import { BODY_STYLES } from '../play/bodyStyles';

/** Base sprite plane height in metres. */
export const SPARRING_SPRITE_BASE_HEIGHT = 3.44;
/** Ring play mode scale (50% larger than base). */
export const RING_SPRITE_SCALE = 1.5;

/** Ring canvas top surface — partner feet sit here (ring-local Y). */
export const RING_CANVAS_SURFACE_Y = 0.24;

/**
 * Boot soles meet the parent origin via spriteCenterY() inside SparringPartner.
 * No additional group lift is needed — extra shin-length offsets float the figure.
 */
export function partnerFootAlignLift(_scale = 1): number {
  return 0;
}

/** Browse overview — soles anchor at ring canvas via spriteCenterY. */
export const GYM_PARTNER_LIFT = partnerFootAlignLift(1);

function spriteCenterY(height: number, feetSoleFrac: number): number {
  return height * (0.5 - feetSoleFrac);
}

interface SparringPartnerProps {
  dimmed?: boolean;
  /** 0 = full hit flash, 1+ = no flash */
  hitFlashAge?: number;
  /** Subtle side-to-side and weight-shift idle */
  animate?: boolean;
  /** Height multiplier (ring play uses 1.5). */
  scale?: number;
  /** Show caricature face on head (ring play only). */
  showFace?: boolean;
  /** Latest landed punch time — drives face "ooh!" reaction. */
  lastHitTime?: number;
  /** Damage meter at 100% — show knockout face. */
  knockedOut?: boolean;
  innerRef?: RefObject<Group | null>;
  /** Override body style (defaults to Options selection). */
  body?: BodyStyle;
}

function SparringPartnerSprite({
  dimmed = false,
  hitFlashAge = 1,
  animate = false,
  scale = 1,
  showFace = false,
  lastHitTime = 0,
  knockedOut = false,
  innerRef,
  body: bodyProp,
}: SparringPartnerProps) {
  const { body: selectedBody } = useBody();
  const body = bodyProp ?? selectedBody;
  const animRef = useRef<Group>(null);
  const texture = useTexture(body.textureSrc);
  const opacity = dimmed ? 0.35 : 1;
  const flash = hitFlashAge < 1;
  const flashMix = flash ? Math.max(0, 1 - hitFlashAge) : 0;
  const flashColor = flash
    ? `rgb(${255},${Math.round(255 - 100 * flashMix)},${Math.round(255 - 140 * flashMix)})`
    : '#ffffff';
  const height = SPARRING_SPRITE_BASE_HEIGHT * scale;
  const width = height * body.aspect;
  const centerY = spriteCenterY(height, body.feetSoleFrac);
  const motion = scale;

  useFrame((state) => {
    if (!animate || !animRef.current) return;
    const t = state.clock.elapsedTime;
    animRef.current.position.set(
      Math.sin(t * 1.15) * 0.09 * motion,
      0,
      Math.sin(t * 0.85 + 0.4) * 0.1 * motion
    );
    animRef.current.rotation.z = Math.sin(t * 1.05) * 0.065;
  });

  return (
    <group ref={innerRef}>
      <group ref={animRef} position={[0, centerY, 0]}>
        <mesh castShadow position={[0, 0, 0.02]}>
          <planeGeometry args={[width, height]} />
          {/* Basic + untonemapped keeps body art readable; standard lighting crushed dark packs. */}
          <meshBasicMaterial
            map={texture}
            transparent
            alphaTest={0.06}
            opacity={opacity}
            color={flashColor}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {showFace && (
          <PartnerFaceDecal
            spriteWidth={width}
            spriteHeight={height}
            faceRect={body.faceRect}
            bodyTextureSrc={body.textureSrc}
            lastHitTime={lastHitTime}
            knockedOut={knockedOut}
          />
        )}
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

useTexture.preload(BODY_STYLES.generic.textureSrc);
