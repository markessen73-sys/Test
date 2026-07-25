import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { drawFullFaceOnCanvas, loadFaceImage, warpForPunch } from './composeFaceTexture';
import {
  damageFaceIndexForStage,
  DAMAGE_METER_STEPS,
} from './faceDamage';
import {
  BOBO_CLOWN_CLEAN_SRC,
  BOBO_CLOWN_KO_SRC,
  BOBO_CLOWN_STAGE_SRCS,
} from './boboClownStageAssets';
import { BOBO_FACE_CENTER, BOBO_FACE_SIZE } from './boboFacePlacement';

const CANVAS_SIZE = 512;

interface BoboClownFaceDecalProps {
  /** Damage meter stage 0–10. */
  stage: number;
  /** Latest landed punch — brief squash. */
  lastHitTime?: number;
}

/**
 * Comedy-clown caricature on the bobo doll head.
 * Swaps through the 11 baked stages as damage climbs; squashes on punch.
 */
export function BoboClownFaceDecal({ stage, lastHitTime = 0 }: BoboClownFaceDecalProps) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const facesRef = useRef<HTMLImageElement[] | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const texRef = useRef<THREE.CanvasTexture | null>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  const faceForStage = (faces: HTMLImageElement[], s: number): HTMLImageElement => {
    const clamped = Math.max(0, Math.min(DAMAGE_METER_STEPS, s));
    if (clamped >= DAMAGE_METER_STEPS) return faces[faces.length - 1];
    const idx = damageFaceIndexForStage(clamped);
    if (idx < 0) return faces[0];
    return faces[1 + idx] ?? faces[0];
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

    // [0]=clean, [1..8]=injuries, [9]=KO
    Promise.all([
      loadFaceImage(BOBO_CLOWN_CLEAN_SRC),
      ...BOBO_CLOWN_STAGE_SRCS.map(loadFaceImage),
      loadFaceImage(BOBO_CLOWN_KO_SRC),
    ]).then((faces) => {
      if (cancelled) return;
      facesRef.current = faces;
    });

    return () => {
      cancelled = true;
      tex.dispose();
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const faces = facesRef.current;
      const canvas = canvasRef.current;
      const tex = texRef.current;
      if (!faces || !canvas || !tex) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const age = performance.now() - lastHitTime;
      const warp = lastHitTime > 0 && age < 280 ? warpForPunch() : undefined;
      const img = faceForStage(faces, stageRef.current);
      drawFullFaceOnCanvas(ctx, img, CANVAS_SIZE, CANVAS_SIZE, warp);
      tex.needsUpdate = true;

      if (!(lastHitTime > 0 && age < 280)) {
        // Keep painting while stage can change; idle still needs stage swaps.
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [lastHitTime, stage]);

  if (!texture) return null;

  const [fw, fh] = BOBO_FACE_SIZE;
  return (
    <mesh position={BOBO_FACE_CENTER} renderOrder={2}>
      <planeGeometry args={[fw, fh]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        depthTest={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
