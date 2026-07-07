import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { FACE_TEMPLATE_SRC, RING_PARTNER_FACE } from './faceTemplate';
import { drawFullFaceOnCanvas, loadFaceImage, warpForPunch } from './composeFaceTexture';
import { scalePlacement, spriteNormRectToLocal } from './spriteFacePlacement';

const CANVAS_SIZE = 512;
/** Prior calibration: top-right pinned, +25%. */
const PARTNER_FACE_SCALE_TOP_RIGHT = 1.25;
/** Latest calibration: bottom-left pinned, +10% right and up. */
const PARTNER_FACE_SCALE_BOTTOM_LEFT = 1.1;

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

  const placement = useMemo(() => {
    const base = spriteNormRectToLocal(RING_PARTNER_FACE, spriteWidth, spriteHeight, {
      scale: PARTNER_FACE_SCALE_TOP_RIGHT,
      anchor: 'top-right',
    });
    return scalePlacement(base, PARTNER_FACE_SCALE_BOTTOM_LEFT, 'bottom-left');
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
      drawFullFaceOnCanvas(ctx, img, CANVAS_SIZE, CANVAS_SIZE, warp);
      tex.needsUpdate = true;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hitFlashAge]);

  if (!texture) return null;

  return (
    <mesh position={placement.center} renderOrder={2}>
      <planeGeometry args={[fw, fh]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}
