import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FACE_TEMPLATE_SRC, RING_PARTNER_FACE } from './faceTemplate';
import { drawFaceOnCanvas, loadFaceImage, warpForPunch } from './composeFaceTexture';
import { spriteNormRectToLocal } from './spriteFacePlacement';

const CANVAS_SIZE = 512;

interface PartnerFaceDecalProps {
  /** Sprite plane width in metres. */
  spriteWidth: number;
  /** Sprite plane height in metres. */
  spriteHeight: number;
  /** 0 = full hit flash, 1+ = no flash */
  hitFlashAge?: number;
}

/** Template face decal mapped onto the sparring partner head (ring play only). */
export function PartnerFaceDecal({
  spriteWidth,
  spriteHeight,
  hitFlashAge = 1,
}: PartnerFaceDecalProps) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const texRef = useRef<THREE.CanvasTexture | null>(null);

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

    loadFaceImage(FACE_TEMPLATE_SRC).then((img) => {
      if (!cancelled) imgRef.current = img;
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
      const img = imgRef.current;
      const canvas = canvasRef.current;
      const tex = texRef.current;
      if (!img || !canvas || !tex) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const warp = hitFlashAge < 1 ? warpForPunch() : undefined;
      drawFaceOnCanvas(ctx, img, CANVAS_SIZE, undefined, warp);
      tex.needsUpdate = true;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hitFlashAge]);

  if (!texture) return null;

  const { center, size } = spriteNormRectToLocal(RING_PARTNER_FACE, spriteWidth, spriteHeight);
  const [cx, cy, cz] = center;
  const nudgeY = spriteHeight * 0.012;
  const [fw, fh] = size;

  return (
    <mesh position={[cx, cy + nudgeY, cz]} renderOrder={2}>
      <planeGeometry args={[fw, fh]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.04} depthWrite={false} />
    </mesh>
  );
}
