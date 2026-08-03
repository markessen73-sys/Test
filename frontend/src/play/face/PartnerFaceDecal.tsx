import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FACE_CONTAIN_PAD, drawFullFaceOnCanvas, loadFaceImage } from './composeFaceTexture';
import { useCharacter } from './CharacterContext';
import {
  FACE_NOSE_LANDMARK,
  FACE_SOURCE_SIZE,
  RING_PARTNER_FACE,
} from './faceTemplate';
import {
  landmarkOffsetInDecal,
  scalePlacement,
  scalePlacementFromPoint,
  spriteNormRectToLocal,
} from './spriteFacePlacement';
import { paintOohReaction, skinFromFaceImage, type PopEyePair } from './paintOohReaction';
import { paintKnockoutFace } from './paintKnockout';
import type { Rgb } from '../../face-capture/popEyes';

const CANVAS_SIZE = 512;
/** Prior calibration: top-right pinned, +25%. */
const PARTNER_FACE_SCALE_TOP_RIGHT = 1.25;
/** Prior calibration: bottom-left pinned, +10% right and up. */
const PARTNER_FACE_SCALE_BOTTOM_LEFT = 1.1;
/** Nose pinned, +10% every direction (applied per user calibration step). */
const PARTNER_FACE_SCALE_NOSE = 1.1;
const PARTNER_FACE_NOSE_SCALE_STEPS = 2;
/** Final overall boost — active head ~20% larger. */
const PARTNER_FACE_SCALE_OVERALL = 1.2;
/** How long the "ooh!" face stays up (ms); eyes zoom for most of this. */
const OOH_MS = 720;

function scaleFromNose(
  placement: ReturnType<typeof spriteNormRectToLocal>,
  scale: number
) {
  const [fw, fh] = placement.size;
  const [iw, ih] = FACE_SOURCE_SIZE;
  const noseOffset = landmarkOffsetInDecal(
    fw,
    fh,
    CANVAS_SIZE,
    CANVAS_SIZE,
    iw,
    ih,
    FACE_NOSE_LANDMARK,
    FACE_CONTAIN_PAD
  );
  return scalePlacementFromPoint(placement, scale, noseOffset);
}

interface PartnerFaceDecalProps {
  /** Sprite plane width in metres. */
  spriteWidth: number;
  /** Sprite plane height in metres. */
  spriteHeight: number;
  /** Latest landed punch time — swaps to the authored ooh face. */
  lastHitTime?: number;
  /** Damage meter at 100% — hold the knockout face. */
  knockedOut?: boolean;
}

/**
 * Clean 2D caricature on the moving sparring partner.
 * Injuries live on the HUD damage meter. On hit, swap to ooh; at 100% show KO.
 * Photo faces with eye marks animate pop-eyes zooming ½→full.
 */
