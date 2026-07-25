import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { FACE_CONTAIN_PAD, drawFullFaceOnCanvas, loadFaceImage } from './composeFaceTexture';
import {
  FACE_NOSE_LANDMARK,
  FACE_OOH_SRC,
  FACE_SOURCE_SIZE,
  FACE_TEMPLATE_SRC,
  RING_PARTNER_FACE,
} from './faceTemplate';
import {
  landmarkOffsetInDecal,
  scalePlacement,
  scalePlacementFromPoint,
  spriteNormRectToLocal,
} from './spriteFacePlacement';

const CANVAS_SIZE = 512;
/** Prior calibration: top-right pinned, +25%. */
const PARTNER_FACE_SCALE_TOP_RIGHT = 1.25;
/** Prior calibration: bottom-left pinned, +10% right and up. */
const PARTNER_FACE_SCALE_BOTTOM_LEFT = 1.1;
/** Nose pinned, +10% every direction (applied per user calibration step). */
const PARTNER_FACE_SCALE_NOSE = 1.1;
const PARTNER_FACE_NOSE_SCALE_STEPS = 2;
/** How long the pre-authored "ooh!" face stays up (ms). */
const OOH_MS = 380;

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
}

/**
 * Clean 2D caricature on the moving sparring partner.
 * Injuries live on the HUD damage meter. On hit, swap to the matching ooh face.
 */
export function PartnerFaceDecal({
  spriteWidth,
  spriteHeight,
  lastHitTime = 0,
}: PartnerFaceDecalProps) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const normalRef = useRef<HTMLImageElement | null>(null);
  const oohRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const texRef = useRef<THREE.CanvasTexture | null>(null);

  const placement = useMemo(() => {
    const base = spriteNormRectToLocal(RING_PARTNER_FACE, spriteWidth, spriteHeight, {
      scale: PARTNER_FACE_SCALE_TOP_RIGHT,
      anchor: 'top-right',
    });
    let current = scalePlacement(base, PARTNER_FACE_SCALE_BOTTOM_LEFT, 'bottom-left');
    for (let i = 0; i < PARTNER_FACE_NOSE_SCALE_STEPS; i++) {
      current = scaleFromNose(current, PARTNER_FACE_SCALE_NOSE);
    }
    return current;
  }, [spriteWidth, spriteHeight]);
  const [fw, fh] = placement.size;

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

    Promise.all([loadFaceImage(FACE_TEMPLATE_SRC), loadFaceImage(FACE_OOH_SRC)]).then(
      ([normal, ooh]) => {
        if (cancelled) return;
        normalRef.current = normal;
        oohRef.current = ooh;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        drawFullFaceOnCanvas(ctx, normal, CANVAS_SIZE, CANVAS_SIZE);
        tex.needsUpdate = true;
      }
    );

    return () => {
      cancelled = true;
      tex.dispose();
    };
  }, []);

  // Swap to authored ooh face for a short window on each hit.
  useEffect(() => {
    if (!lastHitTime) return;
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const normal = normalRef.current;
      const ooh = oohRef.current;
      const canvas = canvasRef.current;
      const tex = texRef.current;
      if (!normal || !ooh || !canvas || !tex) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const age = performance.now() - lastHitTime;
      const showOoh = age >= 0 && age < OOH_MS;
      drawFullFaceOnCanvas(ctx, showOoh ? ooh : normal, CANVAS_SIZE, CANVAS_SIZE);
      tex.needsUpdate = true;

      if (!showOoh && age >= OOH_MS) {
        cancelAnimationFrame(frame);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [lastHitTime]);

  if (!texture) return null;

  return (
    <mesh position={placement.center} renderOrder={2}>
      <planeGeometry args={[fw, fh]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}
