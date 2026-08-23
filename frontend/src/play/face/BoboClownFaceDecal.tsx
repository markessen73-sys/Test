import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { drawFullFaceOnCanvas, loadFaceImage } from './composeFaceTexture';
import {
  BOBO_CLOWN_CLEAN_SRC,
  BOBO_CLOWN_LIVE_KO_SRC,
  BOBO_CLOWN_OOH_SRC,
} from './boboClownStageAssets';
import { BOBO_FACE_CENTER, createBoboFacePatchGeometry } from './boboFacePlacement';

const CANVAS_SIZE = 512;
/** Match ring partner hit-face window. */
const OOH_MS = 380;

interface BoboClownFaceDecalProps {
  /** Latest landed punch — swaps to the clown ooh face. */
  lastHitTime?: number;
  /** Damage meter at 100% — hold the clown knockout face. */
  knockedOut?: boolean;
}

/**
 * Clean comedy-clown on the bobo doll head.
 * Injuries stay in the damage HUD. On hit → ooh; at 100% → KO.
 */
export function BoboClownFaceDecal({
  lastHitTime = 0,
  knockedOut = false,
}: BoboClownFaceDecalProps) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const normalRef = useRef<HTMLImageElement | null>(null);
  const oohRef = useRef<HTMLImageElement | null>(null);
  const koRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const texRef = useRef<THREE.CanvasTexture | null>(null);
  const knockedOutRef = useRef(knockedOut);
  const geometry = useMemo(() => createBoboFacePatchGeometry(), []);
  knockedOutRef.current = knockedOut;

  const paint = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    const tex = texRef.current;
    if (!canvas || !tex) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawFullFaceOnCanvas(ctx, img, CANVAS_SIZE, CANVAS_SIZE);
    tex.needsUpdate = true;
  };

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

    Promise.all([
      loadFaceImage(BOBO_CLOWN_CLEAN_SRC),
      loadFaceImage(BOBO_CLOWN_OOH_SRC),
      loadFaceImage(BOBO_CLOWN_LIVE_KO_SRC),
    ]).then(([normal, ooh, ko]) => {
      if (cancelled) return;
      normalRef.current = normal;
      oohRef.current = ooh;
      koRef.current = ko;
      paint(knockedOutRef.current ? ko : normal);
    });

    return () => {
      cancelled = true;
      tex.dispose();
    };
  }, []);

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

  useEffect(() => {
    if (!lastHitTime || knockedOutRef.current) return;
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (knockedOutRef.current) {
        const ko = koRef.current;
        if (ko) paint(ko);
        cancelAnimationFrame(frame);
        return;
      }
      const normal = normalRef.current;
      const ooh = oohRef.current;
      if (!normal || !ooh) return;

      const age = performance.now() - lastHitTime;
      const showOoh = age >= 0 && age < OOH_MS;
      paint(showOoh ? ooh : normal);

      if (!showOoh && age >= OOH_MS) {
        cancelAnimationFrame(frame);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [lastHitTime]);

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
