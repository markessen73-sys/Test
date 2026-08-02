import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { BAG_FACE_MESH } from './faceTemplate';
import { drawFaceOnCanvas, loadFaceImage, warpForPunch } from './composeFaceTexture';
import { useCharacter } from './CharacterContext';

const CANVAS_SIZE = 512;

interface BagFaceDecalProps {
  /** Timestamp of latest bag punch — triggers brief squash. */
  lastPunchTime?: number;
}

/** Face decal on the heavy bag cylinder. */
export function BagFaceDecal({ lastPunchTime = 0 }: BagFaceDecalProps) {
  const { character } = useCharacter();
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

    loadFaceImage(character.cleanSrc).then((img) => {
      if (!cancelled) imgRef.current = img;
    });

    return () => {
      cancelled = true;
      tex.dispose();
    };
  }, [character.cleanSrc]);

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

      const age = performance.now() - lastPunchTime;
      const warp = lastPunchTime > 0 && age < 280 ? warpForPunch() : undefined;
      drawFaceOnCanvas(ctx, img, CANVAS_SIZE, CANVAS_SIZE, undefined, warp);
      tex.needsUpdate = true;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [lastPunchTime]);

  if (!texture) return null;

  const [cx, cy, cz] = BAG_FACE_MESH.center;
  const [fw, fh] = BAG_FACE_MESH.size;

  return (
    <mesh position={[cx, cy, cz]} renderOrder={2}>
      <planeGeometry args={[fw, fh]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}
