import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { drawFullFaceOnCanvas, loadFaceImage, warpForPunch } from './composeFaceTexture';
import { BOBO_CLOWN_CLEAN_SRC } from './boboClownStageAssets';
import { BOBO_FACE_CENTER, BOBO_FACE_SIZE } from './boboFacePlacement';

const CANVAS_SIZE = 512;

interface BoboClownFaceDecalProps {
  /** Latest landed punch — brief squash. Injuries stay on the damage HUD only. */
  lastHitTime?: number;
}

/**
 * Clean comedy-clown caricature on the bobo doll head.
 * Damage progression lives only in the top-right damage box.
 */
export function BoboClownFaceDecal({ lastHitTime = 0 }: BoboClownFaceDecalProps) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const texRef = useRef<THREE.CanvasTexture | null>(null);

  const paint = (warp?: Parameters<typeof drawFullFaceOnCanvas>[4]) => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const tex = texRef.current;
    if (!img || !canvas || !tex) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawFullFaceOnCanvas(ctx, img, CANVAS_SIZE, CANVAS_SIZE, warp);
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

    loadFaceImage(BOBO_CLOWN_CLEAN_SRC).then((img) => {
      if (cancelled) return;
      imgRef.current = img;
      paint();
    });

    return () => {
      cancelled = true;
      tex.dispose();
    };
  }, []);

  useEffect(() => {
    if (!lastHitTime) return;
    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const age = performance.now() - lastHitTime;
      if (age < 280) {
        paint(warpForPunch());
        return;
      }
      paint();
      cancelAnimationFrame(frame);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [lastHitTime]);

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
