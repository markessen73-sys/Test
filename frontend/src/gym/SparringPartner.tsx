import { Suspense, useEffect, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import type { Group, MeshBasicMaterial, Texture } from 'three';
import * as THREE from 'three';
import { assetUrl } from '../assetUrl';
import { PartnerFaceDecal } from '../play/face/PartnerFaceDecal';
import { useCharacter } from '../play/face/CharacterContext';
import type { BodyStyle } from '../play/bodyStyles';
import { BODY_STYLES, DEFAULT_BODY_STYLE_ID } from '../play/bodyStyles';

/** Base sprite plane height in metres. */
export const SPARRING_SPRITE_BASE_HEIGHT = 3.44;
/** Ring play mode scale (50% larger than base). */
export const RING_SPRITE_SCALE = 1.5;

/** Ring canvas top surface — partner feet sit here (ring-local Y). */
export const RING_CANVAS_SURFACE_Y = 0.24;

/** Match PartnerFaceDecal ooh window — baked poses use the same timing. */
const BAKED_OOH_MS = 720;

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
  /** Override body style (defaults to the selected boxer's body). */
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
  const { character } = useCharacter();
  const body =
    bodyProp ??
    (character.bodyId ? BODY_STYLES[character.bodyId] : undefined) ??
    BODY_STYLES[DEFAULT_BODY_STYLE_ID];
  const baked = character.bakedRingPoses;
  const animRef = useRef<Group>(null);
  const matRef = useRef<MeshBasicMaterial>(null);
  const hitTimeRef = useRef(lastHitTime);
  const knockedOutRef = useRef(knockedOut);
  hitTimeRef.current = lastHitTime;
  knockedOutRef.current = knockedOut;

  const bodyTexture = useTexture(body.textureSrc);
  const bakedTextures = useTexture(
    baked
      ? [baked.idleSrc, baked.oohSrc, baked.knockoutSrc]
      : [body.textureSrc, body.textureSrc, body.textureSrc]
  ) as [Texture, Texture, Texture];

  useEffect(() => {
    for (const t of baked ? bakedTextures : [bodyTexture]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    }
  }, [baked, bakedTextures, bodyTexture]);

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
  const useBaked = !!baked;
  // Face decal only for hybrid face-on-body characters.
  const showFaceDecal = showFace && !useBaked;

  useFrame((state) => {
    if (animate && animRef.current) {
      const t = state.clock.elapsedTime;
      animRef.current.position.set(
        Math.sin(t * 1.15) * 0.09 * motion,
        0,
        Math.sin(t * 0.85 + 0.4) * 0.1 * motion
      );
      animRef.current.rotation.z = Math.sin(t * 1.05) * 0.065;
    }

    if (!useBaked || !matRef.current) return;
    const [idleMap, oohMap, koMap] = bakedTextures;
    let map = idleMap;
    if (knockedOutRef.current) {
      map = koMap;
    } else if (showFace) {
      const hitT = hitTimeRef.current;
      if (hitT > 0) {
        const age = performance.now() - hitT;
        if (age >= 0 && age < BAKED_OOH_MS) map = oohMap;
      }
    }
    if (matRef.current.map !== map) {
      matRef.current.map = map;
      matRef.current.needsUpdate = true;
    }
  });

  const initialMap = useBaked ? bakedTextures[0] : bodyTexture;

  return (
    <group ref={innerRef}>
      <group ref={animRef} position={[0, centerY, 0]}>
        <mesh castShadow position={[0, 0, 0.02]} renderOrder={1}>
          <planeGeometry args={[width, height]} />
          {/* Basic + untonemapped keeps body art readable; standard lighting crushed dark packs. */}
          <meshBasicMaterial
            ref={matRef}
            map={initialMap}
            transparent
            alphaTest={0.06}
            opacity={opacity}
            color={flashColor}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {showFaceDecal && (
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
useTexture.preload(BODY_STYLES['body-kk'].textureSrc);
useTexture.preload(assetUrl('/boxer/bodies/kk-ooh.png'));
useTexture.preload(assetUrl('/boxer/bodies/kk-knockout.png'));