export function PartnerFaceDecal({
  spriteWidth,
  spriteHeight,
  lastHitTime = 0,
  knockedOut = false,
}: PartnerFaceDecalProps) {
  const { character } = useCharacter();
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const normalRef = useRef<HTMLImageElement | null>(null);
  const oohRef = useRef<HTMLImageElement | null>(null);
  const koRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const texRef = useRef<THREE.CanvasTexture | null>(null);
  const popEyesRef = useRef<PopEyePair | null>(null);
  const skinRef = useRef<Rgb | null>(null);
  const knockedOutRef = useRef(knockedOut);
  knockedOutRef.current = knockedOut;
  const lastPaintedAgeRef = useRef(-1);
  const hitTimeRef = useRef(lastHitTime);
  if (hitTimeRef.current !== lastHitTime) {
    hitTimeRef.current = lastHitTime;
    lastPaintedAgeRef.current = -1;
  }

  const placement = useMemo(() => {
    const base = spriteNormRectToLocal(RING_PARTNER_FACE, spriteWidth, spriteHeight, {
      scale: PARTNER_FACE_SCALE_TOP_RIGHT,
      anchor: 'top-right',
    });
    let current = scalePlacement(base, PARTNER_FACE_SCALE_BOTTOM_LEFT, 'bottom-left');
    for (let i = 0; i < PARTNER_FACE_NOSE_SCALE_STEPS; i++) {
      current = scaleFromNose(current, PARTNER_FACE_SCALE_NOSE);
    }
    current = scaleFromNose(current, PARTNER_FACE_SCALE_OVERALL);
    return current;
  }, [spriteWidth, spriteHeight]);
  const [fw, fh] = placement.size;

  const paint = (img: HTMLImageElement, hitAgeMs?: number) => {
    const canvas = canvasRef.current;
    const tex = texRef.current;
    if (!canvas || !tex) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (hitAgeMs != null && popEyesRef.current) {
      paintOohReaction(ctx, CANVAS_SIZE, img, {
        popEyes: popEyesRef.current,
        skin: skinRef.current,
        hitAgeMs,
        oohMs: OOH_MS,
      });
    } else {
      drawFullFaceOnCanvas(ctx, img, CANVAS_SIZE, CANVAS_SIZE);
    }
    tex.needsUpdate = true;
  };

  const paintKo = (ko: HTMLImageElement, timeMs: number) => {
    const canvas = canvasRef.current;
    const tex = texRef.current;
    if (!canvas || !tex) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    paintKnockoutFace(ctx, CANVAS_SIZE, ko, timeMs);
    tex.needsUpdate = true;
  };

  // Keep marks in sync every render (not only on image reload).
  popEyesRef.current = character.popEyes ?? null;

  useEffect(() => {
    let cancelled = false;
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    canvasRef.current = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    texRef.current = tex;
    setTexture(tex);

    skinRef.current = null;
    const marks = character.popEyes ?? null;
    popEyesRef.current = marks;

    Promise.all([
      loadFaceImage(character.cleanSrc),
      loadFaceImage(character.oohSrc),
      loadFaceImage(character.knockoutSrc),
    ]).then(([normal, ooh, ko]) => {
      if (cancelled) return;
      normalRef.current = normal;
      oohRef.current = ooh;
      koRef.current = ko;
      if (marks) {
        skinRef.current = skinFromFaceImage(ooh, marks);
      }
      paint(knockedOutRef.current ? ko : normal);
    });

    return () => {
      cancelled = true;
      tex.dispose();
    };
  }, [character.id, character.cleanSrc, character.oohSrc, character.knockoutSrc, character.popEyes]);

  // Hold knockout face once the meter hits 100%.
  useEffect(() => {
    lastPaintedAgeRef.current = -1;
    const ko = koRef.current;
    const normal = normalRef.current;
    if (knockedOut) {
      if (ko) {
        if (character.isPhotoFace) paintKo(ko, performance.now());
        else paint(ko);
      }
      return;
    }
    if (normal) paint(normal);
  }, [knockedOut, character.isPhotoFace]);

  // Ooh + pop-eye zoom, or spinning KO stars — driven by the R3F frame loop.
  useFrame(() => {
    if (knockedOutRef.current) {
      if (!character.isPhotoFace) return;
      const ko = koRef.current;
      if (!ko) return;
      const bucket = Math.floor(performance.now() / 32);
      if (bucket === lastPaintedAgeRef.current) return;
      lastPaintedAgeRef.current = bucket;
      paintKo(ko, performance.now());
      return;
    }
    const hitT = hitTimeRef.current;
    if (!hitT) return;
    const normal = normalRef.current;
    const ooh = oohRef.current;
    if (!normal || !ooh) return;

    const age = performance.now() - hitT;
    if (age >= 0 && age < OOH_MS) {
      // Throttle redraws slightly but keep zoom smooth (~every frame while zooming)
      const bucket = Math.floor(age / 16);
      if (bucket === lastPaintedAgeRef.current) return;
      lastPaintedAgeRef.current = bucket;
      paint(ooh, popEyesRef.current ? age : undefined);
    } else if (lastPaintedAgeRef.current !== -2) {
      lastPaintedAgeRef.current = -2;
      paint(normal);
    }
  });

  if (!texture) return null;

  return (
    <mesh position={placement.center} renderOrder={2}>
      <planeGeometry args={[fw, fh]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}
