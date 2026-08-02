import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { drawFullFaceOnCanvas, loadFaceImage } from './composeFaceTexture';
import { useCharacter } from './CharacterContext';
import { BOBO_FACE_CENTER, createBoboFacePatchGeometry } from './boboFacePlacement';
import { paintOohReaction, skinFromFaceImage, type PopEyePair } from './paintOohReaction';
import type { Rgb } from '../../face-capture/popEyes';

const CANVAS_SIZE = 512;
/** Match ring partner hit-face window. */
const OOH_MS = 720;

interface BoboClownFaceDecalProps {
  /** Latest landed punch — swaps to the clown ooh face. */
  lastHitTime?: number;
  /** Damage meter at 100% — hold the clown knockout face. */
  knockedOut?: boolean;
}

/**
 * Clean comedy-clown (or photo face) on the bobo doll head.
 * Injuries stay in the damage HUD. On hit → ooh; at 100% → KO.
 * Photo faces with eye marks animate pop-eyes zooming ½→full.
 */
export function BoboClownFaceDecal({
  lastHitTime = 0,
  knockedOut = false,
}: BoboClownFaceDecalProps) {
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
  const geometry = useMemo(() => createBoboFacePatchGeometry(), []);
  knockedOutRef.current = knockedOut;
  const lastPaintedAgeRef = useRef(-1);
  const hitTimeRef = useRef(lastHitTime);
  if (hitTimeRef.current !== lastHitTime) {
    hitTimeRef.current = lastHitTime;
    lastPaintedAgeRef.current = -1;
  }

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
      loadFaceImage(character.boboCleanSrc),
      loadFaceImage(character.boboOohSrc),
      loadFaceImage(character.boboLiveKoSrc),
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
  }, [
    character.id,
    character.boboCleanSrc,
    character.boboOohSrc,
    character.boboLiveKoSrc,
    character.popEyes,
  ]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    const ko = koRef.current;
    const normal = normalRef.current;
    if (knockedOut) {
      if (ko) paint(ko);
      return;
    }
    if (normal) paint(normal);
  }, [knockedOut]);

  useFrame(() => {
    if (knockedOutRef.current) return;
    const hitT = hitTimeRef.current;
    if (!hitT) return;
    const normal = normalRef.current;
    const ooh = oohRef.current;
    if (!normal || !ooh) return;

    const age = performance.now() - hitT;
    if (age >= 0 && age < OOH_MS) {
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
    <mesh position={BOBO_FACE_CENTER} renderOrder={2}>
      <primitive attach="geometry" object={geometry} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        depthTest={false}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}
